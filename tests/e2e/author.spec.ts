import { expect, test } from "@playwright/test";
import { createUser, hasSupabase, makeProfile, randomCode, rpc, signInBrowser, TINY_PDF } from "./helpers";

test.skip(!hasSupabase, "needs a local Supabase");

test("author happy path: onboard → post abstract → upload → share → confirm endorsement", async ({ page, context, baseURL }) => {
  const author = await createUser("author");
  const endorser = await createUser("endorser");
  await makeProfile(endorser, "Rex Reviewer", ["cs.AI"]);

  // onboarding through the UI
  await signInBrowser(context, author, baseURL!);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByLabel("Display name *").fill("Ada Lovelace");
  await page.getByLabel("Handle *").fill(author.handle);
  await page.getByLabel("LinkedIn profile URL *").fill("https://www.linkedin.com/in/ada-lovelace");
  await page.locator('input[name="categories"][value="cs.AI"]').check();
  await page.locator('input[name="age_confirmed"]').check();
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page).toHaveURL(/\/app\?welcome=1/);

  // post an abstract with the readiness check
  await page.goto("/app/papers/new");
  await page.getByLabel("Title *").fill("Careful planning for small language agents");
  await page.getByLabel("Abstract *").fill("We propose a planning method for small language agents and evaluate it on three benchmarks. ".repeat(4));
  await page.locator('input[name="topics"]').first().check();
  await page.locator('input[name="own_work"]').check();
  for (const q of ["english_complete", "draft_finished", "own_work", "has_endorsement_code", "no_mass_asking"]) {
    await page.locator(`input[name="rc_${q}"][value="yes"]`).check();
  }
  await page.getByRole("button", { name: "Check readiness & post abstract" }).click();
  await expect(page).toHaveURL(/\/app\/papers\/[0-9a-f-]+\?posted=1/);
  await expect(page.getByText("Open for reviewers")).toBeVisible();
  const paperId = page.url().match(/papers\/([0-9a-f-]+)/)![1];

  // an endorser accepts (API)
  const engagementId = await rpc<string>(endorser.client, "accept_abstract", { p_paper: paperId });

  // upload full paper, set code, share (UI)
  await page.reload();
  await page.locator('input[name="pdf"]').setInputFiles({ name: "paper.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText("New version uploaded")).toBeVisible();
  await page.getByRole("textbox", { name: "Endorsement code" }).fill(randomCode().toLowerCase());
  await page.getByRole("button", { name: "Save code" }).click();
  await expect(page.getByText("Endorsement code saved")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Share full paper" }).click();
  await expect(page.getByText("Shared. The review has started.")).toBeVisible();

  // reviewer opens the paper, checks LinkedIn, gives feedback and records the endorsement (API)
  const { data: v } = await endorser.client.from("paper_versions").select("id").eq("paper_id", paperId).single();
  await rpc(endorser.client, "log_paper_open", { p_engagement: engagementId, p_version: v!.id });
  await rpc(endorser.client, "mark_linkedin_checked", { p_engagement: engagementId });
  await rpc(endorser.client, "send_feedback", { p_engagement: engagementId, p_body: "Clear contribution. Add a baseline." });
  await rpc(endorser.client, "record_endorsed", { p_engagement: engagementId });

  // author sees feedback, rates it, confirms the endorsement
  await page.reload();
  await expect(page.getByText("Clear contribution. Add a baseline.")).toBeVisible();
  await page.getByRole("button", { name: "👍 Helpful" }).click();
  await expect(page.getByText("You rated this feedback helpful.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm endorsement" }).click();
  await expect(page.getByText("Endorsement confirmed")).toBeVisible();
  await page.reload();
  await expect(page.getByText("After your endorsement")).toBeVisible();
  await page.getByRole("button", { name: /I pledge to pay it forward/ }).click();
  await expect(page.getByText(/You pledged to review in cs.AI/)).toBeVisible();

  // notifications page shows the in-app trail
  await page.goto("/app/notifications");
  await expect(page.getByText("An endorser accepted your abstract")).toBeVisible();
});
