import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Topic } from "@/lib/types";

export async function loadReference(supabase: SupabaseClient) {
  const [{ data: cats }, { data: topics }] = await Promise.all([
    supabase.from("categories").select("code, archive, name").eq("active", true).order("code"),
    supabase.from("topics").select("id, category_code, slug, name").order("category_code").order("name"),
  ]);
  return { categories: (cats ?? []) as Category[], topics: (topics ?? []) as Topic[] };
}

export function groupTopics(topics: Topic[]) {
  const m = new Map<string, Topic[]>();
  for (const t of topics) m.set(t.category_code, [...(m.get(t.category_code) ?? []), t]);
  return m;
}
