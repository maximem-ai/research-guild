import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { requireModerator } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { modAction } from "../actions";

function StatusForm({ op, id, current }: { op: "flag" | "report"; id: number; current: string }) {
  return (
    <ActionForm action={modAction} className="flex gap-2">
      <input type="hidden" name="op" value={op} /><input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={current} className="input w-auto text-xs" aria-label="Status">
        <option value="open">open</option><option value="reviewing">reviewing</option><option value="actioned">actioned</option><option value="dismissed">dismissed</option>
      </select>
      <SubmitButton className="btn btn-sm">Update</SubmitButton>
    </ActionForm>
  );
}

export default async function Admin() {
  const { supabase } = await requireModerator();
  const [flags, reports, config, endorsements, caps] = await Promise.all([
    supabase.from("moderation_flags").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("platform_config").select("*").order("key"),
    supabase.from("endorsements").select("id, paper_id, endorser_id, category_code, author_confirmed_at, arxiv_verified_at, removed_flag, papers(title, arxiv_id)")
      .not("author_confirmed_at", "is", null).order("author_confirmed_at", { ascending: false }).limit(50),
    supabase.from("endorser_capabilities").select("user_id, category_code, status, evidence_url, profiles(handle)").order("attested_at", { ascending: false }).limit(100),
  ]);
  return (
    <div className="space-y-10">
      <h1 className="h1">Moderation</h1>

      <section>
        <h2 className="h2">Flags</h2>
        <p className="text-sm muted">Automatically raised: mutual endorsements within 12 months, ghosting patterns.</p>
        <ul className="mt-3 space-y-2">
          {(flags.data ?? []).map((f) => (
            <li key={f.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><span className="badge">{f.kind}</span> user {f.subject_user?.slice(0, 8)} {f.paper_id && <>· paper {f.paper_id.slice(0, 8)}</>} · <code className="text-xs">{JSON.stringify(f.detail)}</code> · {fmtDateTime(f.created_at)}</span>
              <StatusForm op="flag" id={f.id} current={f.status} />
            </li>
          ))}
          {(flags.data ?? []).length === 0 && <li className="text-sm muted">No flags.</li>}
        </ul>
      </section>

      <section>
        <h2 className="h2">Reports</h2>
        <ul className="mt-3 space-y-2">
          {(reports.data ?? []).map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><span className="badge">{r.target_type}</span> {r.target_id.slice(0, 8)} — {r.reason} · {fmtDateTime(r.created_at)}</span>
              <StatusForm op="report" id={r.id} current={r.status} />
            </li>
          ))}
          {(reports.data ?? []).length === 0 && <li className="text-sm muted">No reports.</li>}
        </ul>
      </section>

      <section>
        <h2 className="h2">Confirmed endorsements</h2>
        <p className="text-sm muted">Mark as removed if the paper was later removed or reclassified by arXiv (−10 karma to the endorser).</p>
        <ul className="mt-3 space-y-2">
          {(endorsements.data ?? []).map((e) => {
            const paper = e.papers as unknown as { title: string; arxiv_id: string | null } | null;
            return (
              <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{paper?.title} · {e.category_code} {paper?.arxiv_id && <a className="link" href={`https://arxiv.org/abs/${paper.arxiv_id}`} target="_blank" rel="noopener noreferrer">arXiv:{paper.arxiv_id}</a>}
                  {e.removed_flag && <span className="badge badge-bad ml-2">removed</span>}</span>
                <ActionForm action={modAction}>
                  <input type="hidden" name="op" value="removed" /><input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="removed" value={e.removed_flag ? "false" : "true"} />
                  <SubmitButton className="btn btn-sm">{e.removed_flag ? "Unmark" : "Mark removed/reclassified"}</SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="h2">Endorser capabilities</h2>
        <ul className="mt-3 space-y-2">
          {(caps.data ?? []).map((c) => (
            <li key={`${c.user_id}-${c.category_code}`} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><Link className="link" href={`/app/u/${(c.profiles as unknown as { handle: string } | null)?.handle}`}>@{(c.profiles as unknown as { handle: string } | null)?.handle}</Link> · {c.category_code} · <a className="link" href={c.evidence_url} target="_blank" rel="noopener noreferrer">evidence</a></span>
              <ActionForm action={modAction} className="flex gap-2">
                <input type="hidden" name="op" value="capability" /><input type="hidden" name="user_id" value={c.user_id} /><input type="hidden" name="category" value={c.category_code} />
                <select name="status" defaultValue={c.status} className="input w-auto text-xs" aria-label="Capability status">
                  <option value="claimed">claimed</option><option value="confirmed">confirmed</option><option value="suspended">suspended</option>
                </select>
                <SubmitButton className="btn btn-sm">Set</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h2">Platform config</h2>
        <p className="text-sm muted">Abuse thresholds and limits. Values are JSON.</p>
        <ul className="mt-3 space-y-2">
          {(config.data ?? []).map((c) => (
            <li key={c.key}>
              <ActionForm action={modAction} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="op" value="config" /><input type="hidden" name="key" value={c.key} />
                <label className="w-72 font-mono text-xs" htmlFor={`cfg-${c.key}`}>{c.key}</label>
                <input id={`cfg-${c.key}`} name="value" defaultValue={JSON.stringify(c.value)} className="input w-40 font-mono text-xs" />
                <SubmitButton className="btn btn-sm">Save</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
