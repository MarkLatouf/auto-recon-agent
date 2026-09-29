/**
 * Shared TypeScript types for parsed CSV rows.
 *
 * We keep these in one file so the upload UI, table, and (later) matching
 * logic all speak the same language.
 */

/** One row from a CSV, with column names as keys and cell text as values. */
export type CsvRow = Record<string, string>;

/** Which of the two reconciliation sources a file belongs to. */
export type DatasetKind = "bank" | "ledger";

/** Parsed result we keep in React state after a successful upload. */
export type ParsedCsv = {
  kind: DatasetKind;
  fileName: string;
  /** Column headers, in the order Papa Parse found them. */
  headers: string[];
  rows: CsvRow[];
};

/** One persisted row from `bank_lines` or `ledger_lines`. */
export type ReconLine = {
  id: string;
  session_id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | null;
  raw_data: CsvRow | null;
  source: DatasetKind;
};

/** Auto tiers, a hand-picked pair, or AI semantic match. */
export type MatchTier = 1 | 2 | 3 | "manual";

export type MatchedPair = {
  bank: ReconLine;
  ledger: ReconLine;
  tier: MatchTier;
  /** Absolute calendar-day gap used to choose the pair (0 for Tier 1). */
  dateDiffDays: number;
  /** Cosine similarity for Tier 3 (0–1). */
  similarity?: number;
};

export type MatchResult = {
  matched: MatchedPair[];
  unmatchedBank: ReconLine[];
  unmatchedLedger: ReconLine[];
};

/** One row from `recon_sessions` plus how many `matches` it has. */
export type SessionSummary = {
  id: string;
  createdAt: string;
  bankFilename: string;
  ledgerFilename: string;
  matchCount: number;
};

export type MatchTypeFilter = "All" | "Tier 1" | "Tier 2" | "Tier 3" | "Manual";

export type SortConfig = {
  key: "date" | "amount";
  direction: "asc" | "desc";
};

/** Everything the dashboard needs to inspect a saved session. */
export type LoadedSession = {
  sessionId: string;
  bank: ParsedCsv;
  ledger: ParsedCsv;
  matchResult: MatchResult;
  matchCount: number;
};
