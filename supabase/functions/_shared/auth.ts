// Shared helpers for the Edge Functions. No npm dependencies, so functions boot fast.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.

const URL_ = () => Deno.env.get("SUPABASE_URL")!;
const serviceHeaders = () => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
};

export class RpcError extends Error {}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_()}/rest/v1/rpc/${fn}`, { method: "POST", headers: serviceHeaders(), body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) {
    let message = `${fn} failed (${res.status})`;
    try { message = JSON.parse(text).message ?? message; } catch { /* keep default */ }
    throw new RpcError(message);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function selectOne<T>(table: string, query: string): Promise<T | null> {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}&limit=1`, { headers: serviceHeaders() });
  if (!res.ok) return null;
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  const res = await fetch(`${URL_()}/storage/v1/object/${bucket}`, {
    method: "DELETE", headers: serviceHeaders(), body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`storage delete: ${res.status} ${await res.text()}`);
}

/** pg_cron sends the generated Vault `cron_token` in the x-cron-token header (see invoke_edge_function). */
export async function isCronCall(req: Request): Promise<boolean> {
  const token = req.headers.get("x-cron-token");
  if (!token) return false;
  try { return await rpc<boolean>("check_cron_token", { p_token: token }); } catch { return false; }
}

/** Resolves the signed-in user from the caller's Supabase JWT. */
export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const res = await fetch(`${URL_()}/auth/v1/user`, { headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY")! } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}
