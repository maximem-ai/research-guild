import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && ANON && SERVICE);

export const admin = () => createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

export type TestUser = { id: string; email: string; password: string; handle: string; client: SupabaseClient };

let counter = 0;
/** Creates an auth user with a password (local e2e only) and a signed-in supabase-js client. */
export async function createUser(prefix: string): Promise<TestUser> {
  const n = `${Date.now().toString(36)}${counter++}`;
  const handle = `${prefix}_${n}`.slice(0, 30).toLowerCase();
  const email = `${handle}@e2e.test`;
  const password = `pw-${n}-Secure!`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: prefix } });
  if (error) throw error;
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user!.id, email, password, handle, client };
}

export async function rpc<T = unknown>(c: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function makeProfile(u: TestUser, name: string, endorse: string[] = []) {
  const { data: topics } = await u.client.from("topics").select("id").eq("category_code", "cs.AI").limit(2);
  await rpc(u.client, "upsert_profile", {
    p_handle: u.handle, p_display_name: name, p_linkedin_url: `https://www.linkedin.com/in/${u.handle.replace(/_/g, "-")}`,
    p_category_codes: ["cs.AI"], p_topic_ids: (topics ?? []).map((t) => t.id), p_age_confirmed: true,
  });
  for (const c of endorse) await rpc(u.client, "attest_capability", { p_category: c, p_evidence_url: "https://arxiv.org/auth/show-endorsers/2401.00001" });
}

export async function postPaper(u: TestUser, title: string) {
  const { data: topics } = await u.client.from("topics").select("id").eq("category_code", "cs.AI").limit(1);
  const id = await rpc<string>(u.client, "create_paper_draft", {
    p_title: title, p_abstract: "We study a problem carefully and report results. ".repeat(6), p_primary_category: "cs.AI",
    p_cross_list: [], p_paper_type: "original_research", p_own_work: true, p_topic_ids: (topics ?? []).map((t) => t.id),
  });
  await rpc(u.client, "submit_readiness_check", { p_paper: id, p_answers: { paper_type: "original_research", english_complete: true,
    draft_finished: true, primary_category: "cs.AI", own_work: true, has_endorsement_code: true, no_mass_asking: true } });
  await rpc(u.client, "post_abstract", { p_paper: id });
  return id;
}

export const TINY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
  "3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

export async function uploadPdf(u: TestUser, paperId: string) {
  const path = `${paperId}/${crypto.randomUUID().replace(/-/g, "")}.pdf`;
  const { error } = await u.client.storage.from("papers").upload(path, TINY_PDF, { contentType: "application/pdf" });
  if (error) throw error;
  const sha = await crypto.subtle.digest("SHA-256", TINY_PDF);
  return rpc<string>(u.client, "upload_version", { p_paper: paperId, p_storage_path: path,
    p_sha256: [...new Uint8Array(sha)].map((b) => b.toString(16).padStart(2, "0")).join(""), p_size_bytes: TINY_PDF.length });
}

/** Puts the user's Supabase session cookies (as @supabase/ssr writes them) into the browser context. */
export async function signInBrowser(context: BrowserContext, u: TestUser, baseURL: string) {
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(SUPABASE_URL, ANON, {
    cookies: { getAll: () => jar, setAll: (list) => list.forEach(({ name, value }) => {
      const i = jar.findIndex((c) => c.name === name);
      if (i >= 0) jar.splice(i, 1);
      if (value) jar.push({ name, value });
    }) },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw error;
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL })));
}

export async function setConfig(key: string, value: unknown) {
  const { error } = await admin().from("platform_config").update({ value }).eq("key", key);
  if (error) throw error;
}

export function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % chars.length]).join("");
}
