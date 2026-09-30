import type { Metadata } from "next";
import { APP_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <article className="container-page max-w-3xl py-12 prose-learn">
      <h1 className="h1">Terms of use</h1>
      <p>By using {APP_NAME} you agree to these community terms. They exist to keep the commons fair and safe.</p>
      <ol>
        <li><strong>Age.</strong> You must be at least 16 years old.</li>
        <li><strong>Own work only.</strong> Only post papers you are an author of, and submit them yourself.</li>
        <li><strong>Confidentiality.</strong> Reviewers must not share, upload elsewhere, or reuse manuscripts shared with them.</li>
        <li><strong>No mass-asking.</strong> Don&apos;t use this service to spam endorsers, here or elsewhere.</li>
        <li><strong>Honest endorsements.</strong> Endorse only work you have read and believe is appropriate for the category. Never exchange endorsements for money or favours. Mutual-endorsement patterns are flagged for moderators.</li>
        <li><strong>Respectful communication.</strong> All messages stay in in-app threads. Harassment, discrimination and spam lead to removal. Report anything that worries you.</li>
        <li><strong>Independence from arXiv.</strong> {APP_NAME} is not affiliated with arXiv. arXiv&apos;s own policies and moderators decide what is accepted there.</li>
        <li><strong>Karma</strong> has no monetary value and can&apos;t be transferred or redeemed.</li>
        <li><strong>No warranty.</strong> The service is provided as-is by volunteers and the team at Maximem, free of charge.</li>
      </ol>
    </article>
  );
}
