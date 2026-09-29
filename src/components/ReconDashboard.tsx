"use client";

/**
 * ReconDashboard
 *
 * Holds the two parsed CSVs in React state and:
 * 1) shows two upload dropzones
 * 2) previews both tables
 * 3) when both files are ready, inserts a recon_sessions row plus line rows
 * 4) Auto-Match loads those rows and runs Tier 1 + Tier 2 pairing
 * 5) Save Matches writes Auto-Match pairs into the `matches` table
 * 7) Run AI Match embeds unmatched lines and pairs them by cosine similarity
 */

import { useCallback, useMemo, useState } from "react";
import { autoMatch, daysBetween, toIsoDate } from "@/lib/recon/matching";
import { loadSessionLines } from "@/lib/supabase/loadSessionLines";
import { persistManualMatch, persistMatches } from "@/lib/supabase/persistMatches";
import { persistReconUpload } from "@/lib/supabase/persistRecon";
import { exportMatchedCsv } from "@/lib/exportMatchedCsv";
import type { LoadedSession, MatchResult, MatchTypeFilter, MatchedPair, ParsedCsv, SortConfig } from "@/lib/types";
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

type PersistMatchesState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; savedCount: number }
  | { status: "error"; message: string };

function pairMatchesTypeFilter(tier: MatchedPair["tier"], filter: MatchTypeFilter): boolean {
  if (filter === "All") return true;
  if (filter === "Manual") return tier === "manual";
  if (filter === "Tier 1") return tier === 1;
  if (filter === "Tier 2") return tier === 2;
  return tier === 3;
}

