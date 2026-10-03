// Edge Function `verify-arxiv`: called by a signed-in author (with their own JWT) after their paper is
// announced. It looks the ID up on the arXiv API, checks the author's display name against the listed
// authors, then records the verification through verify_arxiv_posting (service role only), which also
// checks membership, the endorsed category and the paper's state.
import { authorNameMatches, fetchArxivRecord, parseArxivId } from "../_shared/arxiv.ts";
import { getUserId, rpc, RpcError, selectOne } from "../_shared/auth.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const userId = await getUserId(req);
  if (!userId) return json({ error: "You need to sign in first." }, 401);

  let body: { paper_id?: string; arxiv_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const id = parseArxivId(String(body.arxiv_id ?? ""));
  if (!id || !body.paper_id) return json({ error: "That doesn't look like an arXiv ID (e.g. 2409.12345)." }, 400);

  const profile = await selectOne<{ display_name: string }>("profiles", `id=eq.${encodeURIComponent(userId)}&select=display_name`);
  if (!profile) return json({ error: "Please complete your profile first." }, 400);

  let record;
  try { record = await fetchArxivRecord(id); } catch { return json({ error: "The arXiv API didn't respond. Please try again in a few minutes." }, 502); }
  if (!record) return json({ error: "arXiv has no paper with that ID yet. New submissions appear after they are announced." }, 404);

  try {
    await rpc("verify_arxiv_posting", {
      p_actor: userId, p_paper: body.paper_id, p_arxiv_id: id,
      p_arxiv_categories: record.categories, p_author_matched: authorNameMatches(profile.display_name, record.authors),
    });
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : "Verification failed." }, 400);
  }
  return json({ verified: true, title: record.title });
});
