import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Term } from "@/components/Term";
import { BECOME_ENDORSER_FAQ, FIND_ENDORSER_FAQ, type Faq } from "@/lib/faq";
import { GITHUB_URL } from "@/lib/env";
import { getPledgeStats } from "@/lib/public-data";

export const dynamic = "force-dynamic";

const AUTHOR_STEPS: { title: string; body: React.ReactNode }[] = [
  { title: "Learn how arXiv works", body: <>Read the free learning center, no sign-in needed, then take the 7-question <Term slug="readiness-check">readiness check</Term>.</> },
  { title: "Post your abstract", body: <>Only your <Term slug="abstract">abstract</Term> goes out, and only to signed-in members. <Term slug="endorser">Endorsers</Term> in your <Term slug="category">category</Term> choose to accept it.</> },
  { title: "Share the full paper", body: <>Send your <Term slug="full-paper">full paper</Term> to the reviewers you pick. Three can hold it at once; anyone else waits on a fair <Term slug="waitlist">waitlist</Term>.</> },
  { title: "Revise with feedback", body: <>Work through <Term slug="feedback-round">feedback rounds</Term> with people who have published, and upload new versions as the draft improves.</> },
  { title: "Get endorsed", body: <>A reviewer who has read the full paper can give you an <Term slug="endorsement">endorsement</Term> on <Term slug="arxiv">arXiv</Term>&apos;s own form, and you add your arXiv ID once the paper is announced.</> },
];

const ENDORSER_STEPS: { title: string; body: React.ReactNode }[] = [
  { title: "Claim your categories", body: <>Add each arXiv category you can endorse in, with your arXiv &ldquo;show endorsers&rdquo; link as evidence.</> },
  { title: "Choose what to read", body: <>Browse abstracts matched to your categories and topics, and accept only the ones you want to review.</> },
  { title: "Review at your own pace", body: <>Set how many papers you hold at once, pause when life gets busy, and give feedback in threads on the platform.</> },
  { title: "Endorse or decline", body: <>Both decisions earn the same karma. Endorsements that lead to a posted paper build your public <Term slug="track-record">track record</Term>.</> },
];

const PRINCIPLES = [
  { title: "Learn for free", body: "Every question you have before your first paper is answered openly, with no sign-in." },
  { title: "Get judged on your work", body: "Feedback and endorsement depend on the paper, not on your network, institution or country." },
  { title: "Get credit for helping", body: "Reviewing newcomers is unpaid work, so it shows up as karma, badges and a portable track record." },
  { title: "Keep arXiv open", body: "Endorsers read the full paper before vouching for it, which keeps endorsement mills out." },
];

function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="mt-4 divide-y divide-[var(--border)] border-y border-theme">
      {items.map((f) => (
        <details key={f.q} className="group py-3">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="mr-2 inline-block text-[var(--accent-text)] transition-transform group-open:rotate-90" aria-hidden>›</span>{f.q}
          </summary>
          <p className="mt-2 pl-5 text-sm muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default async function Home() {
  const pledges = await getPledgeStats();
  const faqLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: [...FIND_ENDORSER_FAQ, ...BECOME_ENDORSER_FAQ].map((f) => ({
      "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <div>
      <JsonLd data={faqLd} />
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="badge badge-accent mb-5">Free · open source · not affiliated with arXiv</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Get honest feedback on your paper before publishing, and find someone to endorse you for your first paper in a domain.
          </h1>
          <p className="mt-6 max-w-2xl text-lg muted">
            Post your abstract and let endorsers in your field choose to read it. Share the full paper with the reviewers you pick,
            revise it with people who have published, and leave with an arXiv endorsement once the work is ready. Students, young
            learners and independent researchers anywhere are welcome.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/papers/new" className="btn btn-primary">Post your abstract</Link>
            <Link href="/app/settings#endorse" className="btn">Become an endorser</Link>
            <Link href="/learn/readiness-check" className="btn">Check if you are ready</Link>
          </div>
          <p className="mt-6 text-sm muted">
            ResearchGuild is open source under AGPL-3.0.{" "}
            <a href={GITHUB_URL} className="link" target="_blank" rel="noopener noreferrer">Read the code, report an issue or contribute on GitHub</a>.
          </p>
        </div>
        <img src="/illustration-paper.png" width={540} height={610} alt="An abstract in cs.CL with two feedback rounds and an Endorsed stamp"
          className="hidden h-auto w-full lg:block" />
      </section>

      <section className="soft border-y border-theme">
        <div className="container-page grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((g) => (
            <div key={g.title}>
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <p className="mt-2 text-sm muted">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="authors-h">
        <h2 id="authors-h" className="h2 text-2xl">Writing your first paper?</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {AUTHOR_STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="badge badge-accent">Step {i + 1}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm muted">
          Nobody can endorse without reading the full paper. When one reviewer endorses, everyone else on that paper is notified and
          their review closes.
        </p>
      </section>

      <section className="container-page pb-14" aria-labelledby="endorsers-h">
        <h2 id="endorsers-h" className="h2 text-2xl">Already able to endorse on arXiv?</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ENDORSER_STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="badge badge-accent">Step {i + 1}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <Link href="/app/settings#endorse" className="btn mt-6">Add yourself as an endorser</Link>
      </section>

      <section className="container-page grid gap-6 pb-14 md:grid-cols-2">
        <div className="card">
          <h2 className="h2">Pay it forward</h2>
          <p className="mt-2 text-sm muted">
            Someone vouched for you? Pledge to review for others once you are eligible, and we will remind you three months after your
            paper is posted.
          </p>
          <dl className="mt-4 flex gap-8">
            <div><dt className="text-xs muted">Pledges made</dt><dd className="text-3xl font-semibold">{pledges?.made ?? 0}</dd></div>
            <div><dt className="text-xs muted">Pledges fulfilled</dt><dd className="text-3xl font-semibold">{pledges?.fulfilled ?? 0}</dd></div>
          </dl>
        </div>
        <div className="card">
          <h2 className="h2">Not sure you are ready?</h2>
          <p className="mt-2 text-sm muted">
            Take the free arXiv readiness check. It needs no sign-in, and your answers are not stored.
          </p>
          <Link href="/learn/readiness-check" className="btn mt-4">Take the readiness check</Link>
        </div>
      </section>

      <section id="faq" className="container-page grid scroll-mt-20 gap-10 pb-20 md:grid-cols-2" aria-labelledby="faq-h">
        <h2 id="faq-h" className="sr-only">Frequently asked questions</h2>
        <div>
          <h3 className="h2 text-xl">Finding an endorser</h3>
          <FaqList items={FIND_ENDORSER_FAQ} />
          <Link href="/learn/finding-an-endorser" className="link mt-4 inline-block text-sm">Read the full guide to finding an endorser</Link>
        </div>
        <div>
          <h3 className="h2 text-xl">Becoming an endorser</h3>
          <FaqList items={BECOME_ENDORSER_FAQ} />
          <Link href="/learn/am-i-eligible-to-endorse" className="link mt-4 inline-block text-sm">Check whether arXiv lets you endorse</Link>
        </div>
      </section>
    </div>
  );
}
