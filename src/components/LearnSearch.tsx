"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import index from "@/generated/learn-search.json";

type Entry = { slug: string; title: string; description: string; faq: string[] };

/** Client-side filter over a build-time index of article titles, descriptions and FAQ questions. */
export function LearnSearch() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return (index as Entry[])
      .map((e) => {
        const hay = [e.title, e.description, ...e.faq].join(" ").toLowerCase();
        const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0) + (e.title.toLowerCase().includes(t) ? 2 : 0), 0);
        const faqHit = e.faq.find((f) => terms.every((t) => f.toLowerCase().includes(t)));
        return { e, score, faqHit, all: terms.every((t) => hay.includes(t)) };
      })
      .filter((r) => r.all)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [q]);
  return (
    <div className="relative">
      <label htmlFor="learn-search" className="sr-only">Search the learning center</label>
      <input id="learn-search" type="search" className="input text-base" placeholder="Search questions, e.g. “endorsement code”"
        value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {q && (
        <ul className="card mt-2 space-y-3 p-4" aria-live="polite">
          {results.length === 0 && <li className="text-sm muted">No matches. Try fewer words.</li>}
          {results.map(({ e, faqHit }) => (
            <li key={e.slug}>
              <Link href={`/learn/${e.slug}`} className="font-medium link">{e.title}</Link>
              <p className="text-sm muted">{faqHit ? `FAQ: ${faqHit}` : e.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
