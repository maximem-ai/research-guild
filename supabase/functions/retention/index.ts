// Edge Function `retention`: deletes full-paper PDFs 30 days (platform_config.retention_days_after_close)
// after a paper closes, then nulls storage_path and stamps deleted_at on the version.
import { isServiceCall, removeObjects, rpc } from "../_shared/auth.ts";

type Due = { version_id: string; storage_path: string };

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return new Response("Forbidden", { status: 403 });
  try {
    const due = await rpc<Due[]>("versions_due_for_deletion", { p_limit: 200 });
    let deleted = 0;
    for (const v of due ?? []) {
      try {
        await removeObjects("papers", [v.storage_path]);
        await rpc("mark_version_deleted", { p_version: v.version_id });
        deleted++;
      } catch (err) {
        console.error("retention failed", v.version_id, err);
      }
    }
    return Response.json({ due: due?.length ?? 0, deleted });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
