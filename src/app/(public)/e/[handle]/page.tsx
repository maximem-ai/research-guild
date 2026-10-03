import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/ShareButtons";
import { TrackRecord, type TrackRow } from "@/components/TrackRecord";
import { SITE_URL, SUPABASE_URL } from "@/lib/env";
import { BADGE_LABEL } from "@/lib/format";
import { fetchHfCounts } from "@/lib/huggingface";
import { availabilityCopy } from "@/lib/share";
import { getPublicProfile } from "./data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const r = await getPublicProfile(handle);
  if (!r) return { title: "Not found", robots: { index: false } };
  const cats = r.profile.capabilities.map((c) => c.category).join(", ");
  const title = `${r.profile.display_name} — reviewing & endorsing in ${cats || "open science"}`;
  const description = `${r.profile.display_name} gives pre-submission feedback to first-time researchers on ResearchGuild. ${r.profile.open_slots} review slot${r.profile.open_slots === 1 ? "" : "s"} open.`;
  return { title, description, alternates: { canonical: `/e/${r.profile.handle}` }, openGraph: { title, description, type: "profile" } };
}

export default async function AvailabilityPage({ params }: Props) {
  const { handle } = await params;
  const r = await getPublicProfile(handle);
  if (!r) notFound();
  const p = r.profile;
  const url = `${SITE_URL}/e/${p.handle}`;
  const cats = p.capabilities.map((c) => c.category);
  const copy = availabilityCopy({ url, name: p.display_name, categories: cats, openSlots: p.open_slots });
  const hf = p.hf_username ? await fetchHfCounts(p.hf_username) : null;
  const avatar = p.avatar_path ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${p.avatar_path}` : null;
  return (
    <div className="container-page max-w-3xl py-12">
      <div className="flex items-start gap-4">
        {avatar ? <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="h-20 w-20 rounded-full soft" aria-hidden />}
        <div>
          <h1 className="h1">{p.display_name}</h1>
          {p.headline && <p className="mt-1 muted">{p.headline}</p>}
          <p className="mt-2 text-sm">Karma <strong>{p.karma}</strong></p>
        </div>
      </div>
      <div className="card mt-8">
        <p className="text-lg font-serif">
          I&apos;m reviewing &amp; endorsing in <strong>{cats.join(", ") || "—"}</strong> · <strong>{p.open_slots}</strong> slot{p.open_slots === 1 ? "" : "s"} open
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.capabilities.map((c) => (
            <span key={c.category} className={`badge ${c.status === "confirmed" ? "badge-ok" : ""}`}>
              {c.status === "confirmed" ? `Confirmed endorser in ${c.category}` : `${c.category}`}{!c.accepting && " · paused"}
            </span>
          ))}
          {p.badges.map((b) => <span key={b} className="badge badge-accent">{BADGE_LABEL[b] ?? b}</span>)}
        </div>
        {p.topics.length > 0 && <p className="mt-3 text-sm muted">Follows: {p.topics.map((t) => t.name).join(" · ")}</p>}
        <div className="mt-3"><TrackRecord rows={r.track as TrackRow[]} /></div>
        <Link href="/app/papers/new" className="btn btn-primary mt-5">Post your abstract</Link>
        <p className="mt-2 text-xs muted">Endorsers pick abstracts in their categories. Please don&apos;t contact them outside the platform.</p>
      </div>
      {p.bio && <p className="mt-6">{p.bio}</p>}
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {p.google_scholar_url && <a className="link" href={p.google_scholar_url} target="_blank" rel="noopener noreferrer">Google Scholar</a>}
        {p.orcid && <a className="link" href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">ORCID</a>}
        {p.github_username && <a className="link" href={`https://github.com/${p.github_username}`} target="_blank" rel="noopener noreferrer">GitHub</a>}
        {p.hf_username && <a className="link" href={`https://huggingface.co/${p.hf_username}`} target="_blank" rel="noopener noreferrer">Hugging Face{hf ? ` (${hf.models} models · ${hf.datasets} datasets · ${hf.spaces} Spaces)` : ""}</a>}
        {p.homepage_url && <a className="link" href={p.homepage_url} target="_blank" rel="noopener noreferrer">Homepage</a>}
      </p>
      <section className="mt-10">
        <h2 className="h2">Share</h2>
        <div className="mt-3"><ShareButtons url={url} linkedinCopy={copy.linkedin} xCopy={copy.x} surface="availability_page" /></div>
      </section>
    </div>
  );
}
