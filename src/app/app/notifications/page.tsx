import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { requireProfile } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { notificationHref, notificationText, type NotificationRow } from "@/lib/notifications";
import { markAllReadAction } from "../actions";

export default async function Notifications() {
  const { supabase, profile } = await requireProfile();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  const { data: mine } = await supabase.from("engagements").select("id").eq("endorser_id", profile.id);
  const myEngagements = new Set((mine ?? []).map((e) => e.id as string));
  const unread = rows.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Notifications</h1>
        {unread > 0 && <ActionForm action={markAllReadAction}><SubmitButton className="btn btn-sm">Mark all read</SubmitButton></ActionForm>}
      </div>
      <p className="mt-2 text-sm muted">In-app only. We never send email.</p>
      {rows.length === 0 ? <p className="card mt-6 text-sm muted">Nothing yet.</p> : (
        <ul className="card mt-6 divide-y divide-[var(--border)] p-0">
          {rows.map((n) => (
            <li key={n.id} className={`px-5 py-3 ${n.read_at ? "" : "soft"}`}>
              <Link href={notificationHref(n, myEngagements)} className="block no-underline">
                <p className="text-sm">{!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--brand-orange)]" aria-label="unread" />}{notificationText(n)}</p>
                <p className="text-xs muted">{fmtDateTime(n.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
