import { expect, test } from "@playwright/test";

test("learning-center article renders with FAQ JSON-LD, no sign-in", async ({ page }) => {
  const res = await page.goto("/learn/what-is-arxiv-endorsement");
  expect(res?.status()).toBe(200);
  expect(page.url()).toContain("/learn/what-is-arxiv-endorsement");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("arXiv endorsement");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/learn\/what-is-arxiv-endorsement$/);

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faq = blocks.map((b) => JSON.parse(b)).find((d) => d["@type"] === "FAQPage");
  expect(faq).toBeTruthy();
  expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
  expect(faq.mainEntity[0]["@type"]).toBe("Question");
  expect(blocks.map((b) => JSON.parse(b)).some((d) => d["@type"] === "BreadcrumbList")).toBe(true);

  await expect(page.locator("footer")).toContainText("Thank you to arXiv for use of its open access interoperability");
  await expect(page.locator("footer")).toContainText("Built and maintained by the team at");
});

test("sitemap, robots and public readiness check", async ({ page, request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app/");
  expect(robots).toContain("Disallow: /papers/");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/learn/what-is-arxiv-endorsement");

  await page.goto("/learn/readiness-check");
  await page.getByRole("combobox").first().selectOption("survey_review");
  await page.getByRole("combobox").nth(1).selectOption("cs.AI");
  await page.getByRole("button", { name: "Check my readiness" }).click();
  await expect(page.getByText("Not quite yet")).toBeVisible();
  await expect(page.getByText(/passed peer review/).first()).toBeVisible();
});

test("app routes require sign-in", async ({ page }) => {
  await page.goto("/app/feed");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ffeed/);
});
