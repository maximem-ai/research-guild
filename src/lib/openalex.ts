// OpenAlex (free, keyless) — used for "Find my papers". Failures are non-blocking.
const BASE = "https://api.openalex.org";
const UA = { "User-Agent": "EndorseCommons/1.0 (+https://github.com/maximem-ai/preprint_commons)" };

export type OpenAlexAuthor = { id: string; name: string; hint: string | null; works: number | null };
export type OpenAlexWork = {
  external_id: string; title: string; venue: string | null; year: number | null; url: string | null;
  arxiv_id: string | null; coauthor_names: string[];
};

export function shortId(url: string) {
  return url.replace(/^https?:\/\/openalex\.org\//, "");
}

export async function searchAuthors(q: string): Promise<OpenAlexAuthor[]> {
  const res = await fetch(`${BASE}/autocomplete/authors?q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: Array<{ id: string; display_name: string; hint?: string; works_count?: number }> };
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
  const res = await fetch(
    `${BASE}/works?filter=author.id:${encodeURIComponent(authorId)}&sort=publication_date:desc&per-page=10`,
    { headers: UA, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: RawWork[] };
  return (json.results ?? []).map((w) => normalizeWork(w, authorId)).filter((w) => w.title);
}
