"use client";

/**
 * SessionHistory
 *
 * Lists recon_sessions (newest first). Clicking a row asks the parent to
 * load that session’s lines and matches into the dashboard.
 */

import { useEffect, useMemo, useState } from "react";
import { exportMatchedCsv } from "@/lib/exportMatchedCsv";
import { listReconSessions, loadSessionMatchesForExport } from "@/lib/supabase/sessionHistory";
import type { SessionSummary } from "@/lib/types";

type SessionHistoryProps = {
  onSelectSession: (sessionId: string) => void;
  isLoadingSession: boolean;
};

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.19L6.99 8.68a.75.75 0 0 0-1.06 1.06l3.54 3.54a.75.75 0 0 0 1.06 0l3.54-3.54a.75.75 0 1 0-1.06-1.06l-2.26 2.26V2.75Z" />
      <path d="M3.5 14.75a.75.75 0 0 0 0 1.5h13a.75.75 0 0 0 0-1.5h-13Z" />
    </svg>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

type SessionSort = "date-newest" | "date-oldest" | "matches-high" | "matches-low";

export function SessionHistory({ onSelectSession, isLoadingSession }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SessionSort>("date-newest");

  const filteredAndSortedSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = sessions.filter((session) => {
      if (!query) return true;
      return (
        session.bankFilename.toLowerCase().includes(query) ||
        session.ledgerFilename.toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === "date-newest") {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (sortOption === "date-oldest") {
        return a.createdAt.localeCompare(b.createdAt);
      }
      if (sortOption === "matches-high") {
        return b.matchCount - a.matchCount;
      }
      return a.matchCount - b.matchCount;
    });
  }, [sessions, searchQuery, sortOption]);

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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Past sessions</h3>
          <p className="text-xs text-slate-500">
            Showing {filteredAndSortedSessions.length} of {sessions.length}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="session-search">
            Search by filename
          </label>
          <input
            id="session-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search bank or ledger filename…"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 sm:flex-none sm:w-72"
          />
          <label className="sr-only" htmlFor="session-sort">
            Sort sessions
          </label>
          <select
            id="session-sort"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SessionSort)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
          >
            <option value="date-newest">Date (Newest First)</option>
            <option value="date-oldest">Date (Oldest First)</option>
            <option value="matches-high">Matches (High to Low)</option>
            <option value="matches-low">Matches (Low to High)</option>
          </select>
        </div>
      </div>
      {filteredAndSortedSessions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No sessions match this filename search.</p>
      ) : (
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600">Created</th>
            <th className="px-4 py-3 font-medium text-slate-600">Session ID</th>
            <th className="px-4 py-3 font-medium text-slate-600">Bank file</th>
            <th className="px-4 py-3 font-medium text-slate-600">Ledger file</th>
            <th className="px-4 py-3 font-medium text-slate-600">Saved matches</th>
            <th className="px-4 py-3 font-medium text-slate-600">
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedSessions.map((session) => (
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
              <td className="px-4 py-3">
                <button
                  type="button"
                  title="Download CSV"
                  aria-label={`Download CSV for session ${session.id}`}
                  disabled={session.matchCount === 0 || downloadingId === session.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void (async () => {
                      setDownloadError(null);
                      setDownloadingId(session.id);
                      try {
                        const pairs = await loadSessionMatchesForExport(session.id);
                        if (pairs.length === 0) {
                          throw new Error("This session has no saved matches to export.");
                        }
                        exportMatchedCsv(pairs);
                      } catch (err) {
                        setDownloadError(
                          err instanceof Error ? err.message : "Could not download CSV.",
                        );
                      } finally {
                        setDownloadingId(null);
                      }
                    })();
                  }}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-white hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <DownloadIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {downloadError ? (
        <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {downloadError}
        </p>
      ) : null}
      {isLoadingSession ? (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          Opening session…
        </p>
      ) : (
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Click a row to inspect a session. Use the download icon to export saved matches without opening it.
        </p>
      )}
    </div>
  );
}
