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

describe("glossary", async () => {
  const { GLOSSARY, GLOSSARY_GROUPS, getTerm } = await import("@/lib/glossary");
  it("has unique slugs, known groups and real article links", () => {
    expect(new Set(GLOSSARY.map((t) => t.slug)).size).toBe(GLOSSARY.length);
    const groups = new Set(GLOSSARY_GROUPS.map((g) => g.id));
    const slugs = new Set(articles.map((a) => a.slug));
    for (const t of GLOSSARY) {
      expect(groups.has(t.group)).toBe(true);
      expect(t.definition.length).toBeGreaterThan(40);
      if (t.article) expect(slugs.has(t.article)).toBe(true);
    }
  });
  it("covers the terms first-time authors meet", () => {
    for (const s of ["endorsement", "endorsement-code", "primary-category", "cross-listing", "original-research", "survey-paper",
      "position-paper", "peer-review", "arxiv-id", "negative-endorsement", "waitlist", "feedback-round"]) expect(() => getTerm(s)).not.toThrow();
  });
  it("auto-links first mentions in articles, once per term, never inside headings", () => {
    const linked = articles.filter((a) => a.html.includes('class="term-link"'));
    expect(linked.length).toBe(articles.length);
    for (const a of articles) {
      for (const slug of (a as unknown as { terms: string[] }).terms) {
        expect(a.html.split(`href="/learn/glossary#${slug}"`).length - 1).toBe(1);
      }
      expect(a.html).not.toMatch(/<h[1-4][^>]*>[^<]*<span class="term"/);
    }
  });
});
