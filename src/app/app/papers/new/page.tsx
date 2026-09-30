import Link from "next/link";
import { PaperForm } from "@/components/PaperForm";
import { requireProfile } from "@/lib/auth";
import { loadReference } from "@/lib/reference";
import { createAndPostPaperAction } from "../../actions";

export default async function NewPaper() {
  const { supabase, profile } = await requireProfile();
  const [{ categories, topics }, { count }, { data: cfg }] = await Promise.all([
    loadReference(supabase),
    supabase.from("papers").select("id", { count: "exact", head: true }).eq("owner_id", profile.id).in("status", ["open", "in_review"]),
    supabase.from("platform_config").select("value").eq("key", "max_open_papers_per_author").maybeSingle(),
  ]);
  const max = Number(cfg?.value ?? 2);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">Post your abstract</h1>
      <p className="mt-3 muted">
        Only your abstract is shown, and only to signed-in members. Endorsers in your category opt in by accepting it. Once someone
        accepts, you upload the full paper and choose who reads it.
      </p>
      {(count ?? 0) >= max && (
        <p className="alert alert-error mt-4">You already have {count} open papers (the limit is {max}). Close one before posting another; you can still save a draft.</p>
      )}
      <p className="mt-3 text-sm muted">
        New to this? Read <Link className="link" href="/learn/what-is-arxiv-endorsement">what endorsement is</Link> and{" "}
        <Link className="link" href="/learn/finding-an-endorser">how to find an endorser the right way</Link>.
      </p>
      <div className="card mt-6">
        <PaperForm action={createAndPostPaperAction} categories={categories} topics={topics} withReadiness submitLabel="Check readiness & post abstract" />
      </div>
    </div>
  );
}
