import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Local Worker / scripts only.
 * MUST NOT be imported from `app/**` (Admin uses cookie session).
 * Requires SUPABASE_SERVICE_ROLE_KEY in `.env.local` (do not deploy to Vercel).
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) {
    throw new Error(
      "createSupabaseServiceClient: NEXT_PUBLIC_SUPABASE_URL is required"
    );
  }
  if (!key) {
    throw new Error(
      "createSupabaseServiceClient: SUPABASE_SERVICE_ROLE_KEY is required (Worker/scripts only; do not put on Vercel)"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
