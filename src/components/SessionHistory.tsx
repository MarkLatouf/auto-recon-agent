"use client";

/**
 * SessionHistory
 *
 * Lists recon_sessions (newest first). Clicking a row asks the parent to
 * load that session’s lines and matches into the dashboard.
 */

import { useEffect, useState } from "react";
import { listReconSessions } from "@/lib/supabase/sessionHistory";
import type { SessionSummary } from "@/lib/types";

type SessionHistoryProps = {
  onSelectSession: (sessionId: string) => void;
  isLoadingSession: boolean;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function SessionHistory({ onSelectSession, isLoadingSession }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setError(null);
      try {
        const rows = await listReconSessions();
        if (!cancelled) {
          setSessions(rows);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load sessions.");
          setStatus("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <p className="text-sm text-slate-500">Loading past sessions…</p>;
  }

  if (status === "error") {
    return (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        No saved sessions yet. Run a new reconciliation and save matches first.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600">Created</th>
            <th className="px-4 py-3 font-medium text-slate-600">Session ID</th>
            <th className="px-4 py-3 font-medium text-slate-600">Bank file</th>
            <th className="px-4 py-3 font-medium text-slate-600">Ledger file</th>
            <th className="px-4 py-3 font-medium text-slate-600">Saved matches</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.id}
              tabIndex={0}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 focus:bg-teal-50 focus:outline-none"
              onClick={() => {
                if (!isLoadingSession) onSelectSession(session.id);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isLoadingSession) {
                  event.preventDefault();
                  onSelectSession(session.id);
                }
              }}
            >
              <td className="px-4 py-3 text-slate-700">{formatWhen(session.createdAt)}</td>
              <td className="px-4 py-3 font-mono text-xs text-teal-800">{session.id}</td>
              <td className="px-4 py-3 text-slate-800">{session.bankFilename}</td>
              <td className="px-4 py-3 text-slate-800">{session.ledgerFilename}</td>
              <td className="px-4 py-3 text-slate-800">{session.matchCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isLoadingSession ? (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          Opening session…
        </p>
      ) : (
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Click a session ID to inspect its bank lines, ledger lines, and saved matches.
        </p>
      )}
    </div>
  );
}
