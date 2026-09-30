import Link from "next/link";
import { APP_NAME, GITHUB_URL } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-theme">
      <div className="container-page space-y-4 py-8 text-sm muted">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/learn" className="hover:underline">Learning center</Link>
          <Link href="/learn/readiness-check" className="hover:underline">Readiness check</Link>
          <Link href="/karma" className="hover:underline">Karma</Link>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
        </nav>
        <p>
          {APP_NAME} is an independent community project. It is not affiliated with, endorsed by, or operated by arXiv or Cornell University.
        </p>
        <p>
          Thank you to arXiv for use of its open access interoperability. This service was not reviewed or approved by, nor does it
          necessarily express or reflect the policies or opinions of, arXiv.
        </p>
        <p>
          Built and maintained by the team at{" "}
          <a href="https://maximem.ai" className="link" target="_blank" rel="noopener noreferrer">Maximem</a> ·{" "}
          <a href={GITHUB_URL} className="link" target="_blank" rel="noopener noreferrer">Open source on GitHub</a>
        </p>
      </div>
    </footer>
  );
}
