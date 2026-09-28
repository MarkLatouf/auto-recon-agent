/**
 * Session history queries.
 *
 * All of these run in the browser with the anon key via createClient().
 * Comments below call out the PostgREST bits (select / order / eq / in).
 */

import { daysBetween, toIsoDate } from "@/lib/recon/matching";
import { createClient } from "@/lib/supabase/client";
import { loadSessionLines } from "@/lib/supabase/loadSessionLines";
import { tierFromMatchType } from "@/lib/supabase/persistMatches";
import type { CsvRow, LoadedSession, ParsedCsv, ReconLine, SessionSummary } from "@/lib/types";

type SessionRow = {
  id: string;
  created_at: string;
  bank_filename: string;
  ledger_filename: string;
  /** Nested count from `matches(count)` — shape is [{ count: number }]. */
  matches?: { count: number }[] | null;
};

type MatchRow = {
  bank_line_id: string;
  ledger_line_id: string;
  match_type: string;
};

function linesToCsv(kind: ParsedCsv["kind"], fileName: string, lines: ReconLine[]): ParsedCsv {
  const rows = lines.map((line) => {
    if (line.raw_data && Object.keys(line.raw_data).length > 0) {
      return line.raw_data;
    }
    return {
      Date: line.transaction_date ?? "",
      Description: line.description ?? "",
      Amount: line.amount === null ? "" : String(line.amount),
    } satisfies CsvRow;
  });

  const headers =
    rows[0] !== undefined
      ? Object.keys(rows[0])
      : ["Date", "Description", "Amount"];

  return { kind, fileName, headers, rows };
}

/**
 * Newest sessions first, with a match count per session.
 *
 * Query breakdown:
 * - `.from("recon_sessions")` — the table
 * - `.select("..., matches(count)")` — columns we need, plus a *nested count*
 *   of related `matches` rows (PostgREST follows the session_id foreign key)
 * - `.order("created_at", { ascending: false })` — latest upload at the top
 *
 * If the nested count is unavailable, we fall back to a second query that
 * only fetches `matches.session_id` and tally in JavaScript.
 */
export async function listReconSessions(): Promise<SessionSummary[]> {
  const supabase = createClient();

  const nested = await supabase
    .from("recon_sessions")
    .select("id, created_at, bank_filename, ledger_filename, matches(count)")
    .order("created_at", { ascending: false });

  if (!nested.error && nested.data) {
    return (nested.data as SessionRow[]).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      bankFilename: row.bank_filename,
      ledgerFilename: row.ledger_filename,
      matchCount: row.matches?.[0]?.count ?? 0,
    }));
  }

  const sessions = await supabase
    .from("recon_sessions")
    .select("id, created_at, bank_filename, ledger_filename")
    .order("created_at", { ascending: false });

  if (sessions.error) {
    throw new Error(`Could not load sessions: ${sessions.error.message}`);
  }

  const matchRows = await supabase.from("matches").select("session_id");
  if (matchRows.error) {
    throw new Error(`Could not count matches: ${matchRows.error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of matchRows.data ?? []) {
    const sessionId = (row as { session_id: string }).session_id;
    counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
  }

  return (sessions.data as SessionRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    bankFilename: row.bank_filename,
    ledgerFilename: row.ledger_filename,
    matchCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * Rebuild dashboard state from one saved session:
 * bank_lines + ledger_lines + matches.
 *
 * `.eq("session_id", id)` is a WHERE filter — only this session’s rows.
 */
export async function loadReconSession(sessionId: string): Promise<LoadedSession> {
  const supabase = createClient();

  const session = await supabase
    .from("recon_sessions")
    .select("id, bank_filename, ledger_filename")
    .eq("id", sessionId)
    .single();

  if (session.error || !session.data) {
    throw new Error(session.error?.message ?? "Session not found.");
  }

  const [{ bankLines, ledgerLines }, matches] = await Promise.all([
    loadSessionLines(sessionId),
    supabase
      .from("matches")
      .select("bank_line_id, ledger_line_id, match_type")
      .eq("session_id", sessionId),
  ]);

  if (matches.error) {
    throw new Error(`Could not load matches: ${matches.error.message}`);
  }

  const bankById = new Map(bankLines.map((line) => [line.id, line]));
  const ledgerById = new Map(ledgerLines.map((line) => [line.id, line]));
  const usedBank = new Set<string>();
  const usedLedger = new Set<string>();

  const matched = ((matches.data ?? []) as MatchRow[]).flatMap((row) => {
    const bank = bankById.get(row.bank_line_id);
    const ledger = ledgerById.get(row.ledger_line_id);
    if (!bank || !ledger) return [];

    usedBank.add(bank.id);
    usedLedger.add(ledger.id);

    const bankDate = toIsoDate(bank.transaction_date);
    const ledgerDate = toIsoDate(ledger.transaction_date);

    return [
      {
        bank,
        ledger,
        tier: tierFromMatchType(row.match_type),
        dateDiffDays: bankDate && ledgerDate ? daysBetween(bankDate, ledgerDate) : 0,
      },
    ];
  });

  const sessionData = session.data as {
    id: string;
    bank_filename: string;
    ledger_filename: string;
  };

  return {
    sessionId: sessionData.id,
    bank: linesToCsv("bank", sessionData.bank_filename, bankLines),
    ledger: linesToCsv("ledger", sessionData.ledger_filename, ledgerLines),
    matchResult: {
      matched,
      unmatchedBank: bankLines.filter((line) => !usedBank.has(line.id)),
      unmatchedLedger: ledgerLines.filter((line) => !usedLedger.has(line.id)),
    },
    matchCount: matched.length,
  };
}
