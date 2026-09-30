// Edge Function `embed`: computes 384-d gte-small embeddings for queued papers/endorsers.
// Only jobs in categories past the smart-matching thresholds are claimed (see claim_embedding_jobs).
// Uses Supabase's built-in AI inference (no external API, no key).
import { isServiceCall, rpc } from "../_shared/auth.ts";

type Job = { job_id: number; target_type: string; target_id: string; content: string | null };

// deno-lint-ignore no-explicit-any
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return new Response("Forbidden", { status: 403 });
  try {
    const jobs = await rpc<Job[]>("claim_embedding_jobs", { p_limit: 25 });
    let done = 0;
    for (const job of jobs ?? []) {
      const text = String(job.content ?? "").slice(0, 4000);
      if (!text.trim()) continue;
      try {
        const embedding = await session.run(text, { mean_pool: true, normalize: true });
        await rpc("store_embedding", { p_job: job.job_id, p_embedding: JSON.stringify(embedding) });
        done++;
      } catch (err) {
        console.error("embed failed", job.job_id, err);
      }
    }
    return Response.json({ claimed: jobs?.length ?? 0, embedded: done });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
