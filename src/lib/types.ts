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
