import type { Metadata } from "next";
import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { SiteFooter } from "@/components/SiteFooter";
import { Logo } from "@/components/SiteHeader";
import { getMyProfile } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getMyProfile();
  let unread = 0;
  if (profile) {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }
  return (
    <>
      <header className="border-b border-theme">
        <nav className="container-page flex min-h-14 flex-wrap items-center justify-between gap-3 py-2" aria-label="App">
          <Logo />
          {profile ? (
            <div className="flex flex-wrap items-center gap-1 text-sm sm:gap-3">
              <Link href="/app" className="rounded px-2 py-1 hover:bg-[var(--soft)]">Dashboard</Link>
              <Link href="/app/papers" className="rounded px-2 py-1 hover:bg-[var(--soft)]">My papers</Link>
              <Link href="/app/feed" className="rounded px-2 py-1 hover:bg-[var(--soft)]">Feed</Link>
              <Link href="/app/reviews" className="rounded px-2 py-1 hover:bg-[var(--soft)]">Reviews</Link>
              <Link href="/learn" className="rounded px-2 py-1 hover:bg-[var(--soft)]">Learn</Link>
              {profile.role === "moderator" && <Link href="/app/admin" className="rounded px-2 py-1 hover:bg-[var(--soft)]">Admin</Link>}
              <NotificationBell userId={profile.id} initialUnread={unread} />
              <Link href="/app/settings" className="rounded px-2 py-1 hover:bg-[var(--soft)]" title="Settings">@{profile.handle}</Link>
              <form action="/auth/signout" method="post"><button className="rounded px-2 py-1 text-sm muted hover:bg-[var(--soft)]">Sign out</button></form>
            </div>
          ) : user ? (
            <form action="/auth/signout" method="post"><button className="btn btn-sm">Sign out</button></form>
          ) : null}
        </nav>
      </header>
      <main id="main" className="container-page flex-1 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}
