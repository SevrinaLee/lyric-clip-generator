import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS — for trusted server-only contexts
 * with no user session to check against, like the Stripe webhook (a
 * signature-verified server-to-server call, not a user request). Never
 * import this into anything reachable from a user request without its own
 * authorization check first; there's no RLS safety net here.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
