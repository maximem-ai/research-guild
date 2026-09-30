import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ProfileSignals } from "@/components/ProfileSignals";
import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { reportAction } from "../../actions";

export default async function MemberProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { supabase, profile: me } = await requireProfile();
  const { data } = await supabase.from("profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!data) notFound();
  const p = data as Profile;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card"><ProfileSignals profile={p} supabaseClient={supabase} /></div>
      {p.id !== me.id && (
        <details className="text-sm">
          <summary className="cursor-pointer muted">Report this profile</summary>
          <ActionForm action={reportAction} className="mt-2 flex gap-2">
            <input type="hidden" name="target_type" value="profile" /><input type="hidden" name="target_id" value={p.id} />
            <input name="reason" className="input" required minLength={3} placeholder="What's the problem?" aria-label="Reason" />
            <SubmitButton className="btn btn-sm">Report</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
