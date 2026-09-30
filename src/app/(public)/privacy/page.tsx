import type { Metadata } from "next";
import { APP_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <article className="container-page max-w-3xl py-12 prose-learn">
      <h1 className="h1">Privacy</h1>
      <div className="alert my-6">
        <p className="!my-0"><strong>Our promise about manuscripts:</strong> your full paper is visible only to the people you share it with
        (you, your co-authors and the reviewers you choose). It is deleted 30 days after the paper closes. It is never used by Maximem for
        any product, analytics or model training.</p>
      </div>
      <h2>What we store</h2>
      <ul>
        <li><strong>Account:</strong> the identity returned by the sign-in provider you choose (LinkedIn, Google or GitHub): your user ID, and your email address as held by our auth provider. We never email you.</li>
        <li><strong>Profile:</strong> the display name, handle, LinkedIn URL, categories and optional links you enter (Google Scholar, ORCID, OpenAlex, Hugging Face, homepage). If you sign in with GitHub, we store your GitHub username.</li>
        <li><strong>Papers:</strong> abstracts (visible to signed-in members while open, never indexed by search engines), full-paper PDFs (private, see above), feedback threads and endorsement records.</li>
        <li><strong>Endorsement codes:</strong> shown only to you and to a reviewer after they have opened your full paper.</li>
        <li><strong>Public availability pages:</strong> only if an endorser opts in.</li>
      </ul>
      <h2>Retention</h2>
      <p>
        Full-paper PDFs are deleted automatically 30 days after the paper is endorsed, withdrawn or expires. Version metadata (a hash,
        size and date) is kept so the history of an endorsement stays auditable.
      </p>
      <h2>Third parties</h2>
      <p>
        {APP_NAME} runs on Supabase (database, auth, storage) and Cloudflare (hosting). When you ask it to, the server looks up public data
        from the arXiv API (to verify a posted paper), OpenAlex (to list your publications) and Hugging Face (public model/dataset/Space
        counts). There are no ads, no trackers and no analytics scripts.
      </p>
      <h2>Your choices</h2>
      <p>
        You can edit your profile at any time, withdraw a paper (which starts the deletion clock), or ask the maintainers to delete your
        account via the contact on our GitHub repository.
      </p>
    </article>
  );
}
