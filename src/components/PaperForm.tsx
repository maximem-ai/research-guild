"use client";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { READINESS_ITEMS } from "@/lib/readiness";
import type { Category, Paper, Topic } from "@/lib/types";
import { SubmitButton, type ActionState } from "./ActionForm";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function YesNo({ name }: { name: string }) {
  return (
    <span className="flex gap-4 text-sm">
      <label className="flex items-center gap-1"><input type="radio" name={name} value="yes" required /> Yes</label>
      <label className="flex items-center gap-1"><input type="radio" name={name} value="no" /> No</label>
    </span>
  );
}

/** Abstract form. With `withReadiness`, it also collects the 7-question readiness check (§13b.B). */
export function PaperForm({ action, categories, topics, paper, paperTopics = [], withReadiness, locked, submitLabel }: {
  action: Action; categories: Category[]; topics: Topic[]; paper?: Paper; paperTopics?: number[];
  withReadiness?: boolean; locked?: boolean; submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [primary, setPrimary] = useState(paper?.primary_category ?? "cs.AI");
  const [cross, setCross] = useState<string[]>(paper?.cross_list_categories ?? []);
  const [type, setType] = useState(paper?.paper_type ?? "original_research");
  const [chosen, setChosen] = useState<number[]>(paperTopics);
  const [abstractLen, setAbstractLen] = useState(paper?.abstract.length ?? 0);
  const available = useMemo(() => topics.filter((t) => t.category_code === primary || cross.includes(t.category_code)), [topics, primary, cross]);
  const needsProof = primary.startsWith("cs.") && (type === "survey_review" || type === "position");
  const primaryInfo = categories.find((c) => c.code === primary);

  return (
    <form action={formAction} className="space-y-6">
      {paper && <input type="hidden" name="paper_id" value={paper.id} />}
      <div>
        <label className="label" htmlFor="title">Title *</label>
        <input id="title" name="title" className="input" required minLength={10} maxLength={300} defaultValue={paper?.title} />
      </div>
      <div>
        <label className="label" htmlFor="abstract">Abstract *</label>
        <textarea id="abstract" name="abstract" className="input" rows={9} required minLength={200} maxLength={2500}
          defaultValue={paper?.abstract} onChange={(e) => setAbstractLen(e.target.value.length)} />
        <p className="hint">{abstractLen}/2500 characters (minimum 200). Only signed-in members see abstracts; they are never indexed.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="primary_category">Primary category *</label>
          <select id="primary_category" name="primary_category" className="input" value={primary} disabled={locked}
            onChange={(e) => { setPrimary(e.target.value); setChosen([]); }}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
          {locked && <input type="hidden" name="primary_category" value={primary} />}
          <p className="hint">{primaryInfo?.name}. Unsure? <Link className="link" href="/learn/choosing-primary-category" target="_blank">Choosing your category</Link></p>
        </div>
        <div>
          <label className="label" htmlFor="paper_type">Paper type *</label>
          <select id="paper_type" name="paper_type" className="input" value={type} disabled={locked} onChange={(e) => setType(e.target.value)}>
            <option value="original_research">Original research</option>
            <option value="survey_review">Survey / review</option>
            <option value="position">Position paper</option>
            <option value="other">Other</option>
          </select>
          {locked && <input type="hidden" name="paper_type" value={type} />}
        </div>
      </div>
      {needsProof && (
        <div className="alert">
          <p className="text-sm">arXiv CS only accepts review/survey and position papers that have already passed peer review.{" "}
            <Link className="link" href="/learn/research-survey-position-papers" target="_blank">Why?</Link></p>
          <label className="label mt-2" htmlFor="peer_review_proof_url">Peer-review proof (URL or DOI) *</label>
          <input id="peer_review_proof_url" name="peer_review_proof_url" className="input" required defaultValue={paper?.peer_review_proof_url ?? ""} />
        </div>
      )}
      <fieldset>
        <legend className="label">Cross-list categories <span className="font-normal muted">(optional, up to 5)</span></legend>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-theme p-3">
          {categories.filter((c) => c.code !== primary).map((c) => (
            <label key={c.code} className="badge cursor-pointer gap-1">
              <input type="checkbox" name="cross_list" value={c.code} checked={cross.includes(c.code)}
                onChange={(e) => setCross((x) => e.target.checked ? [...x, c.code].slice(0, 5) : x.filter((y) => y !== c.code))} /> {c.code}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Sub-topics * <span className="font-normal muted">(pick 1–3)</span></legend>
        {available.length === 0 ? (
          <p className="hint">No curated sub-topics for this category yet; endorsers will match on category.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((t) => (
              <label key={t.id} className="badge cursor-pointer gap-1">
                <input type="checkbox" name="topics" value={t.id} checked={chosen.includes(t.id)}
                  disabled={!chosen.includes(t.id) && chosen.length >= 3}
                  onChange={(e) => setChosen((x) => e.target.checked ? [...x, t.id] : x.filter((y) => y !== t.id))} /> {t.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div>
        <label className="label" htmlFor="repo_url">Code or data repository</label>
        <input id="repo_url" name="repo_url" type="url" className="input" placeholder="https://github.com/…" defaultValue={paper?.repo_url ?? ""} />
      </div>

      {!paper && (
        <label className="flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" name="own_work" required className="mt-1" />
          <span>I am an author of this paper and I&apos;m submitting it myself.</span>
        </label>
      )}

      {withReadiness && (
        <fieldset className="card soft space-y-4">
          <legend className="px-1 font-semibold">arXiv readiness check</legend>
          <p className="text-sm muted">You must pass these before your abstract is posted.{" "}
            <Link className="link" href="/learn/readiness-check" target="_blank">About the check</Link></p>
          <input type="hidden" name="rc_paper_type" value={type} />
          <input type="hidden" name="rc_primary_category" value={primary} />
          <p className="text-sm">1. Paper type: <strong>{type.replace("_", " ")}</strong>{needsProof && " (peer-review proof required above)"}</p>
          {(["english_complete", "draft_finished"] as const).map((id, i) => {
            const item = READINESS_ITEMS.find((x) => x.id === id)!;
            return (
              <div key={id}>
                <p className="text-sm">{i + 2}. {item.question}</p><YesNo name={`rc_${id}`} />
                <p className="hint">If not: {item.failReason} <Link className="link" href={`/learn/${item.article}`} target="_blank">Learn more</Link></p>
              </div>
            );
          })}
          <p className="text-sm">4. Primary category: <strong>{primary}</strong> (chosen above)</p>
          {(["own_work", "has_endorsement_code", "no_mass_asking"] as const).map((id, i) => {
            const item = READINESS_ITEMS.find((x) => x.id === id)!;
            return (
              <div key={id}>
                <p className="text-sm">{i + 5}. {item.question}</p><YesNo name={`rc_${id}`} />
                <p className="hint">{item.blocking ? "If not: " : ""}{item.failReason} <Link className="link" href={`/learn/${item.article}`} target="_blank">Learn more</Link></p>
              </div>
            );
          })}
        </fieldset>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
      {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
      {state?.ok && <p role="status" className="alert alert-ok">{state.ok}</p>}
    </form>
  );
}
