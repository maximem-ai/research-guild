import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, GITHUB_URL } from "@/lib/env";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <article className="container-page max-w-3xl py-12 prose-learn">
      <h1 className="h1">About {APP_NAME}</h1>
      <p><strong>Anyone with a real contribution should be able to share it with the world.</strong></p>
      <p>
        {APP_NAME} is a free, open-source community that helps first-time researchers (students, young learners and independent
        researchers anywhere) learn how open science works, get honest feedback from people who have published, and find someone
        willing to vouch for their work.
      </p>
      <h2>Our goals</h2>
      <ol>
        <li><strong>Free knowledge.</strong> Every question you have before your first paper is answered for free, with no sign-in.</li>
        <li><strong>Fair access.</strong> Getting feedback and an endorsement depends on your work, not on your network, institution or country.</li>
        <li><strong>Visible generosity.</strong> The unpaid work of helping newcomers is recognized and portable.</li>
        <li><strong>Protect the commons.</strong> Keep quality high so open preprint servers stay open for everyone. No endorsement mills.</li>
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
