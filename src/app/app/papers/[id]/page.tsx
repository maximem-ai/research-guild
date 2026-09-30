import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FeedbackThread } from "@/components/FeedbackThread";
import { PaperForm } from "@/components/PaperForm";
import { TrackRecord, type TrackRow } from "@/components/TrackRecord";
import { requireProfile } from "@/lib/auth";
import { daysLeft, ENGAGEMENT_STATE_LABEL, fmtDate, OPEN_STATES, PAPER_STATUS_LABEL, PAPER_TYPE_LABEL, waitlistText } from "@/lib/format";
import { hfPaperUrl } from "@/lib/huggingface";
import { READINESS_ITEMS } from "@/lib/readiness";
import { loadReference } from "@/lib/reference";
import type { Engagement, FeedbackMessage, Paper, PaperVersion, Profile } from "@/lib/types";
import {
  addCoauthorAction, confirmEndorsementAction, createPledgeAction, rateFeedbackAction, readinessAndPostAction,
  releaseReviewerAction, sendNudgeAction, setCodeAction, sharePaperAction, updateAbstractAction, uploadVersionAction,
  verifyArxivAction, withdrawPaperAction,
} from "../../actions";

type Match = { user_id: string; handle: string; display_name: string; headline: string | null; public_availability: boolean;
  karma: number; capability_status: string; shared_topics: number; at_capacity: boolean; nudged: boolean };

