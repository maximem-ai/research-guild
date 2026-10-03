import type { Metadata } from "next";
import { ReadinessCheck } from "@/components/ReadinessCheck";

export const metadata: Metadata = {
  title: "Is my paper ready for arXiv? A free 7-question readiness check",
  description: "Check in two minutes whether your paper is ready to submit to arXiv: paper type, English version, category, endorsement code and more. No sign-in.",
  alternates: { canonical: "/learn/readiness-check" },
};

export default function ReadinessPage() {
  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="h1">arXiv readiness check</h1>
      <p className="mt-3 muted">
        Seven quick questions to see whether your paper is ready to post. No sign-in, and your answers never leave your browser. The same
        check is required before you post an abstract on ResearchGuild.
      </p>
      <div className="mt-8"><ReadinessCheck /></div>
    </div>
  );
}
