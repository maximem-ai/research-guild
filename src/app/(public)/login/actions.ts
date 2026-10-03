"use server";
import { redirect } from "next/navigation";
import { enabledProviders, type ProviderId } from "@/lib/auth-providers";
import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/app") && !n.startsWith("//") ? n : "/app";
}

export async function signInWith(formData: FormData) {
  const provider = formData.get("provider") as ProviderId;
  if (!(await enabledProviders()).includes(provider)) redirect("/login?error=provider");
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth")}`);
  redirect(data.url);
}
