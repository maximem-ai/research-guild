import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionState } from "@/components/ActionForm";

type PgError = { message: string; code?: string; details?: string | null } | null;

const CONSTRAINT_MESSAGES: [RegExp, string][] = [
  [/papers_title_check/, "Title must be 10–300 characters."],
  [/papers_abstract_check/, "Abstract must be 200–2500 characters."],
  [/cs_survey_needs_proof/, "arXiv CS only accepts review/survey and position papers that already passed peer review. Add a peer-review proof URL or DOI."],
  [/profiles_linkedin_url_check/, "Use your LinkedIn profile URL, like https://www.linkedin.com/in/your-name"],
  [/profiles_handle_check/, "Handles are 3–30 lowercase letters, digits or underscores."],
  [/profiles_display_name_check/, "Display name must be 2–80 characters."],
  [/profiles_bio_check/, "Bio must be 600 characters or fewer."],
  [/profiles_headline_check/, "Headline must be 140 characters or fewer."],
  [/profiles_google_scholar_url_check/, "Google Scholar links start with https://scholar.google."],
  [/profiles_hf_username_check/, "That doesn't look like a Hugging Face username."],
  [/profiles_homepage_url_check/, "Homepage must start with http:// or https://"],
  [/feedback_messages_body_check/, "Messages must be 1–8000 characters."],
  [/cross_list_max/, "At most 5 cross-list categories."],
  [/reports_reason_check/, "Please describe the problem (3–2000 characters)."],
];

export function friendlyError(error: PgError): string {
  if (!error) return "Something went wrong.";
  for (const [re, msg] of CONSTRAINT_MESSAGES) if (re.test(error.message)) return msg;
  if (error.code === "P0001" || error.code === "28000") return error.message;
  if (error.code === "42501") return "You don't have permission to do that.";
  return "Something went wrong. Please try again.";
}

export class ActionError extends Error {}

export async function rpc<T = unknown>(supabase: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ActionError(friendlyError(error));
  return data as T;
}

/** Wraps an action body so thrown ActionErrors become an inline error message. Redirects propagate. */
export async function run(fn: () => Promise<string | void | ActionState>): Promise<ActionState> {
  try {
    const r = await fn();
    if (typeof r === "string") return { ok: r };
    return r ?? { ok: "Saved." };
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e; // includes Next's redirect/notFound signals
  }
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
