import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { ENGAGEMENT_STATE_LABEL, fmtDate, OPEN_STATES } from "@/lib/format";

export default async function Reviews() {
  const { supabase, profile } = await requireProfile();
  const { data } = await supabase.from("engagements").select("id, state, accepted_at, feedback_rounds, papers(title, primary_category)")
    .eq("endorser_id", profile.id).order("accepted_at", { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; state: string; accepted_at: string; feedback_rounds: number; papers: { title: string; primary_category: string } | null }[];
  const active = rows.filter((r) => OPEN_STATES.includes(r.state));
  const past = rows.filter((r) => !OPEN_STATES.includes(r.state));
  const list = (items: typeof rows) => (
    <ul className="mt-3 space-y-3">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/app/reviews/${r.id}`} className="card block no-underline hover:border-accent-500">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{r.papers?.title ?? "Paper"}</span>
              <span className="badge">{ENGAGEMENT_STATE_LABEL[r.state]}</span>
            </div>
            <p className="mt-1 text-sm muted">{r.papers?.primary_category} · accepted {fmtDate(r.accepted_at)} · {r.feedback_rounds} feedback round{r.feedback_rounds === 1 ? "" : "s"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <h1 className="h1">My reviews</h1>
      <h2 className="h2 mt-6">Active</h2>
      {active.length ? list(active) : <p className="mt-2 text-sm muted">No active reviews. <Link className="link" href="/app/feed">Open your feed</Link>.</p>}
      {past.length > 0 && (<><h2 className="h2 mt-8">Past</h2>{list(past)}</>)}
    </div>
  );
}
