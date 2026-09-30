import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getMyProfile } from "@/lib/auth";
import { loadReference } from "@/lib/reference";
import { suggestHandle } from "@/lib/validators";

export default async function Onboarding() {
  const { supabase, user, profile } = await getMyProfile();
  if (!user) redirect("/login");
  if (profile) redirect("/app");
  const { categories, topics } = await loadReference(supabase);
  const meta = user.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? "");
  const handle = suggestHandle(String(meta.user_name ?? meta.preferred_username ?? name));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">Welcome! Set up your profile</h1>
      <p className="mt-3 muted">
        Anyone can be both an author (on their own papers) and an endorser (on others&apos;). Tell us who you are and what you work on.
        All communication stays inside in-app threads; there are no private DMs.
      </p>
      <div className="card mt-6">
        <ProfileForm profile={null} categories={categories} topics={topics} myCategories={[]} myTopics={[]}
          suggested={{ display_name: name, handle }} />
      </div>
    </div>
  );
}
