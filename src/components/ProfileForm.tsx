import { TermHint } from "@/components/Term";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveProfileAction } from "@/app/app/actions";
import { MIN_AGE } from "@/lib/env";
import { groupTopics } from "@/lib/reference";
import type { Category, Profile, Topic } from "@/lib/types";

export function ProfileForm({ profile, categories, topics, myCategories, myTopics, suggested }: {
  profile: Profile | null; categories: Category[]; topics: Topic[]; myCategories: string[]; myTopics: number[];
  suggested?: { display_name?: string; handle?: string };
}) {
  const grouped = groupTopics(topics);
  const archives = [...new Set(categories.map((c) => c.archive))];
  return (
    <ActionForm action={saveProfileAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="display_name">Display name *</label>
          <input id="display_name" name="display_name" className="input" required minLength={2} maxLength={80}
            defaultValue={profile?.display_name ?? suggested?.display_name ?? ""} />
          <p className="hint">Use the name on your papers; it&apos;s matched against arXiv author lists.</p>
        </div>
        <div>
          <label className="label" htmlFor="handle">Handle *</label>
          <input id="handle" name="handle" className="input" required pattern="[a-z0-9_]{3,30}"
            defaultValue={profile?.handle ?? suggested?.handle ?? ""} />
          <p className="hint">3–30 lowercase letters, digits or underscores. Used in your public URL.</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="linkedin_url">LinkedIn profile URL *</label>
        <input id="linkedin_url" name="linkedin_url" className="input" required type="url"
          pattern="https://(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?" placeholder="https://www.linkedin.com/in/your-name"
          defaultValue={profile?.linkedin_url ?? ""} />
        <p className="hint">Reviewers check your LinkedIn (and its verified badge) before endorsing. We never scrape it.</p>
      </div>
      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" name="headline" className="input" maxLength={140} placeholder="e.g. MSc student in NLP, Nairobi"
          defaultValue={profile?.headline ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="bio">Short bio</label>
        <textarea id="bio" name="bio" className="input" rows={3} maxLength={600} defaultValue={profile?.bio ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline"><label className="label" htmlFor="google_scholar_url">Google Scholar URL</label><TermHint slug="google-scholar" /></div>
          <input id="google_scholar_url" name="google_scholar_url" className="input" type="url" defaultValue={profile?.google_scholar_url ?? ""} />
        </div>
        <div>
          <div className="flex items-baseline"><label className="label" htmlFor="orcid">ORCID iD</label><TermHint slug="orcid" /></div>
          <input id="orcid" name="orcid" className="input" placeholder="0000-0000-0000-0000" pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dXx]"
            defaultValue={profile?.orcid ?? ""} />
          <p className="hint">Optional. Checked with ORCID&apos;s checksum.</p>
        </div>
        <div>
          <label className="label" htmlFor="hf_username">Hugging Face username</label>
          <input id="hf_username" name="hf_username" className="input" defaultValue={profile?.hf_username ?? ""} />
          <p className="hint">We show your public model, dataset and Space counts.</p>
        </div>
        <div>
          <label className="label" htmlFor="homepage_url">Homepage</label>
          <input id="homepage_url" name="homepage_url" className="input" type="url" defaultValue={profile?.homepage_url ?? ""} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Categories of interest * <span className="font-normal muted">(at least one)</span></legend>
        <p className="hint -mt-1 mb-2">arXiv&apos;s topic labels, like cs.AI or cs.CL. <TermHint slug="category" label="What's a category?" /></p>
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-theme p-3">
          {archives.map((ar) => (
            <div key={ar}>
              <p className="text-xs font-semibold uppercase tracking-wide muted">{ar}</p>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {categories.filter((c) => c.archive === ar).map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categories" value={c.code} defaultChecked={myCategories.includes(c.code)} />
                    <span><strong>{c.code}</strong> {c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Sub-topics you follow</legend>
        <p className="hint mb-2">Used to match abstracts to endorsers. Curated lists exist for the most active categories. <TermHint slug="sub-topic" /></p>
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-theme p-3">
          {[...grouped.entries()].map(([cat, ts]) => (
            <div key={cat}>
              <p className="text-xs font-semibold muted">{cat}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {ts.map((t) => (
                  <label key={t.id} className="badge cursor-pointer gap-1">
                    <input type="checkbox" name="topics" value={t.id} defaultChecked={myTopics.includes(t.id)} /> {t.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {!profile && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="age_confirmed" required className="mt-1" />
            <span>I am at least {MIN_AGE} years old and agree to the community terms.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="wants_to_endorse" className="mt-1" />
            <span>I also want to endorse: I&apos;m an arXiv author and may be eligible to endorse in my field.</span>
          </label>
        </div>
      )}
      <SubmitButton>{profile ? "Save profile" : "Create my profile"}</SubmitButton>
    </ActionForm>
  );
}
