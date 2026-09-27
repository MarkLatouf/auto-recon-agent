/**
 * Maps a free-form CSV row onto the database columns.
 *
 * Bank and ledger exports rarely share the same header names, so we look up
 * a few common labels and store the original row in `raw_data` as JSON.
 */

import type { CsvRow } from "./types";

/** One row we send to `bank_lines` or `ledger_lines`. */
export type LineInsert = {
  session_id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | null;
  raw_data: CsvRow;
};

function findValue(row: CsvRow, candidates: string[]): string | null {
  const entries = Object.entries(row);
  for (const name of candidates) {
    const match = entries.find(([key]) => key.trim().toLowerCase() === name);
    if (match && match[1]) return match[1];
  }
  return null;
}

/** Turns "$1,234.50" or "(120.00)" into a number, or null if it is not money. */
export function parseAmount(value: string | null): number | null {
  if (!value) return null;
  const negativeAccounting = /^\(.*\)$/.test(value.trim());
  const cleaned = value.replace(/[$,\s()]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (Number.isNaN(amount)) return null;
  return negativeAccounting ? -amount : amount;
}

/** Accepts YYYY-MM-DD (and similar) and returns that date, or null. */
export function parseDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const month = slash[1].padStart(2, "0");
    const day = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }
  return null;
}

export function csvRowToLine(sessionId: string, row: CsvRow): LineInsert {
  return {
    session_id: sessionId,
    transaction_date: parseDate(findValue(row, ["date", "transaction_date", "txn_date", "posted"])),
    description: findValue(row, ["description", "memo", "narration", "details", "payee"]),
    amount: parseAmount(findValue(row, ["amount", "amt", "value", "debit"])),
    // jsonb column: keep every CSV cell so we never lose columns we did not map.
    raw_data: row,
  };
}
