"use server";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PROVIDERS = ["linkedin_oidc", "google", "github"] as const;
type Provider = (typeof PROVIDERS)[number];

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/app") && !n.startsWith("//") ? n : "/app";
}

export async function signInWith(formData: FormData) {
  const provider = formData.get("provider") as Provider;
  if (!PROVIDERS.includes(provider)) redirect("/login?error=provider");
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: provider === "github" ? "read:user" : undefined,
    },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth")}`);
  redirect(data.url);
}
