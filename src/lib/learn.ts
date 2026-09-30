import data from "@/generated/learn.json";

export type LearnArticle = {
  slug: string; title: string; description: string; section: string; order: number; lastVerified: string;
  needsReview: boolean; cta: "author" | "endorser"; sources: { title: string; url: string }[];
  faq: { q: string; a: string }[]; related: string[]; headings: string[]; wordCount: number; html: string;
};

export const SECTIONS: { id: string; title: string; blurb: string }[] = [
  { id: "before-authoring", title: "Before authoring", blurb: "Is arXiv right for you, what kind of paper you're writing, and how to prepare it." },
  { id: "before-submitting", title: "Before submitting", blurb: "Endorsement, codes, finding an endorser the right way, and what happens after you submit." },
  { id: "before-reviewing", title: "Before reviewing or endorsing", blurb: "Eligibility, responsibilities, useful feedback, declining kindly and confidentiality." },
];

export const articles = (data as { articles: LearnArticle[] }).articles;

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug) ?? null;
}
