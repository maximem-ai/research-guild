"use client";
import Link from "next/link";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { evaluateReadiness, READINESS_ITEMS, type ReadinessAnswers } from "@/lib/readiness";

const yesNo = (name: keyof ReadinessAnswers, set: (k: keyof ReadinessAnswers, v: boolean) => void, value?: boolean) => (
  <div className="mt-2 flex gap-4 text-sm">
    <label className="flex items-center gap-2"><input type="radio" name={name} checked={value === true} onChange={() => set(name, true)} /> Yes</label>
    <label className="flex items-center gap-2"><input type="radio" name={name} checked={value === false} onChange={() => set(name, false)} /> No</label>
  </div>
);

/** Public, sign-in-free version of the readiness check. Nothing is stored. */
export function ReadinessCheck() {
  const [a, setA] = useState<ReadinessAnswers>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof ReadinessAnswers, v: unknown) => { setDone(false); setA((x) => ({ ...x, [k]: v })); };
  const result = evaluateReadiness(a);
  const needsProof = (a.primary_category ?? "").startsWith("cs.") && (a.paper_type === "survey_review" || a.paper_type === "position");

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
      <fieldset className="card">
        <legend className="font-semibold">1. What kind of paper is it?</legend>
        <select className="input mt-2" value={a.paper_type ?? ""} onChange={(e) => set("paper_type", e.target.value || undefined)}>
          <option value="">Choose…</option>
          <option value="original_research">Original research</option>
          <option value="survey_review">Survey / review</option>
          <option value="position">Position paper</option>
          <option value="other">Other</option>
        </select>
        {needsProof && (
          <div className="mt-3">
            <p className="text-sm">Has it already passed peer review (e.g. accepted at a journal or conference)?</p>
            {yesNo("peer_review_proof", set, a.peer_review_proof)}
          </div>
        )}
      </fieldset>
      <fieldset className="card"><legend className="font-semibold">2. Is there a complete English version?</legend>{yesNo("english_complete", set, a.english_complete)}</fieldset>
      <fieldset className="card"><legend className="font-semibold">3. Is the draft finished (methods, results, references to current work)?</legend>{yesNo("draft_finished", set, a.draft_finished)}</fieldset>
      <fieldset className="card">
        <legend className="font-semibold">4. Primary category</legend>
        <select className="input mt-2" value={a.primary_category ?? ""} onChange={(e) => set("primary_category", e.target.value || undefined)}>
          <option value="">Choose…</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </select>
        <p className="hint">Not sure? Read <Link className="link" href="/learn/choosing-primary-category">choosing your primary category</Link>.</p>
      </fieldset>
      <fieldset className="card"><legend className="font-semibold">5. Are you an author submitting your own work?</legend>{yesNo("own_work", set, a.own_work)}</fieldset>
      <fieldset className="card"><legend className="font-semibold">6. Do you already have an endorsement code from arXiv for this category?</legend>{yesNo("has_endorsement_code", set, a.has_endorsement_code)}</fieldset>
      <fieldset className="card"><legend className="font-semibold">7. Will you avoid mass-asking endorsers elsewhere while your abstract is open?</legend>{yesNo("no_mass_asking", set, a.no_mass_asking)}</fieldset>
      <button type="submit" className="btn btn-primary">Check my readiness</button>

      {done && (
        <div aria-live="polite" className={`alert ${result.passed ? "alert-ok" : "alert-error"}`}>
          {result.passed ? (
            <p><strong>You look ready.</strong> You can post your abstract for endorsers in your category.{" "}
              <Link href="/app/papers/new" className="link">Post your abstract →</Link></p>
          ) : (
            <p><strong>Not quite yet.</strong> Here&apos;s what to fix first:</p>
          )}
          <ul className="mt-2 space-y-2">
            {[...result.failed, ...result.warnings].map((id) => {
              const item = READINESS_ITEMS.find((i) => i.id === id)!;
              return (
                <li key={id}>
                  {item.blocking ? "✗" : "ℹ"} {item.failReason}{" "}
                  <Link href={`/learn/${item.article}`} className="link">Read more</Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </form>
  );
}
