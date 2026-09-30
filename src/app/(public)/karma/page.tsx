import type { Metadata } from "next";
import Link from "next/link";
import { supabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Karma — how helping newcomers is recognized",
  description: "How karma works on Endorse Commons, the per-category leaderboards, and why endorsing and declining earn the same points.",
  alternates: { canonical: "/karma" },
};
export const dynamic = "force-dynamic";

const RULES: [string, string, string][] = [
  ["Responded to a nudge (accept or pass) within 72 h", "+1", "endorser"],
  ["Feedback round sent (max 3 counted per engagement)", "+3", "endorser"],
  ["Feedback rated helpful by the author", "+2", "endorser"],
  ["Decision recorded — endorse or decline, same points", "+3", "endorser"],
  ["Endorsed paper verified posted on arXiv in the endorsed category", "+5", "endorser"],
  ["Pay-it-forward pledge fulfilled (once)", "+5", "former author"],
  ["Rated a reviewer's feedback", "+1", "author"],
  ["Engagement expired while reviewing (ghosting)", "−3", "endorser"],
  ["Endorsed paper later removed/reclassified (moderator-set)", "−10", "endorser"],
];

const BADGES: [string, string][] = [
  ["First review", "Sent your first feedback round."],
  ["10 reviews", "Gave feedback on ten papers."],
  ["Confirmed endorser", "A paper you endorsed was verified as posted on arXiv in that category."],
  ["Pay-it-forward", "Fulfilled your pledge to review for others after being endorsed."],
];

type Row = { user_id: string; points: number };

async function leaderboard(period: string, category: string) {
  if (!supabaseConfigured()) return { rows: [] as (Row & { name: string; handle: string | null })[], cats: [] as string[] };
  const sb = createAnonClient();
  const [{ data: rows }, { data: catRows }] = await Promise.all([
    sb.from("karma_leaderboard").select("user_id, points").eq("period", period).eq("category_code", category)
      .order("points", { ascending: false }).limit(25),
    sb.from("karma_leaderboard").select("category_code").neq("category_code", "*").limit(1000),
  ]);
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await sb.from("public_profiles").select("id, handle, display_name").in("id", ids)
    : { data: [] as { id: string; handle: string; display_name: string }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    rows: (rows ?? []).map((r) => ({ ...r, name: byId.get(r.user_id)?.display_name ?? "A community member", handle: byId.get(r.user_id)?.handle ?? null })),
    cats: [...new Set((catRows ?? []).map((c) => c.category_code as string))].sort(),
  };
}

export default async function KarmaPage({ searchParams }: { searchParams: Promise<{ period?: string; category?: string }> }) {
  const sp = await searchParams;
  const period = sp.period === "month" ? "month" : "all_time";
  const category = sp.category && /^[a-zA-Z.\-*]+$/.test(sp.category) ? sp.category : "*";
  const { rows, cats } = await leaderboard(period, category);
  const q = (p: string, c: string) => `/karma?period=${p}&category=${encodeURIComponent(c)}`;

  return (
    <div className="container-page max-w-4xl py-12">
      <h1 className="h1">Karma</h1>
      <p className="mt-4 max-w-2xl muted">
        Karma makes the unpaid work of helping newcomers visible and portable. It is an append-only ledger. It has <strong>no monetary
        value and can&apos;t be transferred or redeemed</strong>.
      </p>
      <p className="mt-3 max-w-2xl muted">
        Karma never makes &ldquo;yes&rdquo; more rewarding than &ldquo;no&rdquo;: recording a decision earns the same points whether you
        endorse or decline. There is no karma between users who are co-authors, and mutual-endorsement pairs are flagged for moderators.
      </p>

      <h2 className="h2 mt-10">How points are earned</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-theme text-left"><th className="py-2 pr-4">Event</th><th className="py-2 pr-4">Points</th><th className="py-2">To</th></tr></thead>
          <tbody>
            {RULES.map(([e, p, to]) => (
              <tr key={e} className="border-b border-theme"><td className="py-2 pr-4">{e}</td><td className="py-2 pr-4 font-semibold">{p}</td><td className="py-2 muted">{to}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h2 mt-10">Badges</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {BADGES.map(([b, d]) => (<li key={b} className="card"><span className="badge badge-accent">{b}</span><p className="mt-2 text-sm muted">{d}</p></li>))}
      </ul>

      <h2 className="h2 mt-10">Leaderboard</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Link className={`btn btn-sm ${period === "all_time" ? "btn-primary" : ""}`} href={q("all_time", category)}>All time</Link>
        <Link className={`btn btn-sm ${period === "month" ? "btn-primary" : ""}`} href={q("month", category)}>This month</Link>
        <span className="mx-2 muted">|</span>
        <Link className={`btn btn-sm ${category === "*" ? "btn-primary" : ""}`} href={q(period, "*")}>All categories</Link>
        {cats.map((c) => (
          <Link key={c} className={`btn btn-sm ${category === c ? "btn-primary" : ""}`} href={q(period, c)}>{c}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm muted">No karma yet for this view. Leaderboards refresh daily.</p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--border)] card p-0">
          {rows.map((r, i) => (
            <li key={r.user_id} className="flex items-center justify-between px-5 py-3">
              <span><span className="mr-3 muted">#{i + 1}</span>{r.handle ? <Link className="link" href={`/e/${r.handle}`}>{r.name}</Link> : r.name}</span>
              <span className="font-semibold">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs muted">Names are shown only for endorsers who have a public availability page. Leaderboards refresh daily.</p>
    </div>
  );
}
