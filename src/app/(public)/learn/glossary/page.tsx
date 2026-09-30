import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";
import { GLOSSARY, GLOSSARY_GROUPS } from "@/lib/glossary";
import { getArticle } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Glossary — arXiv and preprint terms, in plain English",
  description: "Plain-English definitions of the terms you meet before your first preprint: endorsement, endorsement code, primary category, cross-listing, survey and position papers, and more.",
  alternates: { canonical: "/learn/glossary" },
};

export default function Glossary() {
  return (
    <div className="container-page max-w-3xl py-10">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Endorse Commons glossary", url: `${SITE_URL}/learn/glossary`,
        hasDefinedTerm: GLOSSARY.map((t) => ({ "@type": "DefinedTerm", name: t.term, description: t.definition, url: `${SITE_URL}/learn/glossary#${t.slug}` })),
      }} />
      <nav aria-label="Breadcrumb" className="text-sm muted"><Link href="/learn" className="hover:underline">Learning center</Link> <span aria-hidden>›</span> Glossary</nav>
      <h1 className="h1 mt-3">Glossary</h1>
      <p className="mt-3 muted">
        The words you&apos;ll meet before your first preprint, in plain English. Across the site, a <span className="term-link">dotted orange
        underline</span> means a word is defined here; hover or tap it to see the definition. For arXiv&apos;s exact rules, follow the article
        links, which cite arXiv&apos;s own pages.
      </p>
      <nav aria-label="Glossary sections" className="mt-6 flex flex-wrap gap-2">
        {GLOSSARY_GROUPS.map((g) => <a key={g.id} href={`#${g.id}`} className="badge hover:border-[var(--brand-orange)]">{g.title}</a>)}
      </nav>
      {GLOSSARY_GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="mt-10 scroll-mt-6" aria-labelledby={`${g.id}-h`}>
          <h2 id={`${g.id}-h`} className="h2 text-2xl">{g.title}</h2>
          <dl className="mt-4 divide-y divide-[var(--border)] border-y border-theme">
            {GLOSSARY.filter((t) => t.group === g.id).map((t) => {
              const a = t.article ? getArticle(t.article) : null;
              return (
                <div key={t.slug} id={t.slug} className="scroll-mt-6 py-4 target:bg-[var(--soft)] target:px-3 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="mt-1 sm:mt-0">
                    <p>{t.definition}</p>
                    {a && <p className="mt-1 text-sm"><Link className="link accent-text" href={`/learn/${a.slug}`}>Read: {a.title}</Link></p>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
      <p className="mt-10 text-xs muted">Glossary text is licensed CC BY 4.0. Spotted something unclear or out of date? Open an issue on GitHub.</p>
    </div>
  );
}
