import { expect, test } from "@playwright/test";
import { createUser, hasSupabase, makeProfile, postPaper, randomCode, rpc, signInBrowser, uploadPdf } from "./helpers";

test.skip(!hasSupabase, "needs a local Supabase");

test("reviewer happy path: attest → feed → accept → open paper → LinkedIn check → feedback → endorse", async ({ page, context, baseURL }) => {
  const author = await createUser("auth");
  await makeProfile(author, "Grace Hopper");
  const reviewer = await createUser("rev");
  await makeProfile(reviewer, "Rex Reviewer");
  const title = `Compilers for tiny robots, revisited ${Date.now()}`;
  const paperId = await postPaper(author, title);
  const code = randomCode();

  await signInBrowser(context, reviewer, baseURL!);
  // attest an endorser capability in settings
  await page.goto("/app/settings#endorse");
  await page.getByLabel("Category", { exact: true }).selectOption("cs.AI");
  await page.getByLabel("Evidence link").fill("https://arxiv.org/auth/show-endorsers/2401.00001");
  await page.locator('input[name="attest"]').check();
  await page.getByRole("button", { name: "Add capability" }).click();
  await expect(page.getByText("You can now accept abstracts")).toBeVisible();

  // feed → accept
  await page.goto("/app/feed");
  const card = page.locator("li.card", { hasText: title });
  await card.getByRole("button", { name: "Accept abstract" }).click();
  await expect(page).toHaveURL(/\/app\/reviews\/[0-9a-f-]+\?accepted=1/);
  const engagementId = page.url().match(/reviews\/([0-9a-f-]+)/)![1];

  // author uploads, sets code, shares (API)
  await uploadPdf(author, paperId);
  await rpc(author.client, "set_endorsement_code", { p_paper: paperId, p_code: code });
  await rpc(author.client, "share_paper", { p_engagement: engagementId });

  await page.reload();
  await expect(page.getByText("Unlocks after both checks")).toBeVisible();
  // opening the paper goes through a 5-minute signed URL (and logs paper_opened_at, unlocking the code)
  const href = await page.getByRole("link", { name: "Open full paper" }).getAttribute("href");
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const signed = res.headers()["location"];
  expect(signed).toContain("/storage/v1/object/sign/papers/");
  const pdf = await page.request.get(signed);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.reload();
  await page.locator("aside input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByRole("link", { name: /Endorse on arXiv/ })).toHaveAttribute("href", `https://arxiv.org/auth/endorse?x=${code}`);

  await page.getByPlaceholder("Specific, kind, actionable feedback").fill("Section 3 needs a clearer baseline.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Section 3 needs a clearer baseline.")).toBeVisible();

  await page.locator('input[name="confirm"]').check();
  await page.getByRole("button", { name: "2. Record my endorsement" }).click();
  await expect(page.getByText("Recorded. The author has been asked to confirm.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Endorsed · awaiting author").first()).toBeVisible();
});
