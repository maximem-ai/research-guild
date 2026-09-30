import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FeedbackThread } from "@/components/FeedbackThread";
import { ProfileSignals } from "@/components/ProfileSignals";
import { requireProfile } from "@/lib/auth";
import { daysLeft, ENGAGEMENT_STATE_LABEL, fmtDate, PAPER_TYPE_LABEL, waitlistText } from "@/lib/format";
import type { Engagement, FeedbackMessage, Paper, PaperVersion, Profile } from "@/lib/types";
import { markLinkedinAction, recordDeclinedAction, recordEndorsedAction, reportAction, withdrawEngagementAction } from "../../actions";

const DECLINE_TEMPLATES = [
  { id: "wrong_category", label: "Wrong category", text: "I don't think this paper fits this category. A better primary category might be: " },
  { id: "cs_peer_review", label: "CS survey/position without peer review", text: "arXiv CS only accepts review/survey and position papers that have already passed peer review, and I couldn't see evidence of that." },
  { id: "incomplete", label: "Draft incomplete", text: "The draft isn't complete enough yet (e.g. methods, results or references to current work are missing)." },
  { id: "outside_area", label: "Outside my area", text: "This is outside my area, so I can't judge whether it's appropriate for the category." },
  { id: "identity", label: "Couldn't verify identity", text: "I couldn't verify the author's identity (LinkedIn verified badge / matching name)." },
];

