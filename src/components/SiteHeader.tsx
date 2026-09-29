/**
 * Top bar: app name, signed-in email, Sign Out.
 * Email comes from the root layout (Server Component + getUser()).
 */

import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

type SiteHeaderProps = {
  email: string | null;
};

export function SiteHeader({ email }: SiteHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={email ? "/" : "/login"}
          className="text-sm font-semibold tracking-tight text-teal-800"
        >
          Auto-Recon Agent
        </Link>
        {email ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-slate-600" title={email}>
              {email}
            </span>
            <SignOutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
}
