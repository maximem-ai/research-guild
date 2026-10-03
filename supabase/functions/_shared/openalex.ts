// OpenAlex client (free, keyless) shared by the `scholar` Edge Function and the app's unit tests
// (src/lib/openalex.ts re-exports it). No imports, so it runs in Deno, Workers and Node alike.
const BASE = "https://api.openalex.org";
const UA = { "User-Agent": "ResearchGuild/1.0 (+https://researchguild.org)" };

export type OpenAlexAuthor = { id: string; name: string; hint: string | null; works: number | null };
export type OpenAlexWork = {
  external_id: string; title: string; venue: string | null; year: number | null; url: string | null;
  arxiv_id: string | null; coauthor_names: string[];
};
/** A single work with its full author list, used when someone adds a paper by DOI. */
export type OpenAlexWorkDetail = OpenAlexWork & { authors: string[]; doi: string | null };

export class OpenAlexError extends Error {}

export function shortId(url: string) {
  return url.replace(/^https?:\/\/openalex\.org\//, "");
}

/** Accepts "10.1234/abc", "doi:10.1234/abc" and doi.org URLs. Returns the bare DOI, lower-cased. */
export function parseDoi(input: string): string | null {
  const s = input.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s.toLowerCase() : null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) throw new OpenAlexError("not_found");
  if (!res.ok) throw new OpenAlexError(`OpenAlex returned ${res.status}`);
  return (await res.json()) as T;
}

export async function searchAuthors(q: string): Promise<OpenAlexAuthor[]> {
  const json = await get<{ results?: Array<{ id: string; display_name: string; hint?: string; works_count?: number }> }>(
    `/autocomplete/authors?q=${encodeURIComponent(q)}`,
  );
  return (json.results ?? []).slice(0, 8).map((r) => ({ id: shortId(r.id), name: r.display_name, hint: r.hint ?? null, works: r.works_count ?? null }));
}

type RawWork = {
  id: string; title?: string; display_name?: string; publication_year?: number; doi?: string | null;
  primary_location?: { source?: { display_name?: string } | null; landing_page_url?: string | null } | null;
  locations?: Array<{ landing_page_url?: string | null }>;
  authorships?: Array<{ author?: { id?: string; display_name?: string } }>;
};

export function normalizeWork(w: RawWork, selfId: string): OpenAlexWork {
  const urls = [w.primary_location?.landing_page_url, ...(w.locations ?? []).map((l) => l.landing_page_url)].filter(Boolean) as string[];
  const arxiv = urls.map((u) => u.match(/arxiv\.org\/abs\/([^v?#]+)/)?.[1]).find(Boolean) ?? null;
  return {
    external_id: shortId(w.id),
    title: (w.title ?? w.display_name ?? "").slice(0, 500),
    venue: w.primary_location?.source?.display_name ?? null,
    year: w.publication_year ?? null,
    url: w.doi ?? urls[0] ?? null,
    arxiv_id: arxiv,
    coauthor_names: (w.authorships ?? [])
      .filter((a) => a.author?.id && shortId(a.author.id) !== selfId)
      .map((a) => a.author?.display_name ?? "")
      .filter(Boolean)
      .slice(0, 50),
  };
}

export async function fetchWorks(authorId: string): Promise<OpenAlexWork[]> {
  const json = await get<{ results?: RawWork[] }>(
    `/works?filter=author.id:${encodeURIComponent(authorId)}&sort=publication_date:desc&per-page=10`,
  );
  return (json.results ?? []).map((w) => normalizeWork(w, authorId)).filter((w) => w.title);
}

/** Looks a work up by DOI. Returns null when OpenAlex doesn't know it. */
export async function fetchWorkByDoi(doi: string): Promise<OpenAlexWorkDetail | null> {
  let w: RawWork;
  try {
    w = await get<RawWork>(`/works/doi:${encodeURIComponent(doi)}`);
  } catch (e) {
    if (e instanceof OpenAlexError && e.message === "not_found") return null;
    throw e;
  }
  const base = normalizeWork(w, "");
  const authors = (w.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean);
  return { ...base, authors, coauthor_names: authors.slice(0, 50), doi };
}
