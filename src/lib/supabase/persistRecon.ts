/**
 * Writes one reconciliation upload to Supabase.
 *
 * Flow (three round-trips):
 * 1. INSERT one row into `recon_sessions` and ask PostgREST to return it.
 *    `.select("id").single()` gives us the new UUID.
 * 2. INSERT every bank CSV row into `bank_lines`, each tagged with that id.
 * 3. INSERT every ledger CSV row into `ledger_lines` the same way.
 *
 * The browser uses the public `anon` key via `createClient()`. Row Level
 * Security on your project decides whether those inserts are allowed.
 */

import { csvRowToLine } from "@/lib/mapCsvRow";
import { createClient } from "@/lib/supabase/client";
import type { ParsedCsv } from "@/lib/types";

export type PersistResult = {
  sessionId: string;
  bankCount: number;
  ledgerCount: number;
};

function throwIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/** PostgREST has a request-size limit, so we insert in chunks of 500. */
async function insertLines(
  table: "bank_lines" | "ledger_lines",
  rows: ReturnType<typeof csvRowToLine>[],
) {
  const supabase = createClient();
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    // `.insert(array)` = one SQL INSERT with many rows, not a loop of singles.
    const { error } = await supabase.from(table).insert(chunk);
    throwIfError(error, `Could not save ${table}`);
  }
}

export async function persistReconUpload(
  bank: ParsedCsv,
  ledger: ParsedCsv,
): Promise<PersistResult> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("You must be signed in to save a session.");
  }

  // Step 1 — create the parent session first.
  // Child rows have a foreign key (`session_id`) so the session must exist.
  // `user_id` is the Auth UUID so Row Level Security can scope rows per user.
  const { data: session, error: sessionError } = await supabase
    .from("recon_sessions")
    .insert({
      user_id: user.id,
      bank_filename: bank.fileName,
      ledger_filename: ledger.fileName,
    })
    .select("id")
    .single();

  throwIfError(sessionError, "Could not create recon session");
  if (!session) {
    throw new Error("Could not create recon session: no row returned.");
  }

  const sessionId = session.id as string;

  // Step 2 & 3 — attach the parsed lines to that session.
  const bankLines = bank.rows.map((row) => csvRowToLine(sessionId, row));
  const ledgerLines = ledger.rows.map((row) => csvRowToLine(sessionId, row));

  await insertLines("bank_lines", bankLines);
  await insertLines("ledger_lines", ledgerLines);

  return {
    sessionId,
    bankCount: bankLines.length,
    ledgerCount: ledgerLines.length,
  };
}
