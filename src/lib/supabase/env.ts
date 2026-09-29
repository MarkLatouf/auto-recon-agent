/**
 * Shared public Supabase settings (URL + anon key).
 * These are safe in the browser because they are already NEXT_PUBLIC_.
 */

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and add your project URL and anon key.",
    );
  }

  return { url, anonKey };
}
