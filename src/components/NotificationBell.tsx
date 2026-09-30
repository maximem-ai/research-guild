"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Unread count with a Realtime subscription to the user's own notifications. */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => setUnread((n) => n + 1))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async () => {
          const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
          setUnread(count ?? 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
  return (
    <Link href="/app/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--soft)]"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-accent-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