export default async function PaperPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string; draft?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const { data: paperRow } = await supabase.from("papers").select("*").eq("id", id).maybeSingle();
  if (!paperRow) notFound();
  const paper = paperRow as Paper;
  const { data: amMember } = await supabase.rpc("is_paper_member", { p_paper: id, p_uid: profile.id });
  if (!amMember) notFound(); // reviewers use /app/reviews
  const isOwner = paper.owner_id === profile.id;
  const isOpen = paper.status === "open" || paper.status === "in_review";

  const [ref, members, ptopics, versionsQ, secretQ, engagementsQ, cfgQ, endorsementQ, pledgeQ, readinessQ, nudgesQ] = await Promise.all([
    loadReference(supabase),
    supabase.from("paper_members").select("user_id, role, profiles(handle, display_name)").eq("paper_id", id),
    supabase.from("paper_topics").select("topic_id").eq("paper_id", id),
    supabase.from("paper_versions").select("*").eq("paper_id", id).order("version_no", { ascending: false }),
    supabase.from("paper_secrets").select("endorsement_code, category_code").eq("paper_id", id).maybeSingle(),
    supabase.from("engagements").select("*").eq("paper_id", id).order("accepted_at"),
    supabase.from("platform_config").select("key, value"),
    supabase.from("endorsements").select("*").eq("paper_id", id).maybeSingle(),
    supabase.from("pledges").select("id, status, category_code").eq("user_id", profile.id),
    supabase.from("readiness_checks").select("passed, failed_items, checked_at").eq("paper_id", id).order("checked_at", { ascending: false }).limit(1),
    supabase.from("nudges").select("id, sent_at").eq("paper_id", id),
  ]);
  const cfg = Object.fromEntries((cfgQ.data ?? []).map((c) => [c.key, Number(c.value)]));
  const versions = (versionsQ.data ?? []) as PaperVersion[];
  const engagements = (engagementsQ.data ?? []) as Engagement[];
  const endorserIds = engagements.map((e) => e.endorser_id);
  const [profilesQ, capsQ, trackQ, messagesQ, ratingsQ] = await Promise.all([
    endorserIds.length ? supabase.from("profiles").select("*").in("id", endorserIds) : Promise.resolve({ data: [] }),
    endorserIds.length ? supabase.from("endorser_capabilities").select("user_id, category_code, status, evidence_url").in("user_id", endorserIds).eq("category_code", paper.primary_category) : Promise.resolve({ data: [] }),
    endorserIds.length ? supabase.from("endorser_track_record").select("*").in("endorser_id", endorserIds) : Promise.resolve({ data: [] }),
    engagements.length ? supabase.from("feedback_messages").select("*").in("engagement_id", engagements.map((e) => e.id)).order("created_at") : Promise.resolve({ data: [] }),
    engagements.length ? supabase.from("feedback_ratings").select("engagement_id, helpful").in("engagement_id", engagements.map((e) => e.id)) : Promise.resolve({ data: [] }),
  ]);
  const profiles = new Map(((profilesQ.data ?? []) as Profile[]).map((p) => [p.id, p]));
  const caps = new Map(((capsQ.data ?? []) as { user_id: string; status: string; evidence_url: string }[]).map((c) => [c.user_id, c]));
  const track = (trackQ.data ?? []) as (TrackRow & { endorser_id: string })[];
  const messages = (messagesQ.data ?? []) as FeedbackMessage[];
  const rated = new Map(((ratingsQ.data ?? []) as { engagement_id: string; helpful: boolean }[]).map((r) => [r.engagement_id, r.helpful]));
  const positions = new Map<string, number | null>();
  for (const e of engagements.filter((x) => x.state === "waitlisted")) {
    const { data } = await supabase.rpc("waitlist_position", { p_engagement: e.id });
    positions.set(e.id, (data as number | null) ?? null);
  }
  const names: Record<string, string> = { [profile.id]: "You" };
  for (const m of (members.data ?? []) as unknown as { user_id: string; profiles: { display_name: string } | null }[]) if (m.user_id !== profile.id) names[m.user_id] = `${m.profiles?.display_name ?? "Co-author"} (author)`;
  for (const p of profiles.values()) names[p.id] = p.display_name;
  const matches: Match[] = isOpen ? (((await supabase.rpc("match_endorsers_for_paper", { p_paper: id, p_limit: 20 })).data ?? []) as Match[]) : [];
  const nudgesThisWeek = (nudgesQ.data ?? []).filter((n) => new Date(n.sent_at).getTime() > Date.now() - 7 * 86400_000).length;
  const hasAcceptance = engagements.some((e) => OPEN_STATES.includes(e.state));
  const hasCode = Boolean(secretQ.data);
  const endorsement = endorsementQ.data as { author_confirmed_at: string | null; arxiv_verified_at: string | null; category_code: string } | null;
  const pledged = (pledgeQ.data ?? []).find((p) => p.category_code === paper.primary_category);
  const latestCheck = readinessQ.data?.[0];
  const reviewing = engagements.filter((e) => e.state === "reviewing").length;

  return (
    <div className="space-y-8">
      {sp.posted && <p className="alert alert-ok">Your abstract is posted. Endorsers in {paper.primary_category} can now accept it.</p>}
      <div>
        <p className="text-sm muted">{paper.primary_category}{paper.cross_list_categories.length ? ` · cross-list ${paper.cross_list_categories.join(", ")}` : ""} · {PAPER_TYPE_LABEL[paper.paper_type]}</p>
        <h1 className="h1 mt-1">{paper.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge badge-accent">{PAPER_STATUS_LABEL[paper.status]}</span>
          {paper.posted_at && <span className="text-sm muted">Posted {fmtDate(paper.posted_at)}</span>}
          {isOpen && <span className="text-sm muted">· {reviewing}/{cfg.max_active_reviewers_per_paper ?? 3} active reviewers</span>}
          {paper.arxiv_id && (
            <>
              <a className="link text-sm" href={`https://arxiv.org/abs/${paper.arxiv_id}`} target="_blank" rel="noopener noreferrer">arXiv:{paper.arxiv_id}</a>
              <a className="link text-sm" href={hfPaperUrl(paper.arxiv_id)} target="_blank" rel="noopener noreferrer">Hugging Face Papers</a>
            </>
          )}
        </div>
      </div>

      {paper.status === "draft" && isOwner && (
        <section className="card" aria-labelledby="ready-h">
          <h2 id="ready-h" className="h2">Readiness check &amp; post</h2>
          {latestCheck && !latestCheck.passed && (
            <p className="alert alert-error mt-3">Last check didn&apos;t pass: {latestCheck.failed_items.map((f: string) => READINESS_ITEMS.find((i) => i.id === f)?.failReason ?? f).join(" ")}</p>
          )}
          <ActionForm action={readinessAndPostAction} className="mt-4 space-y-3">
            <input type="hidden" name="paper_id" value={paper.id} />
            <input type="hidden" name="rc_paper_type" value={paper.paper_type} />
            <input type="hidden" name="rc_primary_category" value={paper.primary_category} />
            {READINESS_ITEMS.filter((i) => !["paper_type", "primary_category"].includes(i.id)).map((i) => (
              <div key={i.id}>
                <p className="text-sm">{i.question}</p>
                <span className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1"><input type="radio" name={`rc_${i.id}`} value="yes" required /> Yes</label>
                  <label className="flex items-center gap-1"><input type="radio" name={`rc_${i.id}`} value="no" /> No</label>
                </span>
                <p className="hint">{i.failReason} <Link className="link" href={`/learn/${i.article}`}>Learn more</Link></p>
              </div>
            ))}
            <SubmitButton>Post abstract</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="card" aria-labelledby="abs-h">
        <h2 id="abs-h" className="h2">Abstract</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{paper.abstract}</p>
        {paper.peer_review_proof_url && <p className="mt-3 text-sm">Peer-review proof: <span className="break-all">{paper.peer_review_proof_url}</span></p>}
        {paper.repo_url && <p className="mt-1 text-sm">Repository: <a className="link break-all" href={paper.repo_url} target="_blank" rel="noopener noreferrer">{paper.repo_url}</a></p>}
        {isOwner && (paper.status === "draft" || isOpen) && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Edit abstract</summary>
            <div className="mt-4">
              <PaperForm action={updateAbstractAction} categories={ref.categories} topics={ref.topics} paper={paper}
                paperTopics={(ptopics.data ?? []).map((t) => t.topic_id)} locked={paper.status !== "draft"} submitLabel="Save changes" />
            </div>
          </details>
        )}
      </section>

      {isOpen && (
        <section className="card" aria-labelledby="files-h">
          <h2 id="files-h" className="h2">Full paper &amp; endorsement code</h2>
          <p className="mt-1 text-sm muted">PDF only, 10 MB max. Only you, your co-authors and reviewers you share with can open it. Deleted 30 days after the paper closes.</p>
          {versions.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {versions.map((v) => (
                <li key={v.id}>
                  v{v.version_no} · {fmtDate(v.uploaded_at)} · {(v.size_bytes / 1024 / 1024).toFixed(1)} MB{v.note && ` · ${v.note}`}{" "}
                  {v.storage_path ? <a className="link" href={`/app/files/${v.id}`} target="_blank" rel="noopener">open</a> : <span className="muted">deleted</span>}
                </li>
              ))}
            </ul>
          )}
          {hasAcceptance || versions.length ? (
            <ActionForm action={uploadVersionAction} className="mt-4 flex flex-wrap items-end gap-2" resetOnSuccess>
              <input type="hidden" name="paper_id" value={paper.id} />
              <div><label className="label" htmlFor="pdf">Upload {versions.length ? "a new version" : "the full paper"}</label>
                <input id="pdf" name="pdf" type="file" accept="application/pdf" required className="text-sm" /></div>
              <input name="note" className="input w-auto" placeholder="What changed? (optional)" aria-label="Version note" maxLength={500} />
              <SubmitButton className="btn btn-primary btn-sm">Upload PDF</SubmitButton>
            </ActionForm>
          ) : (
            <p className="alert mt-3 text-sm">You can upload the full paper once at least one endorser accepts your abstract.</p>
          )}
          <div className="mt-5">
            <p className="text-sm">
              arXiv endorsement code: {hasCode ? <strong className="font-mono">{secretQ.data!.endorsement_code}</strong> : <span className="muted">not set (required before sharing)</span>}
            </p>
            <ActionForm action={setCodeAction} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="paper_id" value={paper.id} />
              <input name="code" className="input w-32 font-mono uppercase" placeholder="ABC123" maxLength={6} required aria-label="Endorsement code" />
              <SubmitButton className="btn btn-sm">{hasCode ? "Update code" : "Save code"}</SubmitButton>
            </ActionForm>
            <p className="hint">arXiv gives you this 6-character code when it asks for an endorsement. Reviewers see it only after opening your full paper.{" "}
              <Link className="link" href="/learn/getting-your-endorsement-code">How to get it</Link></p>
          </div>
        </section>
      )}

      <section aria-labelledby="rev-h" className="space-y-4">
        <h2 id="rev-h" className="h2">Reviewers</h2>
        {engagements.length === 0 && <p className="text-sm muted">No endorser has accepted your abstract yet. {isOpen && "Matching endorsers are listed below."}</p>}
        {engagements.map((e) => {
          const p = profiles.get(e.endorser_id);
          const cap = caps.get(e.endorser_id);
          const thread = messages.filter((m) => m.engagement_id === e.id);
          const open = OPEN_STATES.includes(e.state);
          return (
            <article key={e.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {p ? <Link className="link" href={`/app/u/${p.handle}`}>{p.display_name}</Link> : "Reviewer"}{" "}
                    <span className="badge">{ENGAGEMENT_STATE_LABEL[e.state]}</span>
                  </p>
                  {p?.headline && <p className="text-sm muted">{p.headline}</p>}
                  <p className="mt-1 text-xs muted">
                    Karma {p?.karma ?? 0}
                    {cap && <> · {cap.status} endorser in {paper.primary_category} · <a className="link" href={cap.evidence_url} target="_blank" rel="noopener noreferrer">eligibility evidence</a></>}
                  </p>
                  <div className="mt-1"><TrackRecord rows={track.filter((t) => t.endorser_id === e.endorser_id)} /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.state === "accepted" && (
                    <ActionForm action={sharePaperAction}>
                      <input type="hidden" name="engagement_id" value={e.id} /><input type="hidden" name="paper_id" value={paper.id} />
                      <SubmitButton className="btn btn-primary btn-sm" disabled={!versions.length || !hasCode}>Share full paper</SubmitButton>
                    </ActionForm>
                  )}
                  {e.state === "endorsed_pending_author" && (
                    <ActionForm action={confirmEndorsementAction}>
                      <input type="hidden" name="engagement_id" value={e.id} /><input type="hidden" name="paper_id" value={paper.id} />
                      <SubmitButton className="btn btn-primary btn-sm" confirm="Confirm that arXiv shows you as endorsed? This closes every other review on this paper.">Confirm endorsement</SubmitButton>
                    </ActionForm>
                  )}
                  {open && (
                    <ActionForm action={releaseReviewerAction}>
                      <input type="hidden" name="engagement_id" value={e.id} /><input type="hidden" name="paper_id" value={paper.id} />
                      <SubmitButton className="btn btn-sm" confirm="Release this reviewer? Their review will close.">Release</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </div>
              {e.state === "accepted" && (!versions.length || !hasCode) && (
                <p className="text-xs muted">To share: {!versions.length && "upload the full paper"}{!versions.length && !hasCode && " and "}{!hasCode && "add your endorsement code"}. Share within {daysLeft(e.accepted_at, cfg.accept_ttl_days ?? 7)} days or the acceptance expires.</p>
              )}
              {e.state === "waitlisted" && <p className="alert text-sm">{waitlistText(e.waitlist_reason, positions.get(e.id) ?? null, cfg.max_active_reviewers_per_paper ?? 3)} They&apos;ll start automatically when a slot frees.</p>}
              {e.state === "endorsed_pending_author" && (
                <p className="alert text-sm">This reviewer says they endorsed you on arXiv. Check your arXiv account, then confirm. Confirming closes the other reviews on this paper.</p>
              )}
              {e.state === "declined" && e.decline_reason && <p className="alert text-sm"><strong>Reason:</strong> <span className="whitespace-pre-wrap">{e.decline_reason}</span></p>}
              {(thread.length > 0 || ["reviewing", "endorsed_pending_author"].includes(e.state)) && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Feedback thread · {e.feedback_rounds} round{e.feedback_rounds === 1 ? "" : "s"}</h3>
                  <FeedbackThread engagementId={e.id} paperId={paper.id} messages={thread} names={names} meId={profile.id}
                    canPost={["reviewing", "endorsed_pending_author"].includes(e.state)} versions={versions} placeholder="Reply to your reviewer…" />
                </div>
              )}
              {e.feedback_rounds > 0 && !rated.has(e.id) && (
                <ActionForm action={rateFeedbackAction} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="engagement_id" value={e.id} /><input type="hidden" name="paper_id" value={paper.id} />
                  <span>Was this feedback helpful?</span>
                  <input name="comment" className="input w-auto" placeholder="Optional comment" aria-label="Comment" />
                  <button name="helpful" value="true" className="btn btn-sm">👍 Helpful</button>
                  <button name="helpful" value="false" className="btn btn-sm">Not really</button>
                </ActionForm>
              )}
              {rated.has(e.id) && <p className="text-xs muted">You rated this feedback {rated.get(e.id) ? "helpful" : "not helpful"}.</p>}
            </article>
          );
        })}
      </section>

      {(paper.status === "endorsed" || paper.status === "posted") && endorsement?.author_confirmed_at && (
        <section className="card space-y-5" aria-labelledby="after-h">
          <h2 id="after-h" className="h2">After your endorsement</h2>
          {paper.status === "endorsed" ? (
            <div>
              <p className="text-sm">Once arXiv announces your paper, add its ID. We check the arXiv API that it exists, lists your name, and is in {endorsement.category_code}. This builds your endorser&apos;s public track record.</p>
              <ActionForm action={verifyArxivAction} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="paper_id" value={paper.id} />
                <input name="arxiv_id" className="input w-56" placeholder="e.g. 2409.12345" required aria-label="arXiv ID" />
                <SubmitButton className="btn btn-primary btn-sm">Verify posting</SubmitButton>
              </ActionForm>
            </div>
          ) : (
            <p className="alert alert-ok text-sm">Verified as posted on arXiv on {fmtDate(paper.arxiv_verified_at)}. Congratulations!</p>
          )}
          <div className="border-t border-theme pt-4">
            <h3 className="font-semibold">Someone vouched for you. Will you review for others once you&apos;re eligible?</h3>
            {pledged && pledged.status !== "declined" ? (
              <p className="mt-2 text-sm">You pledged to review in {pledged.category_code} ({pledged.status}). We&apos;ll remind you 3 months after your paper is posted, when arXiv may count it towards your eligibility.</p>
            ) : (
              <ActionForm action={createPledgeAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="paper_id" value={paper.id} /><input type="hidden" name="category" value={paper.primary_category} />
                <SubmitButton className="btn btn-primary btn-sm">I pledge to pay it forward in {paper.primary_category}</SubmitButton>
              </ActionForm>
            )}
          </div>
        </section>
      )}

      {isOpen && (
        <section className="card" aria-labelledby="match-h">
          <h2 id="match-h" className="h2">Endorsers who follow your topics</h2>
          <p className="mt-1 text-sm muted">
            {matches.length} available endorser{matches.length === 1 ? "" : "s"} in {paper.primary_category}. You can nudge up to {cfg.max_nudges_per_paper_per_week ?? 3} per week
            (in-app only) — {Math.max(0, (cfg.max_nudges_per_paper_per_week ?? 3) - nudgesThisWeek)} left. Please don&apos;t contact endorsers elsewhere.
          </p>
          <ul className="mt-3 space-y-2">
            {matches.filter((m) => m.public_availability).map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><Link className="link" href={`/e/${m.handle}`}>{m.display_name}</Link>{m.headline && <span className="muted"> · {m.headline}</span>}
                  <span className="muted"> · {m.shared_topics} shared topic{m.shared_topics === 1 ? "" : "s"}{m.at_capacity ? " · at capacity" : ""}</span></span>
                {isOwner && (m.nudged ? <span className="badge">Nudged</span> : (
                  <ActionForm action={sendNudgeAction}>
                    <input type="hidden" name="paper_id" value={paper.id} /><input type="hidden" name="endorser_id" value={m.user_id} />
                    <SubmitButton className="btn btn-sm">Nudge</SubmitButton>
                  </ActionForm>
                ))}
              </li>
            ))}
          </ul>
          {matches.some((m) => !m.public_availability) && (
            <p className="mt-2 text-xs muted">{matches.filter((m) => !m.public_availability).length} more endorsers see your abstract in their feed but have no public page.</p>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="authors-h">
        <h2 id="authors-h" className="h2">Authors</h2>
        <ul className="mt-2 text-sm">
          {((members.data ?? []) as unknown as { user_id: string; role: string; profiles: { handle: string; display_name: string } | null }[]).map((m) => (
            <li key={m.user_id}>{m.profiles?.display_name} <span className="muted">@{m.profiles?.handle} · {m.role}</span></li>
          ))}
        </ul>
        {isOwner && (paper.status === "draft" || isOpen) && (
          <ActionForm action={addCoauthorAction} className="mt-3 flex gap-2">
            <input type="hidden" name="paper_id" value={paper.id} />
            <input name="handle" className="input w-56" placeholder="@handle of a co-author" required aria-label="Co-author handle" />
            <SubmitButton className="btn btn-sm">Add co-author</SubmitButton>
          </ActionForm>
        )}
      </section>

      {isOwner && (paper.status === "draft" || isOpen) && (
        <ActionForm action={withdrawPaperAction}>
          <input type="hidden" name="paper_id" value={paper.id} />
          <SubmitButton className="btn btn-danger btn-sm" confirm="Withdraw this paper? All reviews close and files are deleted after 30 days.">Withdraw paper</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
