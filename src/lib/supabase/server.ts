/**
 * Server-side Supabase client (Server Components, Route Handlers, Server Actions).
 *
 * `createServerClient` from @supabase/ssr reads the Auth cookies on this
 * request so `auth.getUser()` matches whoever is signed in in the browser.
 * The secret service-role key is still not used here.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createServerSupabase() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot always write cookies; middleware does that
        // after a token refresh. Ignore the error so pages can still read the user.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* middleware refreshes the session cookies instead */
        }
      },
    },
  });
}
