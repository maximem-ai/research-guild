import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { ENGAGEMENT_STATE_LABEL, OPEN_STATES, PAPER_STATUS_LABEL } from "@/lib/format";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const [{ data: members }, { data: engagements }, { data: caps }, { data: notes }] = await Promise.all([
    supabase.from("paper_members").select("paper_id").eq("user_id", profile.id),
    supabase.from("engagements").select("id, state, paper_id, papers(title)").eq("endorser_id", profile.id).in("state", OPEN_STATES),
    supabase.from("endorser_capabilities").select("category_code, status").eq("user_id", profile.id),
    supabase.from("notifications").select("id").is("read_at", null).limit(50),
  ]);
  const ids = (members ?? []).map((m) => m.paper_id);
  const { data: papers } = ids.length
    ? await supabase.from("papers").select("id, title, status").in("id", ids).in("status", ["draft", "open", "in_review", "endorsed"])
    : { data: [] };
  return (
    <div className="space-y-8">
      {welcome && <p className="alert alert-ok">Welcome to the commons, {profile.display_name}! </p>}
      <div>
        <h1 className="h1">Hello, {profile.display_name.split(" ")[0]}</h1>
        <p className="mt-2 muted">Karma {profile.karma} · {(notes ?? []).length} unread notification{(notes ?? []).length === 1 ? "" : "s"}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between"><h2 className="h2">As an author</h2><Link href="/app/papers/new" className="btn btn-sm btn-primary">Post abstract</Link></div>
          {(papers ?? []).length === 0 ? <p className="mt-3 text-sm muted">No active papers.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {(papers ?? []).map((p) => (
                <li key={p.id} className="flex justify-between gap-2"><Link className="link" href={`/app/papers/${p.id}`}>{p.title}</Link><span className="badge">{PAPER_STATUS_LABEL[p.status]}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="flex items-center justify-between"><h2 className="h2">As a reviewer</h2><Link href="/app/feed" className="btn btn-sm">Open feed</Link></div>
          {(caps ?? []).length === 0 ? (
            <p className="mt-3 text-sm muted">You&apos;re not endorsing yet. If you&apos;re an arXiv author, <Link className="link" href="/app/settings#endorse">add a category</Link>.</p>
          ) : (engagements ?? []).length === 0 ? <p className="mt-3 text-sm muted">No active reviews. Check your feed for matching abstracts.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {(engagements ?? []).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <Link className="link" href={`/app/reviews/${e.id}`}>{(e.papers as unknown as { title: string } | null)?.title ?? "Paper"}</Link>
                  <span className="badge">{ENGAGEMENT_STATE_LABEL[e.state]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
