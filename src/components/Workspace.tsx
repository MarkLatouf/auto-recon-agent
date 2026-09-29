"use client";

/**
 * Workspace
 *
 * Client shell for `/` (new recon) and `/history` (past sessions).
 * Opening a history row goes to `/?session=<id>` so the dashboard can load it.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReconDashboard } from "@/components/ReconDashboard";
import { SessionHistory } from "@/components/SessionHistory";
import { loadReconSession } from "@/lib/supabase/sessionHistory";
import type { LoadedSession } from "@/lib/types";

type View = "new" | "history";

type WorkspaceProps = {
  initialView: View;
  inspectSessionId?: string | null;
};

export function Workspace({ initialView, inspectSessionId = null }: WorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const view: View = pathname === "/history" ? "history" : initialView;

  const [inspectSession, setInspectSession] = useState<LoadedSession | null>(null);
  const [dashboardKey, setDashboardKey] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openSession = useCallback(async (sessionId: string) => {
    setIsLoadingSession(true);
    setLoadError(null);
    try {
      const loaded = await loadReconSession(sessionId);
      setInspectSession(loaded);
      setDashboardKey((key) => key + 1);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not open that session.");
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    if (!inspectSessionId) {
      setInspectSession(null);
      return;
    }
    void openSession(inspectSessionId);
  }, [inspectSessionId, openSession]);

  const navButtonClass = (active: boolean) =>
    [
      "rounded-md px-3 py-1.5 font-medium",
      active ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-50",
    ].join(" ");

  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Auto-reconciliation
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Bank vs ledger
          </h1>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            <Link href="/" className={navButtonClass(view === "new")}>
              New Reconciliation
            </Link>
            <Link href="/history" className={navButtonClass(view === "history")}>
              Past Sessions
            </Link>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-slate-600">
          {view === "history"
            ? "Open a saved session to inspect its files and matches."
            : inspectSession
              ? "Inspecting a saved session. Upload new CSVs to start a fresh reconciliation."
              : "Upload two CSV files. We parse them in the browser, preview them side by side, then save a session plus both line lists to Supabase."}
        </p>
      </header>

      {loadError ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      {view === "history" ? (
        <SessionHistory
          onSelectSession={(id) => {
            router.push(`/?session=${encodeURIComponent(id)}`);
          }}
          isLoadingSession={isLoadingSession}
        />
      ) : (
        <ReconDashboard key={dashboardKey} inspectSession={inspectSession} />
      )}
    </>
  );
}
