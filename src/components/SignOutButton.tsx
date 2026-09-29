"use client";

/**
 * Sign-out control. Clears the Auth cookies, then sends the user to /login.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => {
        void (async () => {
          setIsBusy(true);
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
        })();
      }}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {isBusy ? "Signing out…" : "Sign Out"}
    </button>
  );
}
