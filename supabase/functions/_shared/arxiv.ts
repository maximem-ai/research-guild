// arXiv API client shared by the `verify-arxiv` Edge Function and the app's unit tests
// (src/lib/arxiv.ts re-exports it). No imports, so it runs in Deno, Workers and Node alike.
// Parsing is regex-based because neither Deno Deploy nor Workers has a DOMParser.

export type ArxivRecord = { id: string; title: string; authors: string[]; categories: string[]; primaryCategory: string | null };

/** Accepts "2401.12345", "2401.12345v2", "arXiv:2401.12345", abs/pdf URLs and old-style ids. Returns the bare id. */
export function parseArxivId(input: string): string | null {
  const s = input.trim().replace(/^arxiv:/i, "");
  const url = s.match(/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:\.pdf)?(?:[?#].*)?$/i);
  const raw = url ? url[1] : s;
  const m = raw.match(/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/);
  return m ? m[1] : null;
}

function decode(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

export function parseArxivAtom(xml: string): ArxivRecord | null {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entry) return null;
  const body = entry[1];
  const idMatch = body.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/([^<\s]+?)(v\d+)?\s*<\/id>/);
  if (!idMatch) return null; // the API returns an "Error" entry for unknown ids
  const title = decode((body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const authors = [...body.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => decode(m[1].trim()));
  const categories = [...body.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]);
  const primaryCategory = body.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1] ?? null;
  return { id: idMatch[1], title, authors, categories: [...new Set(categories)], primaryCategory };
}

export async function fetchArxivRecord(id: string): Promise<ArxivRecord | null> {
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`, {
    headers: { "User-Agent": "ResearchGuild/1.0 (+https://researchguild.org)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`arXiv API returned ${res.status}`);
  return parseArxivAtom(await res.text());
}

function normalizeName(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fuzzy author match: the last name must match exactly and the first name/initial must be compatible.
 * "Ada Lovelace" matches "A. Lovelace", "Ada King Lovelace", "Lovelace, Ada".
 */
export function authorNameMatches(displayName: string, authors: string[]): boolean {
  const mine = normalizeName(displayName).split(" ").filter(Boolean);
  if (mine.length === 0) return false;
  const myLast = mine[mine.length - 1];
  const myFirst = mine[0];
  return authors.some((a) => {
    let parts = normalizeName(a.includes(",") ? a.split(",").reverse().join(" ") : a).split(" ").filter(Boolean);
    parts = parts.map((p) => p.replace(/-/g, ""));
    if (parts.length === 0) return false;
    const last = parts[parts.length - 1];
    if (last !== myLast.replace(/-/g, "") && !parts.includes(myLast.replace(/-/g, ""))) return false;
    if (mine.length === 1 || parts.length === 1) return true;
    const first = parts[0];
    return first === myFirst || first[0] === myFirst[0];
  });
}
