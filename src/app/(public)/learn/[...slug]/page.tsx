import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { APP_NAME, SITE_URL } from "@/lib/env";
import { fmtDate } from "@/lib/format";
import { articles, getArticle, SECTIONS } from "@/lib/learn";

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: [a.slug] }));
}

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug.join("/"));
  if (!a) return {};
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: `/learn/${a.slug}` },
    openGraph: { title: a.title, description: a.description, type: "article", url: `/learn/${a.slug}`, images: [`/og/learn/${a.slug}`] },
    twitter: { card: "summary_large_image", title: a.title, description: a.description, images: [`/og/learn/${a.slug}`] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = getArticle(slug.join("/"));
  if (!a) notFound();
  const section = SECTIONS.find((s) => s.id === a.section);
  const related = a.related.map((r) => getArticle(r)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const url = `${SITE_URL}/learn/${a.slug}`;

  return (
    <div className="container-page max-w-3xl py-10">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: APP_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Learning center", item: `${SITE_URL}/learn` },
          { "@type": "ListItem", position: 3, name: a.title, item: url },
        ],
      }} />
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/learn" className="hover:underline">Learning center</Link> <span aria-hidden>›</span> {section?.title}
      </nav>
      <article>
        <h1 className="h1 mt-3">{a.title}</h1>
        <p className="mt-3 text-sm muted">
          Last verified against arXiv&apos;s documentation on {fmtDate(a.lastVerified)}
          {a.needsReview && <span className="badge badge-warn ml-2">Draft · awaiting human review</span>}
        </p>
        <div className="prose-learn mt-6" dangerouslySetInnerHTML={{ __html: a.html }} />

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="h2 text-2xl">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {a.faq.map((f) => (
              <details key={f.q} className="card">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-sm">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="sources">
          <h2 id="sources" className="h2">Sources</h2>
          <ul className="mt-2 list-disc pl-6 text-sm">
            {a.sources.map((s) => (
              <li key={s.url}><a href={s.url} className="link" target="_blank" rel="noopener noreferrer">{s.title}</a></li>
            ))}
          </ul>
        </section>
      </article>

      <aside className="card mt-10 soft">
        {a.cta === "endorser" ? (
          <>
            <h2 className="h2">Published before? Help a first-time researcher.</h2>
            <p className="mt-1 text-sm muted">Opt in as an endorser, set your capacity, and review abstracts in your category.</p>
            <Link href="/app/settings#endorse" className="btn btn-primary mt-3">Become an endorser</Link>
          </>
        ) : (
          <>
            <h2 className="h2">Ready for feedback on your paper?</h2>
            <p className="mt-1 text-sm muted">Take the readiness check, then post your abstract for endorsers in your category.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/papers/new" className="btn btn-primary">Post your abstract</Link>
              <Link href="/learn/readiness-check" className="btn">Readiness check</Link>
            </div>
          </>
        )}
      </aside>

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="related">
          <h2 id="related" className="h2">Related articles</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/learn/${r.slug}`} className="card block no-underline hover:border-accent-500">
                <span className="font-medium">{r.title}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-10 text-xs muted">
        Learning-center text is licensed CC BY 4.0. Spotted something out of date? Open an issue or pull request on GitHub.
      </p>
    </div>
  );
}
