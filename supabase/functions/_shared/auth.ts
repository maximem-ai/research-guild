// Both functions are invoked only by pg_cron (via pg_net) with the service-role key.
export function isServiceCall(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  return Boolean(key) && auth === `Bearer ${key}`;
}

// Minimal service-role REST helpers (no npm dependencies, so functions boot fast and offline).
const URL_ = () => Deno.env.get("SUPABASE_URL")!;
const headers = () => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
};

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_()}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  const res = await fetch(`${URL_()}/storage/v1/object/${bucket}`, {
    method: "DELETE", headers: headers(), body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`storage delete: ${res.status} ${await res.text()}`);
}
