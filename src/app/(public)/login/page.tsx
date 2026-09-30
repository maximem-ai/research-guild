import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, MIN_AGE } from "@/lib/env";
import { signInWith } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const PROVIDERS = [
  { id: "linkedin_oidc", label: "Continue with LinkedIn" },
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="container-page max-w-md py-16">
      <h1 className="h1">Sign in to {APP_NAME}</h1>
      <p className="mt-3 text-sm muted">
        We use your existing account; there are no passwords and we never send email. The learning center is free without signing in.
      </p>
      {error && <p role="alert" className="alert alert-error mt-4">Sign-in failed. Please try again.</p>}
      <div className="mt-6 space-y-3">
        {PROVIDERS.map((p) => (
          <form key={p.id} action={signInWith}>
            <input type="hidden" name="provider" value={p.id} />
            <input type="hidden" name="next" value={next ?? "/app"} />
            <button type="submit" className="btn w-full py-3">{p.label}</button>
          </form>
        ))}
      </div>
      <p className="mt-6 text-xs muted">
        You must be at least {MIN_AGE} years old to join. By continuing you agree to our <Link href="/terms" className="link">terms</Link> and{" "}
        <Link href="/privacy" className="link">privacy promise</Link>. Hugging Face users can add their username to their profile after signing in.
      </p>
    </div>
  );
}
