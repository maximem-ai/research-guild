// Edge Function `embed`: computes 384-d gte-small embeddings for queued papers/endorsers.
// Only jobs in categories past the smart-matching thresholds are claimed (see claim_embedding_jobs).
// Uses Supabase's built-in AI inference (no external API, no key).
import { createClient } from "npm:@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/auth.ts";

// deno-lint-ignore no-explicit-any
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return new Response("Forbidden", { status: 403 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await supabase.rpc("claim_embedding_jobs", { p_limit: 25 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let done = 0;
  for (const job of jobs ?? []) {
    const text = String(job.content ?? "").slice(0, 4000);
    if (!text.trim()) continue;
    try {
      const embedding = await session.run(text, { mean_pool: true, normalize: true });
      const { error: e } = await supabase.rpc("store_embedding", { p_job: job.job_id, p_embedding: JSON.stringify(embedding) });
      if (!e) done++;
    } catch (err) {
      console.error("embed failed", job.job_id, err);
    }
  }
  return Response.json({ claimed: jobs?.length ?? 0, embedded: done });
});
