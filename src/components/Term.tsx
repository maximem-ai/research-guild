"use client";
import { useId } from "react";
import { getTerm } from "@/lib/glossary";

/**
 * Inline definition for a term a newcomer may not know. Shows on hover or keyboard focus (CSS only),
 * and links to the glossary entry. Keep Term outside <label>/<legend> so it doesn't change control names.
 */
export function Term({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const t = getTerm(slug);
  const id = useId();
  return (
    <span className="term">
      <a href={`/learn/glossary#${t.slug}`} className="term-link" aria-describedby={id}>{children ?? t.term}</a>
      <span role="tooltip" id={id} className="term-tip"><strong>{t.term}</strong>{t.definition}</span>
    </span>
  );
}

/** A small "What's this?" definition to place next to a form label. */
export function TermHint({ slug, label = "What's this?" }: { slug: string; label?: string }) {
  return <span className="term-hint"><Term slug={slug}>{label}</Term></span>;
}
