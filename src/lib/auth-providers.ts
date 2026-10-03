// Sign-in buttons follow whatever is enabled in Supabase (Authentication → Providers), read from
// GoTrue's public settings endpoint on each login-page view. Enabling a provider in the dashboard shows
// its button immediately; no code change or redeploy needed.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export const PROVIDERS = [
  { id: "github", label: "Continue with GitHub" },
  { id: "google", label: "Continue with Google" },
  { id: "linkedin_oidc", label: "Continue with LinkedIn" },
] as const;
export type ProviderId = (typeof PROVIDERS)[number]["id"];

/** Picks the supported providers that GoTrue reports as enabled, in display order. */
export function pickProviders(settings: { external?: Record<string, boolean> } | null): ProviderId[] {
  return PROVIDERS.filter((p) => settings?.external?.[p.id] === true).map((p) => p.id);
}

export async function enabledProviders(): Promise<ProviderId[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return pickProviders(await res.json());
  } catch {
    return [];
  }
}
