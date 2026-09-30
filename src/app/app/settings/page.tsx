import { Term, TermHint } from "@/components/Term";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { OpenAlexFinder } from "@/components/OpenAlexFinder";
import { ProfileForm } from "@/components/ProfileForm";
import { ShareButtons } from "@/components/ShareButtons";
import { requireProfile } from "@/lib/auth";
import { SITE_URL, SUPABASE_URL } from "@/lib/env";
import { BADGE_LABEL, fmtDate } from "@/lib/format";
import { loadReference } from "@/lib/reference";
import { availabilityCopy } from "@/lib/share";
import type { Capability } from "@/lib/types";
import {
  attestCapabilityAction, createPledgeAction, declinePledgeAction, removeCapabilityAction, setAvailabilityAction,
  unlinkOpenAlexAction, updateCapabilityAction, uploadAvatarAction,
} from "../actions";

export default async function Settings({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const [{ categories, topics }, cats, ints, caps, pubs, pledges, badges, reviewing] = await Promise.all([
    loadReference(supabase),
    supabase.from("profile_categories").select("category_code").eq("user_id", profile.id),
    supabase.from("profile_interests").select("topic_id").eq("user_id", profile.id),
    supabase.from("endorser_capabilities").select("*").eq("user_id", profile.id).order("category_code"),
    supabase.from("profile_publications").select("id, title, venue, year, url").eq("user_id", profile.id).order("year", { ascending: false }),
    supabase.from("pledges").select("id, category_code, status, remind_on").eq("user_id", profile.id),
    supabase.from("badges").select("badge, awarded_at").eq("user_id", profile.id),
    supabase.from("engagements").select("id", { count: "exact", head: true }).eq("endorser_id", profile.id).eq("state", "reviewing"),
  ]);
  const capabilities = (caps.data ?? []) as Capability[];
  const maxSlots = Math.max(0, ...capabilities.filter((c) => c.accepting && c.status !== "suspended").map((c) => c.max_active_reviews));
  const openSlots = Math.max(0, maxSlots - (reviewing.count ?? 0));
  const pageUrl = `${SITE_URL}/e/${profile.handle}`;
  const copy = availabilityCopy({ url: pageUrl, name: profile.display_name, categories: capabilities.map((c) => c.category_code), openSlots });
  const avatarUrl = profile.avatar_path ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_path}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {welcome && <p className="alert alert-ok">Welcome! Your profile is ready.</p>}
      <div>
        <h1 className="h1">Settings</h1>
        <p className="mt-2 text-sm muted">
          <Term slug="karma">Karma</Term>: <strong>{profile.karma}</strong> ·{" "}
          {(badges.data ?? []).map((b) => <span key={b.badge} className="badge badge-accent mr-1">{BADGE_LABEL[b.badge] ?? b.badge}</span>)}
          <Link className="link" href={`/app/u/${profile.handle}`}>View my profile</Link>
        </p>
      </div>

      <section className="card" aria-labelledby="profile-h">
        <h2 id="profile-h" className="h2 mb-4">Profile</h2>
        <ProfileForm profile={profile} categories={categories} topics={topics}
          myCategories={(cats.data ?? []).map((c) => c.category_code)} myTopics={(ints.data ?? []).map((t) => t.topic_id)} />
        {profile.github_username && <p className="hint mt-3">GitHub (from sign-in): @{profile.github_username}</p>}
      </section>

      <section className="card" aria-labelledby="avatar-h">
        <h2 id="avatar-h" className="h2 mb-3">Avatar</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full soft" />}
          <ActionForm action={uploadAvatarAction} className="flex flex-wrap items-center gap-2">
            <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" aria-label="Avatar image" className="text-sm" />
            <SubmitButton className="btn btn-sm">Upload</SubmitButton>
          </ActionForm>
        </div>
      </section>

      <section className="card" aria-labelledby="pubs-h">
        <h2 id="pubs-h" className="h2">Past papers</h2>
        <p className="mt-1 text-sm muted">
          <Term slug="google-scholar">Google Scholar</Term> has no public API, so we list papers from <Term slug="openalex">OpenAlex</Term> instead: find your author record and pick it.
        </p>
        <div className="mt-4"><OpenAlexFinder defaultName={profile.display_name} /></div>
        {(pubs.data ?? []).length > 0 && (
          <>
            <p className="mt-4 text-xs muted">From OpenAlex; user-selected ({profile.openalex_author_id}).</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {(pubs.data ?? []).map((p) => <li key={p.id}>{p.url ? <a className="link" href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a> : p.title} <span className="muted">{[p.venue, p.year].filter(Boolean).join(", ")}</span></li>)}
            </ul>
            <ActionForm action={unlinkOpenAlexAction} className="mt-3"><SubmitButton className="btn btn-sm">Unlink OpenAlex</SubmitButton></ActionForm>
          </>
        )}
      </section>

      <section id="endorse" className="card scroll-mt-20" aria-labelledby="endorse-h">
        <h2 id="endorse-h" className="h2">Endorsing</h2>
        <p className="mt-2 text-sm muted">
          arXiv has no API for <Term slug="endorser">endorser</Term> eligibility, so you self-attest per category and link evidence. Your <Term slug="capability">capability</Term> shows as
          &ldquo;claimed&rdquo; until a paper you endorse here is verified as posted in that category, then it becomes &ldquo;confirmed&rdquo;.
        </p>
        <div className="alert mt-3 text-sm">
          <strong>arXiv&apos;s rule:</strong> to endorse, you need enough papers in the subject area, and only papers submitted between
          3 months and 5 years ago count. The required number varies by subject area. Check on arXiv (on your account page, or via the
          endorsement link an author sends you) whether you are eligible. See{" "}
          <Link className="link" href="/learn/am-i-eligible-to-endorse">Am I eligible to endorse?</Link>
        </div>

        {capabilities.length > 0 && (
          <div className="mt-5 space-y-4">
            {capabilities.map((c) => (
              <div key={c.category_code} className="rounded-lg border border-theme p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{c.category_code}{" "}
                    <span className={`badge ${c.status === "confirmed" ? "badge-ok" : c.status === "suspended" ? "badge-bad" : ""}`}>{c.status}</span></p>
                  <a className="text-xs link" href={c.evidence_url} target="_blank" rel="noopener noreferrer">evidence</a>
                </div>
                <ActionForm action={updateCapabilityAction} className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
                  <input type="hidden" name="category" value={c.category_code} />
                  <div>
                    <label className="label" htmlFor={`max-${c.category_code}`}>Max active reviews</label>
                    <input id={`max-${c.category_code}`} name="max_active_reviews" type="number" min={1} max={10} className="input" defaultValue={c.max_active_reviews} />
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accepting" defaultChecked={c.accepting} /> Accepting new abstracts</label>
                  <div>
                    <label className="label" htmlFor={`pause-${c.category_code}`}>Paused until</label>
                    <input id={`pause-${c.category_code}`} name="paused_until" type="date" className="input" defaultValue={c.paused_until?.slice(0, 10) ?? ""} />
                  </div>
                  <SubmitButton className="btn btn-sm">Save</SubmitButton>
                </ActionForm>
                <ActionForm action={removeCapabilityAction} className="mt-2">
                  <input type="hidden" name="category" value={c.category_code} />
                  <SubmitButton className="btn btn-sm btn-danger" confirm="Stop endorsing in this category?">Remove</SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>
        )}

        <ActionForm action={attestCapabilityAction} className="mt-6 space-y-3" resetOnSuccess>
          <h3 className="font-semibold">Add a category</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cap-cat">Category</label>
              <select id="cap-cat" name="category" className="input" required>
                {categories.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cap-ev">Evidence link</label>
              <input id="cap-ev" name="evidence_url" className="input" required placeholder="https://arxiv.org/auth/show-endorsers/2401.12345" />
              <p className="hint">arXiv&apos;s <Term slug="show-endorsers">&ldquo;Which authors of this paper are endorsers?&rdquo;</Term> page for one of your papers. Shown to authors; we don&apos;t fetch it.</p>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="attest" className="mt-1" required />
            <span>I believe I am eligible to endorse in this category under arXiv&apos;s rules, and I will only endorse work I have read in full.</span>
          </label>
          <SubmitButton>Add capability</SubmitButton>
        </ActionForm>
      </section>

      <section className="card" aria-labelledby="avail-h">
        <h2 id="avail-h" className="h2">Public availability page</h2>
        <p className="mt-2 text-sm muted">
          An optional, indexable page that shows your categories, topics, open slots, karma and badges, with a &ldquo;Post your
          abstract&rdquo; button. Currently <strong>{profile.public_availability ? "public" : "hidden"}</strong>.
        </p>
        <ActionForm action={setAvailabilityAction} className="mt-3">
          <input type="hidden" name="on" value={profile.public_availability ? "false" : "true"} />
          <SubmitButton className={profile.public_availability ? "btn" : "btn btn-primary"}>
            {profile.public_availability ? "Hide my page" : "Publish my availability page"}
          </SubmitButton>
        </ActionForm>
        {profile.public_availability && (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Your page: <Link className="link" href={`/e/${profile.handle}`}>{pageUrl}</Link> · {openSlots} open slot{openSlots === 1 ? "" : "s"}</p>
            <ShareButtons url={pageUrl} linkedinCopy={copy.linkedin} xCopy={copy.x} surface="settings" />
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="pledge-h">
        <div className="flex items-baseline gap-1"><h2 id="pledge-h" className="h2">Pay-it-forward pledges</h2><TermHint slug="pledge" /></div>
        {(pledges.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm muted">No pledges yet. Once someone vouches for you, you&apos;ll be invited to pledge to review for others.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(pledges.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.category_code} · <span className="badge">{p.status}</span>{p.remind_on && ` · reminder ${fmtDate(p.remind_on)}`}</span>
                {(p.status === "pending" || p.status === "reminded") && (
                  <ActionForm action={declinePledgeAction}><input type="hidden" name="pledge_id" value={p.id} />
                    <SubmitButton className="btn btn-sm">Withdraw pledge</SubmitButton></ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={createPledgeAction} className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="pledge-cat">Pledge to review in</label>
            <select id="pledge-cat" name="category" className="input">{categories.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
          </div>
          <SubmitButton className="btn">Pledge</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
