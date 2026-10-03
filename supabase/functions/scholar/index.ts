// Edge Function `scholar`: past-paper lookups for signed-in members (called with their own JWT).
//   search_authors {q}         → OpenAlex author records matching a name
//   author_works {author_id}   → recent works for the record the member picked (the app stores them via
//                                set_openalex_publications as the member)
//   add_paper {ref}            → an arXiv ID or DOI the member authored. The paper is looked up on arXiv or
//                                OpenAlex, the member's display name must be on its author list, and the
//                                record is stored with add_publication (service role only), so titles and
//                                co-authors always come from the source, never from the client.
import { authorNameMatches, fetchArxivRecord, parseArxivId } from "../_shared/arxiv.ts";
import { getUserId, rpc, RpcError, selectOne } from "../_shared/auth.ts";
import { fetchWorkByDoi, fetchWorks, parseDoi, searchAuthors } from "../_shared/openalex.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const unavailable = (source: string) => json({ error: `${source} didn't respond. Please try again in a few minutes.` }, 502);

type Paper = { source: "arxiv" | "doi"; external_id: string; title: string; venue: string | null; year: number | null;
  url: string; arxiv_id: string | null; authors: string[] };

async function resolve(ref: string): Promise<Paper | null | "unavailable_arxiv" | "unavailable_openalex"> {
  const doi = parseDoi(ref);
  // arXiv DOIs (10.48550/arXiv.<id>) resolve through the arXiv API
  const arxivId = parseArxivId(doi?.startsWith("10.48550/arxiv.") ? doi.slice("10.48550/arxiv.".length) : ref);
  if (arxivId) {
    let r;
    try { r = await fetchArxivRecord(arxivId); } catch { return "unavailable_arxiv"; }
    if (!r) return null;
    return { source: "arxiv", external_id: arxivId, title: r.title, venue: "arXiv", year: yearOfArxivId(arxivId),
      url: `https://arxiv.org/abs/${arxivId}`, arxiv_id: arxivId, authors: r.authors };
  }
  if (doi) {
    let w;
    try { w = await fetchWorkByDoi(doi); } catch { return "unavailable_openalex"; }
    if (!w) return null;
    return { source: "doi", external_id: doi, title: w.title, venue: w.venue, year: w.year, url: `https://doi.org/${doi}`,
      arxiv_id: w.arxiv_id, authors: w.authors };
  }
  return null;
}

/** New-style arXiv IDs start with YYMM. */
function yearOfArxivId(id: string): number | null {
  const m = id.match(/^(\d{2})\d{2}\./);
  return m ? 2000 + Number(m[1]) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const userId = await getUserId(req);
  if (!userId) return json({ error: "You need to sign in first." }, 401);

  let body: { action?: string; q?: string; author_id?: string; ref?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

  if (body.action === "search_authors") {
    const q = String(body.q ?? "").trim();
    if (q.length < 3) return json({ error: "Type at least 3 characters of your name." }, 400);
    try { return json({ authors: await searchAuthors(q) }); } catch { return unavailable("OpenAlex"); }
  }

  if (body.action === "author_works") {
    const id = String(body.author_id ?? "");
    if (!/^A\d+$/.test(id)) return json({ error: "Pick an author record." }, 400);
    try { return json({ works: await fetchWorks(id) }); } catch { return unavailable("OpenAlex"); }
  }

  if (body.action === "add_paper") {
    const ref = String(body.ref ?? "").trim();
    if (!parseDoi(ref) && !parseArxivId(ref)) {
      return json({ error: "Enter an arXiv ID (e.g. 2409.12345), an arXiv link, or a DOI (e.g. 10.1145/1234567)." }, 400);
    }
    const profile = await selectOne<{ display_name: string }>("profiles", `id=eq.${encodeURIComponent(userId)}&select=display_name`);
    if (!profile) return json({ error: "Please complete your profile first." }, 400);

    const paper = await resolve(ref);
    if (paper === "unavailable_arxiv") return unavailable("The arXiv API");
    if (paper === "unavailable_openalex") return unavailable("OpenAlex");
    if (!paper) return json({ error: "We couldn't find that paper. Check the ID, or try its DOI or arXiv ID instead." }, 404);
    if (!authorNameMatches(profile.display_name, paper.authors)) {
      return json({
        error: `Your profile name “${profile.display_name}” isn't on this paper's author list (${paper.authors.slice(0, 6).join(", ")}${paper.authors.length > 6 ? ", …" : ""}). ` +
          "If you published under a different name, update your display name and try again.",
      }, 400);
    }
    const coauthors = paper.authors.filter((a) => !authorNameMatches(profile.display_name, [a])).slice(0, 50);
    try {
      await rpc("add_publication", {
        p_actor: userId, p_source: paper.source, p_external_id: paper.external_id, p_title: paper.title.slice(0, 500),
        p_venue: paper.venue, p_year: paper.year, p_url: paper.url, p_arxiv_id: paper.arxiv_id, p_coauthor_names: coauthors,
      });
    } catch (e) {
      return json({ error: e instanceof RpcError ? e.message : "Couldn't save the paper. Please try again." }, 400);
    }
    return json({ added: true, title: paper.title });
  }

  return json({ error: "Unknown action." }, 400);
});
