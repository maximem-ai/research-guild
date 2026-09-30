import type { SupabaseClient } from "@supabase/supabase-js";
import { TrackRecord, type TrackRow } from "@/components/TrackRecord";
import { SUPABASE_URL } from "@/lib/env";
import { BADGE_LABEL } from "@/lib/format";
import { fetchHfCounts } from "@/lib/huggingface";
import type { Profile } from "@/lib/types";

/** Identity & trust signals for a member: links, OpenAlex publications, Hugging Face counts, endorser record. */
export async function ProfileSignals({ profile, supabaseClient, compact }: { profile: Profile; supabaseClient: SupabaseClient; compact?: boolean }) {
  const [pubs, caps, badges, track, hf] = await Promise.all([
    supabaseClient.from("profile_publications").select("id, title, venue, year, url").eq("user_id", profile.id).order("year", { ascending: false }).limit(compact ? 3 : 10),
    supabaseClient.from("endorser_capabilities").select("category_code, status, evidence_url").eq("user_id", profile.id),
    supabaseClient.from("badges").select("badge").eq("user_id", profile.id),
    supabaseClient.from("endorser_track_record").select("*").eq("endorser_id", profile.id),
    profile.hf_username ? fetchHfCounts(profile.hf_username) : Promise.resolve(null),
  ]);
  const avatar = profile.avatar_path ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_path}` : null;
  const links: [string, string | null][] = [
    ["LinkedIn", profile.linkedin_url],
    ["Google Scholar", profile.google_scholar_url],
    ["ORCID", profile.orcid ? `https://orcid.org/${profile.orcid}` : null],
    ["OpenAlex", profile.openalex_author_id ? `https://openalex.org/${profile.openalex_author_id}` : null],
    ["GitHub", profile.github_username ? `https://github.com/${profile.github_username}` : null],
    ["Hugging Face", profile.hf_username ? `https://huggingface.co/${profile.hf_username}` : null],
    ["Homepage", profile.homepage_url],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {avatar ? <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 shrink-0 rounded-full soft" aria-hidden />}
        <div>
          <p className="font-semibold">{profile.display_name} <span className="text-sm font-normal muted">@{profile.handle} · karma {profile.karma}</span></p>
          {profile.headline && <p className="text-sm muted">{profile.headline}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {(badges.data ?? []).map((b) => <span key={b.badge} className="badge badge-accent">{BADGE_LABEL[b.badge] ?? b.badge}</span>)}
          </div>
        </div>
      </div>
      {!compact && profile.bio && <p className="text-sm">{profile.bio}</p>}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {links.filter(([, u]) => u).map(([label, u]) => <a key={label} className="link" href={u!} target="_blank" rel="noopener noreferrer">{label}</a>)}
      </p>
      {hf && <p className="text-xs muted">Hugging Face: {hf.models} models · {hf.datasets} datasets · {hf.spaces} Spaces</p>}
      {(caps.data ?? []).length > 0 && (
        <div className="text-xs">
          {(caps.data ?? []).map((c) => (
            <span key={c.category_code} className="mr-2">{c.status === "confirmed" ? `Confirmed endorser in ${c.category_code}` : `${c.category_code} (${c.status})`}{" "}
              <a className="link" href={c.evidence_url} target="_blank" rel="noopener noreferrer">evidence</a></span>
          ))}
          <div className="mt-1"><TrackRecord rows={(track.data ?? []) as TrackRow[]} /></div>
        </div>
      )}
      {(pubs.data ?? []).length > 0 && (
        <div>
          <p className="text-xs muted">Past papers — from OpenAlex; user-selected</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {(pubs.data ?? []).map((p) => <li key={p.id}>{p.url ? <a className="link" href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a> : p.title} <span className="muted">{[p.venue, p.year].filter(Boolean).join(", ")}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