export default async function ReviewPage({ params, searchParams }: {
  params: Promise<{ engagementId: string }>; searchParams: Promise<{ accepted?: string }>;
}) {
  const { engagementId } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const { data: eng } = await supabase.from("engagements").select("*").eq("id", engagementId).maybeSingle();
  if (!eng || eng.endorser_id !== profile.id) notFound();
  const e = eng as Engagement;
  const [{ data: paperRow }, versionsQ, secretQ, messagesQ, membersQ, cfgQ, posQ] = await Promise.all([
    supabase.from("papers").select("*").eq("id", e.paper_id).single(),
    supabase.from("paper_versions").select("*").eq("paper_id", e.paper_id).order("version_no", { ascending: false }),
    supabase.from("paper_secrets").select("endorsement_code, category_code").eq("paper_id", e.paper_id).maybeSingle(),
    supabase.from("feedback_messages").select("*").eq("engagement_id", e.id).order("created_at"),
    supabase.from("paper_members").select("user_id, role").eq("paper_id", e.paper_id),
    supabase.from("platform_config").select("key, value"),
    e.state === "waitlisted" ? supabase.rpc("waitlist_position", { p_engagement: e.id }) : Promise.resolve({ data: null }),
  ]);
  const paper = paperRow as Paper;
  const versions = (versionsQ.data ?? []) as PaperVersion[];
  const live = versions.filter((v) => v.storage_path);
  const cfg = Object.fromEntries((cfgQ.data ?? []).map((c) => [c.key, Number(c.value)]));
  const memberIds = (membersQ.data ?? []).map((m) => m.user_id);
  const { data: authorsQ } = await supabase.from("profiles").select("*").in("id", memberIds);
  const authors = (authorsQ ?? []) as Profile[];
  const owner = authors.find((a) => a.id === paper.owner_id);
  const names: Record<string, string> = Object.fromEntries(authors.map((a) => [a.id, `${a.display_name} (author)`]));
  names[profile.id] = "You";
  const code = secretQ.data?.endorsement_code as string | undefined;
  const reviewing = e.state === "reviewing";
  const opened = Boolean(e.paper_opened_at);
  const checked = Boolean(e.linkedin_checked_at);
  const endorseUrl = code ? `https://arxiv.org/auth/endorse?x=${code}` : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-8">
        {sp.accepted && <p className="alert alert-ok">Accepted. The author has been notified and can now share the full paper with you.</p>}
        <div>
          <p className="text-sm muted">{paper.primary_category} · {PAPER_TYPE_LABEL[paper.paper_type]} · posted {fmtDate(paper.posted_at)}</p>
          <h1 className="h1 mt-1">{paper.title}</h1>
          <p className="mt-3"><span className="badge badge-accent">{ENGAGEMENT_STATE_LABEL[e.state]}</span></p>
        </div>

        {e.state === "accepted" && (
          <p className="alert text-sm">Waiting for the author to share the full paper. If they don&apos;t within {daysLeft(e.accepted_at, cfg.accept_ttl_days ?? 7)} days, this acceptance expires.</p>
        )}
        {e.state === "waitlisted" && (
          <p className="alert text-sm">{waitlistText(e.waitlist_reason, (posQ.data as number | null) ?? null, cfg.max_active_reviewers_per_paper ?? 3)} You&apos;ll start automatically when a slot frees.</p>
        )}
        {reviewing && (
          <p className="text-sm muted">Keep the review active: send feedback or decide within {daysLeft(e.last_activity_at, cfg.review_ttl_days ?? 10)} days, or it expires (−3 karma).</p>
        )}
        {e.state === "closed_endorsed_elsewhere" && <p className="alert text-sm">Another reviewer endorsed this paper, so your review is closed. Karma you earned for feedback is kept. Thank you!</p>}

        <section className="card">
          <h2 className="h2">Abstract</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{paper.abstract}</p>
          {paper.peer_review_proof_url && <p className="mt-3 text-sm">Peer-review proof: <span className="break-all">{paper.peer_review_proof_url}</span></p>}
          {paper.repo_url && <p className="mt-1 text-sm">Repository: <a className="link break-all" href={paper.repo_url} target="_blank" rel="noopener noreferrer">{paper.repo_url}</a></p>}
        </section>

        {["reviewing", "endorsed_pending_author", "endorsed"].includes(e.state) && (
          <section className="card">
            <h2 className="h2">Full paper</h2>
            <p className="mt-1 text-sm muted">Confidential. Opens a 5-minute private link. Please don&apos;t download to shared drives, share, or paste it into AI tools.{" "}
              <Link className="link" href="/learn/manuscript-confidentiality">Confidentiality for reviewers</Link></p>
            <ul className="mt-3 space-y-1 text-sm">
              {versions.map((v) => (
                <li key={v.id}>v{v.version_no} · {fmtDate(v.uploaded_at)}{v.note && ` · ${v.note}`}{" "}
                  {v.storage_path ? <a className="link" href={`/app/files/${v.id}?engagement=${e.id}`} target="_blank" rel="noopener">Open full paper</a> : <span className="muted">deleted</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(messagesQ.data ?? []).length > 0 || reviewing || e.state === "endorsed_pending_author" ? (
          <section className="card">
            <h2 className="h2 mb-3">Feedback · {e.feedback_rounds} round{e.feedback_rounds === 1 ? "" : "s"}</h2>
            <p className="mb-3 text-xs muted">The first 3 rounds earn karma (+3 each). <Link className="link" href="/learn/giving-useful-feedback">Giving useful feedback</Link></p>
            <FeedbackThread engagementId={e.id} paperId={paper.id} messages={(messagesQ.data ?? []) as FeedbackMessage[]} names={names}
              meId={profile.id} canPost={reviewing || e.state === "endorsed_pending_author"} versions={live}
              placeholder="Specific, kind, actionable feedback on the paper…" />
          </section>
        ) : null}

        <section className="card">
          <h2 className="h2">About the author{authors.length > 1 ? "s" : ""}</h2>
          <div className="mt-3 space-y-6">
            {owner && <ProfileSignals profile={owner} supabaseClient={supabase} />}
            {authors.filter((a) => a.id !== paper.owner_id).map((a) => <ProfileSignals key={a.id} profile={a} supabaseClient={supabase} compact />)}
          </div>
        </section>

        <details className="text-sm">
          <summary className="cursor-pointer muted">Report this paper</summary>
          <ActionForm action={reportAction} className="mt-2 flex gap-2">
            <input type="hidden" name="target_type" value="paper" /><input type="hidden" name="target_id" value={paper.id} />
            <input name="reason" className="input" required minLength={3} placeholder="What's the problem?" aria-label="Reason" />
            <SubmitButton className="btn btn-sm">Report</SubmitButton>
          </ActionForm>
        </details>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="card space-y-4">
          <h2 className="font-semibold">Decision checklist</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span aria-hidden>{opened ? "☑" : "☐"}</span>
              <span>Opened the full paper on the platform{opened && <span className="muted"> ({fmtDate(e.paper_opened_at)})</span>}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>{checked ? "☑" : "☐"}</span>
              <div>
                <span>Checked the author&apos;s LinkedIn</span>
                {owner && <p><a className="link text-xs" href={owner.linkedin_url} target="_blank" rel="noopener noreferrer">Open LinkedIn profile ↗</a></p>}
                {reviewing && !checked && (
                  <ActionForm action={markLinkedinAction} className="mt-2 space-y-2">
                    <input type="hidden" name="engagement_id" value={e.id} />
                    <label className="flex items-start gap-2 text-xs">
                      <input type="checkbox" required className="mt-0.5" />
                      I opened this author&apos;s LinkedIn, it shows the verified badge, and the name matches.
                    </label>
                    <SubmitButton className="btn btn-sm">Confirm</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </li>
          </ol>

          {reviewing && (
            <>
              <div className="border-t border-theme pt-4">
                <h3 className="text-sm font-semibold">Endorse</h3>
                {!opened || !checked ? (
                  <p className="mt-1 text-xs muted">Unlocks after both checks. The endorsement code appears once you&apos;ve opened the full paper.</p>
                ) : endorseUrl ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <p>Endorsement code: <strong className="font-mono">{code}</strong></p>
                    <a className="btn btn-primary w-full" href={endorseUrl} target="_blank" rel="noopener noreferrer">1. Endorse on arXiv ↗</a>
                    <ActionForm action={recordEndorsedAction} className="space-y-2">
                      <input type="hidden" name="engagement_id" value={e.id} />
                      <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="confirm" required className="mt-0.5" />
                        I submitted a positive endorsement on arXiv&apos;s form.</label>
                      <SubmitButton className="btn w-full">2. Record my endorsement</SubmitButton>
                    </ActionForm>
                    <p className="text-xs muted">We never touch your arXiv account. The author confirms on their side.</p>
                  </div>
                ) : <p className="mt-1 text-xs muted">The author hasn&apos;t added a code.</p>}
              </div>
              <div className="border-t border-theme pt-4">
                <h3 className="text-sm font-semibold">Decline</h3>
                {!opened ? <p className="mt-1 text-xs muted">Open the full paper first.</p> : (
                  <details className="mt-2">
                    <summary className="btn btn-sm w-full cursor-pointer">Decline to endorse…</summary>
                    <ActionForm action={recordDeclinedAction} className="mt-3 space-y-2 text-sm">
                      <input type="hidden" name="engagement_id" value={e.id} />
                      <fieldset className="space-y-1">
                        <legend className="text-xs font-semibold">Reason</legend>
                        {DECLINE_TEMPLATES.map((t) => (
                          <label key={t.id} className="flex items-start gap-2 text-xs">
                            <input type="radio" name="template" value={t.text} required className="mt-0.5" />{t.label}
                          </label>
                        ))}
                      </fieldset>
                      <textarea name="reason" className="input" rows={3} placeholder="Add a kind, specific note for the author (e.g. the category to use)" aria-label="Note to author" />
                      <p className="alert text-xs">
                        <strong>Declines are real votes.</strong> Please also record &ldquo;do not endorse&rdquo; on arXiv&apos;s endorsement form
                        {endorseUrl ? <> (<a className="link" href={endorseUrl} target="_blank" rel="noopener noreferrer">open it</a>)</> : ""}.
                        {" "}<Link className="link" href="/learn/how-to-decline-kindly">How to decline kindly</Link>
                      </p>
                      <SubmitButton className="btn w-full">Record decline</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </div>
            </>
          )}

          {["accepted", "waitlisted", "reviewing"].includes(e.state) && (
            <ActionForm action={withdrawEngagementAction} className="border-t border-theme pt-4">
              <input type="hidden" name="engagement_id" value={e.id} />
              <SubmitButton className="btn btn-sm btn-danger w-full" confirm="Withdraw from this review? The author will be notified.">Withdraw from review</SubmitButton>
            </ActionForm>
          )}
        </div>
      </aside>
    </div>
  );
}