function pairMatchesSearch(pair: MatchedPair, query: string): boolean {
  if (!query) return true;
  const haystack = [
    pair.bank.description ?? "",
    pair.ledger.description ?? "",
    pair.bank.amount === null ? "" : String(pair.bank.amount),
    pair.bank.amount === null ? "" : pair.bank.amount.toFixed(2),
    pair.ledger.amount === null ? "" : String(pair.ledger.amount),
    pair.ledger.amount === null ? "" : pair.ledger.amount.toFixed(2),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ReconDashboard({
  inspectSession = null,
}: {
  inspectSession?: LoadedSession | null;
}) {
  const [bank, setBank] = useState<ParsedCsv | null>(inspectSession?.bank ?? null);
  const [ledger, setLedger] = useState<ParsedCsv | null>(inspectSession?.ledger ?? null);
  const [saveState, setSaveState] = useState<SaveState>(
    inspectSession
      ? {
          status: "saved",
          sessionId: inspectSession.sessionId,
          bankCount: inspectSession.bank.rows.length,
          ledgerCount: inspectSession.ledger.rows.length,
        }
      : { status: "idle" },
  );
  const [matchState, setMatchState] = useState<MatchUiState>(
    inspectSession
      ? { status: "done", result: inspectSession.matchResult }
      : { status: "idle" },
  );
  const [persistMatchesState, setPersistMatchesState] = useState<PersistMatchesState>(
    inspectSession
      ? { status: "saved", savedCount: inspectSession.matchCount }
      : { status: "idle" },
  );
  // Exactly one bank line and one ledger line may be selected at a time.
  // `null` means “nothing picked in this list.”
  const [selectedBankLineId, setSelectedBankLineId] = useState<string | null>(null);
  const [selectedLedgerLineId, setSelectedLedgerLineId] = useState<string | null>(null);
  const [manualMatchError, setManualMatchError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [aiMatchError, setAiMatchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>("All");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "asc",
  });

  const matchedPairs =
    matchState.status === "done" ? matchState.result.matched : [];

  const filteredAndSortedMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = matchedPairs.filter(
      (pair) => pairMatchesTypeFilter(pair.tier, matchTypeFilter) && pairMatchesSearch(pair, query),
    );

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortConfig.key === "date") {
        const left = a.bank.transaction_date ?? "";
        const right = b.bank.transaction_date ?? "";
        return left.localeCompare(right) * direction;
      }
      const left = a.bank.amount ?? Number.NEGATIVE_INFINITY;
      const right = b.bank.amount ?? Number.NEGATIVE_INFINITY;
      if (left === right) return 0;
      return (left < right ? -1 : 1) * direction;
    });
  }, [matchedPairs, searchQuery, matchTypeFilter, sortConfig]);

  const toggleSort = useCallback((key: SortConfig["key"]) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }, []);

  const saveToSupabase = useCallback(async (nextBank: ParsedCsv, nextLedger: ParsedCsv) => {
    setSaveState({ status: "saving" });
    setMatchState({ status: "idle" });
    setPersistMatchesState({ status: "idle" });
    setSelectedBankLineId(null);
    setSelectedLedgerLineId(null);
    setManualMatchError(null);
    setAiMatchError(null);
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
    setPersistMatchesState({ status: "idle" });
    setSelectedBankLineId(null);
    setSelectedLedgerLineId(null);
    setManualMatchError(null);
    setAiMatchError(null);
    try {
      const { bankLines, ledgerLines } = await loadSessionLines(sessionId);
      setMatchState({ status: "done", result: autoMatch(bankLines, ledgerLines) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auto-Match failed.";
      setMatchState({ status: "error", message });
    }
  }, []);

  const saveMatchesToSupabase = useCallback(async (sessionId: string, result: MatchResult) => {
    setPersistMatchesState({ status: "saving" });
    try {
      const { savedCount } = await persistMatches(sessionId, result.matched);
      setPersistMatchesState({ status: "saved", savedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save matches.";
      setPersistMatchesState({ status: "error", message });
    }
  }, []);

  const saveManualMatch = useCallback(async () => {
    if (saveState.status !== "saved" || matchState.status !== "done") return;
    if (!selectedBankLineId || !selectedLedgerLineId) return;

    const bankLine = matchState.result.unmatchedBank.find((line) => line.id === selectedBankLineId);
    const ledgerLine = matchState.result.unmatchedLedger.find(
      (line) => line.id === selectedLedgerLineId,
    );
    if (!bankLine || !ledgerLine) return;

    setIsSavingManual(true);
    setManualMatchError(null);
    try {
      await persistManualMatch(saveState.sessionId, bankLine.id, ledgerLine.id);

      const bankDate = toIsoDate(bankLine.transaction_date);
      const ledgerDate = toIsoDate(ledgerLine.transaction_date);
      const dateDiffDays =
        bankDate && ledgerDate ? daysBetween(bankDate, ledgerDate) : 0;

      setMatchState({
        status: "done",
        result: {
          matched: [
            ...matchState.result.matched,
            { bank: bankLine, ledger: ledgerLine, tier: "manual", dateDiffDays },
          ],
          unmatchedBank: matchState.result.unmatchedBank.filter((line) => line.id !== bankLine.id),
          unmatchedLedger: matchState.result.unmatchedLedger.filter(
            (line) => line.id !== ledgerLine.id,
          ),
        },
      });
      setSelectedBankLineId(null);
      setSelectedLedgerLineId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save manual match.";
      setManualMatchError(message);
    } finally {
      setIsSavingManual(false);
    }
  }, [saveState, matchState, selectedBankLineId, selectedLedgerLineId]);

  const runAiMatch = useCallback(async () => {
    if (saveState.status !== "saved" || matchState.status !== "done") return;

    const unmatchedBank = matchState.result.unmatchedBank;
    const unmatchedLedger = matchState.result.unmatchedLedger;
    if (unmatchedBank.length === 0 || unmatchedLedger.length === 0) return;

    setIsRunningAi(true);
    setAiMatchError(null);
    try {
      const response = await fetch("/api/recon/ai-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: saveState.sessionId,
          unmatchedBankIds: unmatchedBank.map((line) => line.id),
          unmatchedLedgerIds: unmatchedLedger.map((line) => line.id),
        }),
      });
      const payload = (await response.json()) as { pairs?: MatchedPair[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "AI match failed.");
      }

      const newPairs = payload.pairs ?? [];
      const usedBank = new Set(newPairs.map((pair) => pair.bank.id));
      const usedLedger = new Set(newPairs.map((pair) => pair.ledger.id));

      setMatchState({
        status: "done",
        result: {
          matched: [...matchState.result.matched, ...newPairs],
          unmatchedBank: unmatchedBank.filter((line) => !usedBank.has(line.id)),
          unmatchedLedger: unmatchedLedger.filter((line) => !usedLedger.has(line.id)),
        },
      });
      setSelectedBankLineId(null);
      setSelectedLedgerLineId(null);
      if (newPairs.length > 0) {
        setPersistMatchesState({ status: "idle" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI match failed.";
      setAiMatchError(message);
    } finally {
      setIsRunningAi(false);
    }
  }, [saveState, matchState]);

  const handleBank = useCallback(
    (data: ParsedCsv) => {
      setBank(data);
      setSaveState({ status: "idle" });
      setMatchState({ status: "idle" });
      setPersistMatchesState({ status: "idle" });
      setSelectedBankLineId(null);
      setSelectedLedgerLineId(null);
      setManualMatchError(null);
      setAiMatchError(null);
      if (ledger) void saveToSupabase(data, ledger);
    },
    [ledger, saveToSupabase],
  );

  const handleLedger = useCallback(
    (data: ParsedCsv) => {
      setLedger(data);
      setSaveState({ status: "idle" });
      setMatchState({ status: "idle" });
      setPersistMatchesState({ status: "idle" });
      setSelectedBankLineId(null);
      setSelectedLedgerLineId(null);
      setManualMatchError(null);
      setAiMatchError(null);
      if (bank) void saveToSupabase(bank, data);
    },
    [bank, saveToSupabase],
  );

  return (
    <div className="space-y-8">
      {inspectSession ? (
        <p className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Inspecting saved session{" "}
          <span className="font-mono text-xs">{inspectSession.sessionId}</span>
          {" · "}
          {inspectSession.matchCount} saved match
          {inspectSession.matchCount === 1 ? "" : "es"}.
        </p>
      ) : null}

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
            setPersistMatchesState({ status: "idle" });
            setSelectedBankLineId(null);
            setSelectedLedgerLineId(null);
            setManualMatchError(null);
            setAiMatchError(null);
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
            setPersistMatchesState({ status: "idle" });
            setSelectedBankLineId(null);
            setSelectedLedgerLineId(null);
            setManualMatchError(null);
            setAiMatchError(null);
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
          {inspectSession ? "Loaded" : "Saved"} session{" "}
          <span className="font-mono text-xs">{saveState.sessionId}</span>
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

        {matchState.status === "done" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  persistMatchesState.status === "saving" ||
                  persistMatchesState.status === "saved" ||
                  matchState.result.matched.length === 0
                }
                onClick={() => {
                  if (saveState.status !== "saved") return;
                  void saveMatchesToSupabase(saveState.sessionId, matchState.result);
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {persistMatchesState.status === "saving"
                  ? "Saving matches…"
                  : persistMatchesState.status === "saved"
                    ? "Matches saved"
                    : "Save Matches"}
              </button>
              <button
                type="button"
                disabled={matchState.result.matched.length === 0}
                onClick={() => exportMatchedCsv(matchState.result.matched)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Export Matched to CSV
              </button>
              {matchState.result.matched.length === 0 ? (
                <p className="text-sm text-slate-500">No pairs to save.</p>
              ) : null}
              <button
                type="button"
                disabled={
                  !selectedBankLineId ||
                  !selectedLedgerLineId ||
                  isSavingManual
                }
                onClick={() => void saveManualMatch()}
                className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
              >
                {isSavingManual ? "Saving manual match…" : "Manual Match"}
              </button>
              <p className="text-sm text-slate-500">
                Select one unmatched bank line and one unmatched ledger line.
              </p>
              <button
                type="button"
                disabled={
                  isRunningAi ||
                  matchState.result.unmatchedBank.length === 0 ||
                  matchState.result.unmatchedLedger.length === 0
                }
                onClick={() => void runAiMatch()}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isRunningAi ? "Running AI Match…" : "Run AI Match"}
              </button>
            </div>

            {aiMatchError ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {aiMatchError}
              </p>
            ) : null}

            {manualMatchError ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {manualMatchError}
              </p>
            ) : null}

            {persistMatchesState.status === "saved" ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Saved {persistMatchesState.savedCount === 1
                  ? "1 pair"
                  : `${persistMatchesState.savedCount} pairs`}{" "}
                to <code className="rounded bg-white px-1">matches</code>.
              </p>
            ) : null}

            {persistMatchesState.status === "error" ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <p>{persistMatchesState.message}</p>
                {saveState.status === "saved" ? (
                  <button
                    type="button"
                    className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1 text-red-800 hover:bg-red-50"
                    onClick={() =>
                      void saveMatchesToSupabase(saveState.sessionId, matchState.result)
                    }
                  >
                    Retry save matches
                  </button>
                ) : null}
              </div>
            ) : null}

            <MatchResults
              result={matchState.result}
              filteredAndSortedMatches={filteredAndSortedMatches}
              searchQuery={searchQuery}
              matchTypeFilter={matchTypeFilter}
              sortConfig={sortConfig}
              onSearchQueryChange={setSearchQuery}
              onMatchTypeFilterChange={setMatchTypeFilter}
              onToggleSort={toggleSort}
              selectedBankLineId={selectedBankLineId}
              selectedLedgerLineId={selectedLedgerLineId}
              onSelectBank={(id) =>
                setSelectedBankLineId((current) => (current === id ? null : id))
              }
              onSelectLedger={(id) =>
                setSelectedLedgerLineId((current) => (current === id ? null : id))
              }
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
