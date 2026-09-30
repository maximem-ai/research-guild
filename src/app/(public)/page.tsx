import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { getPledgeStats } from "@/lib/public-data";

export const dynamic = "force-dynamic";

const GOALS = [
  { title: "Free knowledge", body: "Every question you have before your first paper is answered for free, with no sign-in." },
  { title: "Fair access", body: "Getting feedback and an endorsement depends on your work, not on your network, institution or country." },
  { title: "Visible generosity", body: "The unpaid work of helping newcomers is recognized and portable." },
  { title: "Protect the commons", body: "Keep quality high so open preprint servers stay open for everyone. No endorsement mills." },
];

const STEPS = [
  { n: 1, title: "Learn and check readiness", body: "Read the free learning center and take the 7-question arXiv readiness check." },
  { n: 2, title: "Post your abstract", body: "Only your abstract is shown, and only to signed-in members. Endorsers in your category opt in." },
  { n: 3, title: "Share the full paper", body: "Choose who reads it. At most three reviewers hold your paper at once; others wait in a fair queue." },
  { n: 4, title: "Get feedback rounds", body: "Improve your draft with people who have published. Upload new versions as you go." },
  { n: 5, title: "Endorsement on arXiv", body: "A reviewer who read the full paper may endorse you on arXiv's own form. We never touch arXiv accounts." },
];

export default async function Home() {
  const pledges = await getPledgeStats();
  return (
    <div>
      <section className="container-page py-16 sm:py-24">
        <p className="badge badge-accent mb-5">Free · open source · not affiliated with arXiv</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Anyone with a real contribution should be able to share it with the world.
        </h1>
        <p className="mt-6 max-w-2xl text-lg muted">
          {APP_NAME} is a free, open-source community that helps first-time researchers — students, young learners and independent
          researchers anywhere — learn how open science works, get honest feedback from people who have published, and find someone
          willing to vouch for their work.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app/papers/new" className="btn btn-primary">Post your abstract</Link>
          <Link href="/app/settings#endorse" className="btn">Become an endorser</Link>
          <Link href="/learn" className="btn">Read the learning center</Link>
        </div>
      </section>

      <section className="soft border-y border-theme">
        <div className="container-page grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {GOALS.map((g) => (
            <div key={g.title}>
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <p className="mt-2 text-sm muted">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="h2 text-2xl">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="badge badge-accent">Step {s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm muted">
          No endorsement is possible without the full paper. When one reviewer endorses, everyone else on that paper is notified and
          their review closes. Declines are real votes, and earn the same karma as endorsements.
        </p>
      </section>

      <section className="container-page grid gap-6 pb-10 md:grid-cols-2">
        <div className="card">
          <h2 className="h2">Pay it forward</h2>
          <p className="mt-2 text-sm muted">
            Someone vouched for you? Pledge to review for others once you&apos;re eligible. We remind you three months after your paper is
            posted.
          </p>
          <dl className="mt-4 flex gap-8">
            <div><dt className="text-xs muted">Pledges made</dt><dd className="text-3xl font-semibold">{pledges?.made ?? 0}</dd></div>
            <div><dt className="text-xs muted">Pledges fulfilled</dt><dd className="text-3xl font-semibold">{pledges?.fulfilled ?? 0}</dd></div>
          </dl>
        </div>
        <div className="card">
          <h2 className="h2">Not sure you&apos;re ready?</h2>
          <p className="mt-2 text-sm muted">
            Take the free arXiv readiness check. No sign-in, and your answers aren&apos;t stored.
          </p>
          <Link href="/learn/readiness-check" className="btn mt-4">Take the readiness check</Link>
        </div>
      </section>
    </div>
  );
}
