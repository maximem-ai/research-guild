import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { fmtDate, PAPER_STATUS_LABEL } from "@/lib/format";

export default async function MyPapers() {
  const { supabase, profile } = await requireProfile();
  const { data: members } = await supabase.from("paper_members").select("paper_id, role").eq("user_id", profile.id);
  const ids = (members ?? []).map((m) => m.paper_id);
  const { data: papers } = ids.length
    ? await supabase.from("papers").select("id, title, status, primary_category, created_at, posted_at").in("id", ids).order("created_at", { ascending: false })
    : { data: [] };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">My papers</h1>
        <Link href="/app/papers/new" className="btn btn-primary">Post an abstract</Link>
      </div>
      {(papers ?? []).length === 0 ? (
        <div className="card mt-6">
          <p>You haven&apos;t posted anything yet.</p>
          <p className="mt-2 text-sm muted">Start with the <Link className="link" href="/learn/readiness-check">readiness check</Link>, then post your abstract.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {(papers ?? []).map((p) => (
            <li key={p.id}>
              <Link href={`/app/papers/${p.id}`} className="card block no-underline hover:border-accent-500">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{p.title}</span>
                  <span className="badge">{PAPER_STATUS_LABEL[p.status] ?? p.status}</span>
                </div>
                <p className="mt-1 text-sm muted">{p.primary_category} · {p.posted_at ? `posted ${fmtDate(p.posted_at)}` : `created ${fmtDate(p.created_at)}`}
                  {(members ?? []).find((m) => m.paper_id === p.id)?.role === "coauthor" && " · co-author"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
