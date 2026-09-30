import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/papers/", "/auth/", "/login"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
