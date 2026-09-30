import "server-only";
import { cache } from "react";
import { supabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

export type PublicProfile = {
  id: string; handle: string; display_name: string; headline: string | null; bio: string | null; avatar_path: string | null;
  karma: number; hf_username: string | null; github_username: string | null; homepage_url: string | null;
  google_scholar_url: string | null; orcid: string | null; created_at: string;
  capabilities: { category: string; status: string; accepting: boolean; max_active_reviews: number }[];
  topics: { category: string; name: string }[]; badges: string[]; open_slots: number;
};

export const getPublicProfile = cache(async (handle: string) => {
  if (!supabaseConfigured() || !/^[a-z0-9_]{3,30}$/i.test(handle)) return null;
  const sb = createAnonClient();
  const { data } = await sb.from("public_profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!data) return null;
  const { data: track } = await sb.from("endorser_track_record").select("*").eq("endorser_id", data.id);
  return { profile: data as PublicProfile, track: track ?? [] };
});
