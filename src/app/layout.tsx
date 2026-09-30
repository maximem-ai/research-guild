import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME, SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} — feedback and fair access for first-time researchers`, template: `%s · ${APP_NAME}` },
  description:
    "A free, open-source community that helps first-time researchers learn how open science works, get honest feedback from people who have published, and find someone willing to vouch for their work.",
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
