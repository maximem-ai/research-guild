import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { requireProfile } from "@/lib/auth";
import { fmtDate, PAPER_TYPE_LABEL } from "@/lib/format";
import { acceptAbstractAction, passAbstractAction } from "../actions";

type FeedRow = {
  paper_id: string; title: string; abstract: string; primary_category: string; cross_list_categories: string[]; paper_type: string;
  status: string; posted_at: string; topic_ids: number[]; shared_topics: number; score: number; can_accept: boolean;
  at_capacity: boolean; nudged: boolean;
};

export default async function Feed() {
  const { supabase, profile } = await requireProfile();
  const [{ data, error }, { data: caps }, { data: topics }] = await Promise.all([
    supabase.rpc("match_papers_for_endorser", { p_uid: profile.id, p_limit: 40 }),
    supabase.from("endorser_capabilities").select("category_code, accepting, paused_until, status").eq("user_id", profile.id),
    supabase.from("topics").select("id, name"),
  ]);
  const rows = (data ?? []) as FeedRow[];
  const topicName = new Map((topics ?? []).map((t) => [t.id as number, t.name as string]));
  return (
    <div>
      <h1 className="h1">Abstract feed</h1>
      <p className="mt-2 max-w-2xl text-sm muted">
        Abstracts matched to your categories and topics. Accepting means you&apos;re willing to read the full paper if the author shares it.
        Abstracts are confidential to signed-in members; please don&apos;t share them.
      </p>
      {(caps ?? []).length === 0 && (
        <p className="alert mt-4 text-sm">You can browse, but to accept abstracts you need an endorser capability. <Link className="link" href="/app/settings#endorse">Add a category</Link>.</p>
      )}
      {error && <p className="alert alert-error mt-4">Couldn&apos;t load your feed.</p>}
      {rows.length === 0 && !error && <p className="card mt-6 text-sm muted">Nothing new right now. Follow more sub-topics in settings to widen your feed.</p>}
      <ul className="mt-6 space-y-4">
        {rows.map((r) => (
          <li key={r.paper_id} className="card">
            <div className="flex flex-wrap items-center gap-2 text-xs muted">
              <span className="badge">{r.primary_category}</span>
              {r.cross_list_categories.map((c) => <span key={c} className="badge">{c}</span>)}
              <span>{PAPER_TYPE_LABEL[r.paper_type]}</span>·<span>posted {fmtDate(r.posted_at)}</span>
              {r.nudged && <span className="badge badge-accent">The author nudged you</span>}
              {r.status === "in_review" && <span className="badge">In review</span>}
            </div>
            <h2 className="mt-2 text-lg font-semibold">{r.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {r.topic_ids.map((t) => <span key={t} className="badge text-[11px]">{topicName.get(t)}</span>)}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{r.abstract}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ActionForm action={acceptAbstractAction}>
                <input type="hidden" name="paper_id" value={r.paper_id} />
                <SubmitButton disabled={!r.can_accept}>Accept abstract</SubmitButton>
              </ActionForm>
              <ActionForm action={passAbstractAction}>
                <input type="hidden" name="paper_id" value={r.paper_id} />
                <SubmitButton className="btn">Pass</SubmitButton>
              </ActionForm>
              {r.at_capacity && r.can_accept && <span className="text-xs muted">You&apos;re at capacity; you&apos;ll be queued.</span>}
              {!r.can_accept && <span className="text-xs muted">Needs an active (not paused) capability in {r.primary_category}.</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
