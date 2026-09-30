import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

export const getMyProfile = cache(async () => {
  const { supabase, user } = await getSessionUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: (data as Profile | null) ?? null };
});

/** Signed in + onboarded, or redirect. */
export async function requireProfile() {
  const { supabase, user, profile } = await getMyProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/app/onboarding");
  return { supabase, user, profile };
}

export async function requireModerator() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "moderator") redirect("/app");
  return ctx;
}
