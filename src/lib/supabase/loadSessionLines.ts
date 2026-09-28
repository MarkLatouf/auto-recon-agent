/**
 * Loads persisted lines for one recon session.
 *
 * Auto-Match reads from Supabase (not from the in-memory CSV preview) so we
 * always pair the same rows that were saved on `bank_lines` / `ledger_lines`.
 */

import { createClient } from "@/lib/supabase/client";
import type { CsvRow, ReconLine } from "@/lib/types";

type LineRow = {
  id: string;
  session_id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | string | null;
  raw_data: CsvRow | null;
};

function toLine(row: LineRow, source: ReconLine["source"]): ReconLine {
  return {
    id: row.id,
    session_id: row.session_id,
    transaction_date: row.transaction_date,
    description: row.description,
    // numeric columns sometimes arrive as strings from PostgREST.
    amount: row.amount === null ? null : Number(row.amount),
    raw_data: row.raw_data,
    source,
  };
}

export async function loadSessionLines(sessionId: string): Promise<{
  bankLines: ReconLine[];
  ledgerLines: ReconLine[];
}> {
  const supabase = createClient();

  const [bankResult, ledgerResult] = await Promise.all([
    supabase.from("bank_lines").select("*").eq("session_id", sessionId).order("id"),
    supabase.from("ledger_lines").select("*").eq("session_id", sessionId).order("id"),
  ]);

  if (bankResult.error) {
    throw new Error(`Could not load bank_lines: ${bankResult.error.message}`);
  }
  if (ledgerResult.error) {
    throw new Error(`Could not load ledger_lines: ${ledgerResult.error.message}`);
  }

  return {
    bankLines: (bankResult.data as LineRow[]).map((row) => toLine(row, "bank")),
    ledgerLines: (ledgerResult.data as LineRow[]).map((row) => toLine(row, "ledger")),
  };
}
