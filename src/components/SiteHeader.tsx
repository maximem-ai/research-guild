import Link from "next/link";
import { APP_NAME } from "@/lib/env";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-serif text-lg font-semibold no-underline">
      <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-sm text-white">EC</span>
      {APP_NAME}
    </Link>
  );
}

/** Static header for public pages (no auth lookup, keeps pages static and fast). */
export function SiteHeader() {
  return (
    <header className="border-b border-theme">
      <nav className="container-page flex h-14 items-center justify-between gap-4" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/learn" className="hover:underline">Learn</Link>
          <Link href="/karma" className="hidden hover:underline sm:inline">Karma</Link>
          <Link href="/about" className="hidden hover:underline sm:inline">About</Link>
          <Link href="/app" className="btn btn-primary btn-sm">Open app</Link>
        </div>
      </nav>
    </header>
  );
}
