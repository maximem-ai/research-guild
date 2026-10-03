export const APP_NAME = process.env.APP_NAME || "ResearchGuild";
/**
 * Canonical site origin. Tolerates a build variable entered without a scheme ("researchguild.org") or with
 * stray whitespace or a trailing slash, because `new URL(SITE_URL)` runs while every page builds.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return "http://localhost:3000";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const GITHUB_URL = "https://github.com/maximem-ai/research-guild";
export const MIN_AGE = 16;

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
