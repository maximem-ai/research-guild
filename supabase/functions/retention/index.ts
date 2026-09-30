// Edge Function `retention`: deletes full-paper PDFs 30 days (platform_config.retention_days_after_close)
// after a paper closes, then nulls storage_path and stamps deleted_at on the version.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return new Response("Forbidden", { status: 403 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: due, error } = await supabase.rpc("versions_due_for_deletion", { p_limit: 200 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let deleted = 0;
  for (const v of due ?? []) {
    const { error: rmErr } = await supabase.storage.from("papers").remove([v.storage_path]);
    if (rmErr) { console.error("remove failed", v.version_id, rmErr.message); continue; }
    const { error: mErr } = await supabase.rpc("mark_version_deleted", { p_version: v.version_id });
    if (!mErr) deleted++;
  }
  return Response.json({ due: due?.length ?? 0, deleted });
});
