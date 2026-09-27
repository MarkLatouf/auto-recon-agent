/**
 * Browser-side Supabase client.
 *
 * `createBrowserClient` is safe to use in Client Components because it uses
 * the public "anon" key, not the secret service-role key.
 * Every insert in persistRecon.ts goes through this helper.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and add your project URL and anon key.",
    );
  }

  return createBrowserClient(url, anonKey);
}
