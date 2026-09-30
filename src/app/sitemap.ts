import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { articles } from "@/lib/learn";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/learn", "/learn/readiness-check", "/learn/glossary", "/karma", "/about", "/privacy", "/terms"];
  return [
    ...staticPages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...articles.map((a) => ({ url: `${SITE_URL}/learn/${a.slug}`, lastModified: new Date(a.lastVerified), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
