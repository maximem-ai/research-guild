import "server-only";
import { supabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

export async function getPledgeStats(): Promise<{ made: number; fulfilled: number } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const { data } = await createAnonClient().from("pledge_stats").select("made, fulfilled").single();
    return data ? { made: Number(data.made), fulfilled: Number(data.fulfilled) } : null;
  } catch {
    return null;
  }
}
