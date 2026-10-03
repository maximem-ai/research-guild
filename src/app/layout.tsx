import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME, SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME}: feedback before publishing, endorsement for your first paper`, template: `%s · ${APP_NAME}` },
  description:
    "Get honest feedback on your paper before publishing, and find someone to endorse you for your first paper in a domain. Free and open source, with a sign-in-free arXiv learning center.",
  openGraph: { siteName: APP_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 btn">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
