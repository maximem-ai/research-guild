import type { Metadata } from "next";
import Link from "next/link";
import { LearnSearch } from "@/components/LearnSearch";
import { articles, SECTIONS } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Learning center — your first preprint, explained",
  description: "Free, sign-in-free answers to the questions first-time researchers have before authoring, submitting to arXiv, and endorsing.",
  alternates: { canonical: "/learn" },
};

export default function LearnIndex() {
  return (
    <div className="container-page py-12">
      <h1 className="h1">Learning center</h1>
      <p className="mt-3 max-w-2xl muted">
        Every question you have before your first paper, answered for free with no sign-in. Articles are drafted from arXiv&apos;s official
        documentation and link to it; arXiv&apos;s own pages are always the final word.
      </p>
      <div className="mt-6 max-w-xl"><LearnSearch /></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/learn/readiness-check" className="card block no-underline hover:border-accent-500">
          <span className="badge badge-accent">Interactive</span>
          <h2 className="mt-2 text-lg font-semibold">Am I ready to post on arXiv? Take the 7-question readiness check →</h2>
          <p className="text-sm muted">No sign-in, and your answers aren&apos;t stored.</p>
        </Link>
        <Link href="/learn/glossary" className="card block no-underline hover:border-accent-500">
          <span className="badge badge-accent">Reference</span>
          <h2 className="mt-2 text-lg font-semibold">Glossary: endorsement, primary category, cross-listing and more →</h2>
          <p className="text-sm muted">Plain-English definitions of every term you&apos;ll meet.</p>
        </Link>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.id} className="mt-12" aria-labelledby={s.id}>
          <h2 id={s.id} className="h2 text-2xl">{s.title}</h2>
          <p className="mt-1 text-sm muted">{s.blurb}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {articles.filter((a) => a.section === s.id).map((a) => (
              <li key={a.slug}>
                <Link href={`/learn/${a.slug}`} className="card block h-full no-underline hover:border-accent-500">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm muted">{a.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
