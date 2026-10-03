import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, GITHUB_URL } from "@/lib/env";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <article className="container-page max-w-3xl py-12 prose-learn">
      <h1 className="h1">About {APP_NAME}</h1>
      <p><strong>Get your first paper reviewed and endorsed.</strong></p>
      <p>
        On {APP_NAME}, first-time researchers (students, young learners and independent researchers anywhere) learn how arXiv works,
        revise their paper with people who have published, and find an endorser in their field. Endorsers choose the abstracts they
        want to read, review the full paper, and endorse or decline on its merits. Anyone with a real contribution should be able to
        share it with the world, whoever they happen to know.
      </p>
      <h2>Our goals</h2>
      <ol>
        <li><strong>Learn for free.</strong> Every question you have before your first paper is answered openly, with no sign-in.</li>
        <li><strong>Get judged on your work.</strong> Feedback and endorsement depend on the paper, not on your network, institution or country.</li>
        <li><strong>Get credit for helping.</strong> Reviewing newcomers is unpaid work, so it shows up as karma, badges and a portable track record.</li>
        <li><strong>Keep arXiv open.</strong> Endorsers read the full paper before vouching for it, which keeps endorsement mills out.</li>
      </ol>
      <h2>What we measure</h2>
      <p>
        Our north-star metric is the number of first-time authors whose paper is posted after receiving feedback here. Our supporting
        metric is pay-it-forward pledges fulfilled.
      </p>
      <h2>Ground rules</h2>
      <ul>
        <li>No endorsement without the full paper, read on the platform.</li>
        <li>Manuscripts are confidential and only shared with reviewers the author chooses.</li>
        <li>No mass-asking: endorsers opt in, and at most three reviewers hold a paper at once.</li>
        <li>Own work only. No self-review. Declines count and earn the same karma as endorsements.</li>
        <li>All communication stays in in-app threads. There are no private DMs, and every message can be reported.</li>
        <li>You must be at least 16 to join.</li>
      </ul>
      <h2>Independence</h2>
      <p>
        {APP_NAME} is not affiliated with arXiv. We never touch arXiv accounts: endorsers act on arXiv&apos;s own endorsement form.
      </p>
      <p>
        The code is <a href={GITHUB_URL}>open source on GitHub</a> under the AGPL-3.0, and the learning center is CC BY 4.0. See our{" "}
        <Link href="/privacy">privacy promise</Link>.
      </p>
      <h2>Who runs it</h2>
      <p>
        {APP_NAME} is built and maintained by the team at <a href="https://maximem.ai">Maximem</a>. The code is{" "}
        <a href={GITHUB_URL}>open source</a>, decisions follow our public{" "}
        <a href={`${GITHUB_URL}/blob/main/GOVERNANCE.md`}>governance process</a>, and Maximem never uses manuscripts for any
        product, analytics or model training.
      </p>
    </article>
  );
}
