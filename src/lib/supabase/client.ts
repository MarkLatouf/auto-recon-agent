/**
 * Browser-side Supabase client.
 *
 * `createBrowserClient` is safe in Client Components: it uses the public
 * anon key and stores the Auth session in cookies (via @supabase/ssr).
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
