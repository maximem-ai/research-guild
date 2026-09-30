import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/categories";
import { articles } from "@/lib/learn";

describe("learning center content", () => {
  it("has all 18 seed articles", () => expect(articles).toHaveLength(18));
  it.each(articles.map((a) => [a.slug, a]))("%s is well-formed", (_slug, a) => {
    expect(a.title.length).toBeGreaterThan(10);
    expect(a.description.length).toBeGreaterThanOrEqual(50);
    expect(a.description.length).toBeLessThanOrEqual(170);
    expect(a.faq.length).toBeGreaterThanOrEqual(3);
    expect(a.sources.length).toBeGreaterThan(0);
    for (const s of a.sources) expect(s.url).toMatch(/^https:\/\/(info\.arxiv\.org|blog\.arxiv\.org|arxiv\.org)\//);
    expect(a.wordCount).toBeGreaterThanOrEqual(450);
    expect(a.wordCount).toBeLessThanOrEqual(1000);
    expect(a.html).not.toMatch(/<script/i);
  });
});

describe("categories mirror", () => {
  it("matches the seeded migration", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260930000200_reference_data.sql"), "utf8");
    const seeded = [...sql.matchAll(/\('([^']+)','([^']+)','([^']+)'\)/g)].map((m) => m[1]);
    expect(CATEGORIES.map((c) => c.code)).toEqual(seeded);
  });
});
