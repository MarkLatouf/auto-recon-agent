"use client";

/**
 * ReconDashboard
 *
 * Holds the two parsed CSVs in React state and:
 * 1) shows two upload dropzones
 * 2) previews both tables
 * 3) when both files are ready, inserts a recon_sessions row plus line rows
 *
 * 4) Auto-Match loads those rows and runs Tier 1 + Tier 2 pairing
 */

import { useCallback, useState } from "react";
import type { MatchResult, ParsedCsv } from "@/lib/types";
import { autoMatch } from "@/lib/recon/matching";
import { loadSessionLines } from "@/lib/supabase/loadSessionLines";
import { persistReconUpload } from "@/lib/supabase/persistRecon";
import { CsvTable } from "./CsvTable";
import { FileDropzone } from "./FileDropzone";
import { MatchResults } from "./MatchResults";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; sessionId: string; bankCount: number; ledgerCount: number }
  | { status: "error"; message: string };

type MatchUiState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: MatchResult }
  | { status: "error"; message: string };

export function ReconDashboard() {
  const [bank, setBank] = useState<ParsedCsv | null>(null);
  const [ledger, setLedger] = useState<ParsedCsv | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [matchState, setMatchState] = useState<MatchUiState>({ status: "idle" });

  const saveToSupabase = useCallback(async (nextBank: ParsedCsv, nextLedger: ParsedCsv) => {
    setSaveState({ status: "saving" });
    setMatchState({ status: "idle" });
    try {
      const result = await persistReconUpload(nextBank, nextLedger);
      setSaveState({ status: "saved", ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save to Supabase.";
      setSaveState({ status: "error", message });
    }
  }, []);

  const runAutoMatch = useCallback(async (sessionId: string) => {
    setMatchState({ status: "running" });
    try {
      const { bankLines, ledgerLines } = await loadSessionLines(sessionId);
      setMatchState({ status: "done", result: autoMatch(bankLines, ledgerLines) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auto-Match failed.";
      setMatchState({ status: "error", message });
    }
  }, []);

  const handleBank = useCallback(
    (data: ParsedCsv) => {
      setBank(data);
      setSaveState({ status: "idle" });
      setMatchState({ status: "idle" });
      if (ledger) void saveToSupabase(data, ledger);
    },
    [ledger, saveToSupabase],
  );

  const handleLedger = useCallback(
    (data: ParsedCsv) => {
      setLedger(data);
      setSaveState({ status: "idle" });
      setMatchState({ status: "idle" });
      if (bank) void saveToSupabase(bank, data);
    },
    [bank, saveToSupabase],
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone
          kind="bank"
          label="Bank statement"
          hint="Transactions exported from your bank."
          parsed={bank}
          onParsed={handleBank}
          onClear={() => {
            setBank(null);
            setSaveState({ status: "idle" });
            setMatchState({ status: "idle" });
          }}
        />
        <FileDropzone
          kind="ledger"
          label="Accounting ledger"
          hint="Journal lines exported from your books."
          parsed={ledger}
          onParsed={handleLedger}
          onClear={() => {
            setLedger(null);
            setSaveState({ status: "idle" });
            setMatchState({ status: "idle" });
          }}
        />
      </div>

      {saveState.status === "saving" ? (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Saving session and line rows to Supabase…
        </p>
      ) : null}

      {saveState.status === "saved" ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved session <span className="font-mono text-xs">{saveState.sessionId}</span>
          {" · "}
          {saveState.bankCount} bank lines
          {" · "}
          {saveState.ledgerCount} ledger lines
        </p>
      ) : null}

      {saveState.status === "error" ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <p>{saveState.message}</p>
          {bank && ledger ? (
            <button
              type="button"
              className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1 text-red-800 hover:bg-red-50"
              onClick={() => void saveToSupabase(bank, ledger)}
            >
              Retry save
            </button>
          ) : null}
        </div>
      ) : null}

      {bank && !ledger ? (
        <p className="text-sm text-slate-500">
          Bank file parsed. Upload the ledger CSV to create a session and save both files.
        </p>
      ) : null}

      {ledger && !bank ? (
        <p className="text-sm text-slate-500">
          Ledger file parsed. Upload the bank CSV to create a session and save both files.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CsvTable
          title="Bank statement preview"
          data={bank}
          emptyMessage="Upload a bank CSV to see its rows here."
        />
        <CsvTable
          title="Ledger preview"
          data={ledger}
          emptyMessage="Upload a ledger CSV to see its rows here."
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Auto-match</h2>
            <p className="text-sm text-slate-500">
              Load this session from Supabase, then pair exact date/amount first
              (Tier 1) and 1–3 day amount matches second (Tier 2).
            </p>
          </div>
          <button
            type="button"
            disabled={saveState.status !== "saved" || matchState.status === "running"}
            onClick={() => {
              if (saveState.status !== "saved") return;
              void runAutoMatch(saveState.sessionId);
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {matchState.status === "running" ? "Matching…" : "Auto-Match"}
          </button>
        </div>

        {saveState.status !== "saved" ? (
          <p className="text-sm text-slate-500">
            Save both CSVs first. Auto-Match uses the current session’s
            <code className="mx-1 rounded bg-slate-100 px-1">bank_lines</code>
            and
            <code className="mx-1 rounded bg-slate-100 px-1">ledger_lines</code>
            rows.
          </p>
        ) : null}

        {matchState.status === "error" ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {matchState.message}
          </p>
        ) : null}

        {matchState.status === "done" ? <MatchResults result={matchState.result} /> : null}
      </section>
    </div>
  );
}
