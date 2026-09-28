/**
 * Turns matched pairs into a downloadable CSV file.
 *
 * Papa.unparse is the reverse of Papa.parse: an array of objects becomes
 * a string with a header row and comma-separated values (quotes added
 * automatically when a cell contains a comma or newline).
 */

import Papa from "papaparse";
import type { MatchTier, MatchedPair } from "@/lib/types";

function matchTypeLabel(tier: MatchTier): string {
  if (tier === "manual") return "Manual";
  if (tier === 3) return "Tier 3 AI";
  if (tier === 2) return "Tier 2";
  return "Tier 1";
}

function money(amount: number | null): string {
  if (amount === null) return "";
  return amount.toFixed(2);
}

/**
 * Local clock → `recon-export-YYYY-MM-DD_HH-MM.csv`.
 * getMonth() is 0-based, so we add 1. padStart keeps 9 → "09".
 */
export function reconExportFileName(now = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `recon-export-${year}-${month}-${day}_${hours}-${minutes}.csv`;
}

export function exportMatchedCsv(matchedPairs: MatchedPair[]): void {
  const rows = matchedPairs.map((pair) => ({
    "Match Type": matchTypeLabel(pair.tier),
    "Bank Date": pair.bank.transaction_date ?? "",
    "Bank Description": pair.bank.description ?? "",
    "Bank Amount": money(pair.bank.amount),
    "Ledger Date": pair.ledger.transaction_date ?? "",
    "Ledger Memo": pair.ledger.description ?? "",
    "Ledger Amount": money(pair.ledger.amount),
  }));

  const csv = Papa.unparse(rows, {
    columns: [
      "Match Type",
      "Bank Date",
      "Bank Description",
      "Bank Amount",
      "Ledger Date",
      "Ledger Memo",
      "Ledger Amount",
    ],
  });

  // Blob = an in-memory file. object URL lets <a download> point at it.
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reconExportFileName();
  // Must be in the document for some browsers to start the download.
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
