import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { reportAction, sendFeedbackAction } from "@/app/app/actions";
import { fmtDateTime } from "@/lib/format";
import type { FeedbackMessage, PaperVersion } from "@/lib/types";

export function FeedbackThread({ engagementId, paperId, messages, names, meId, canPost, versions, placeholder }: {
  engagementId: string; paperId: string; messages: FeedbackMessage[]; names: Record<string, string>; meId: string;
  canPost: boolean; versions: PaperVersion[]; placeholder: string;
}) {
  const vno = new Map(versions.map((v) => [v.id, v.version_no]));
  return (
    <div className="space-y-3">
      {messages.length === 0 && <p className="text-sm muted">No messages yet.</p>}
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`rounded-lg border border-theme p-3 ${m.sender_id === meId ? "soft" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs muted">
              <span><strong className="text-[var(--fg)]">{names[m.sender_id] ?? "Member"}</strong> · round {m.round}
                {m.paper_version_id && vno.get(m.paper_version_id) ? ` · about v${vno.get(m.paper_version_id)}` : ""}</span>
              <span>{fmtDateTime(m.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
            {m.sender_id !== meId && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer muted">Report</summary>
                <ActionForm action={reportAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="target_type" value="message" />
                  <input type="hidden" name="target_id" value={m.id} />
                  <input name="reason" className="input" placeholder="What's wrong with this message?" required minLength={3} aria-label="Reason" />
                  <SubmitButton className="btn btn-sm">Send</SubmitButton>
                </ActionForm>
              </details>
            )}
          </li>
        ))}
      </ol>
      {canPost && (
        <ActionForm action={sendFeedbackAction} className="space-y-2" resetOnSuccess>
          <input type="hidden" name="engagement_id" value={engagementId} />
          <input type="hidden" name="paper_id" value={paperId} />
          <label htmlFor={`fb-${engagementId}`} className="sr-only">Message</label>
          <textarea id={`fb-${engagementId}`} name="body" className="input" rows={4} maxLength={8000} required placeholder={placeholder} />
          <div className="flex flex-wrap items-center gap-2">
            {versions.length > 0 && (
              <select name="version_id" className="input w-auto text-xs" aria-label="About version" defaultValue={versions[0]?.id}>
                <option value="">General</option>
                {versions.map((v) => <option key={v.id} value={v.id}>About v{v.version_no}</option>)}
              </select>
            )}
            <SubmitButton className="btn btn-primary btn-sm">Send</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
