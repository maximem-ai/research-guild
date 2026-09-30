// Both functions are invoked only by pg_cron (via pg_net) with the service-role key.
export function isServiceCall(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  return Boolean(key) && auth === `Bearer ${key}`;
}
