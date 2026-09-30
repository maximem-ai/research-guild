import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page flex-1 py-20">
        <h1 className="h1">Page not found</h1>
        <p className="mt-3 muted">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link href="/" className="btn mt-6">Go home</Link>
      </main>
      <SiteFooter />
    </>
  );
}
