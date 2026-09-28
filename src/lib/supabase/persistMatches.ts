/**
 * Saves Auto-Match pairs into the `matches` table.
 *
 * Batch insert (what `.insert(array)` means):
 * - We build one JavaScript array of row objects (one object per pair).
 * - `supabase.from("matches").insert(rows)` sends that whole array in a
 *   single HTTP request to PostgREST.
 * - Postgres then runs one INSERT with many value lists, instead of
 *   N separate inserts from the browser.
 *
 * Why chunk?
 * PostgREST / HTTP bodies have a size limit. 500 rows per request is a
 * safe chunk size. A session with 1,200 pairs becomes 3 requests, not 1,200.
 *
 * `id` is omitted so the database default (usually gen_random_uuid()) fills it.
 */

import { createClient } from "@/lib/supabase/client";
import type { MatchTier, MatchedPair } from "@/lib/types";

export type MatchInsert = {
  session_id: string;
  bank_line_id: string;
  ledger_line_id: string;
  match_type: string;
};

/** Maps our in-memory tier to the `matches.match_type` text column. */
export function matchTypeFromTier(tier: MatchTier): string {
  if (tier === "manual") return "manual";
  if (tier === 3) return "tier_3";
  return tier === 1 ? "tier_1" : "tier_2";
}

/** Reverse of matchTypeFromTier, for loading saved rows back into the UI. */
export function tierFromMatchType(matchType: string): MatchTier {
  if (matchType === "manual") return "manual";
  if (matchType === "tier_3") return 3;
  if (matchType === "tier_2") return 2;
  return 1;
}

/**
 * One user-chosen pair. Unlike Auto-Match, this is saved immediately
 * instead of waiting for the bulk “Save Matches” button.
 */
export async function persistManualMatch(
  sessionId: string,
  bankLineId: string,
  ledgerLineId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("matches").insert({
    session_id: sessionId,
    bank_line_id: bankLineId,
    ledger_line_id: ledgerLineId,
    match_type: "manual",
  });
  if (error) {
    throw new Error(`Could not save manual match: ${error.message}`);
  }
}

export async function persistMatches(
  sessionId: string,
  pairs: MatchedPair[],
): Promise<{ savedCount: number }> {
  // Manual pairs are inserted as soon as the user clicks Manual Match,
  // so the bulk save only sends Auto-Match (tier 1 / 2 / 3) rows.
  const autoPairs = pairs.filter((pair) => pair.tier !== "manual");
  if (autoPairs.length === 0) {
    return { savedCount: 0 };
  }

  const supabase = createClient();

  // Skip pairs already stored (e.g. user saved Tier 1/2, then ran AI Match).
  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("bank_line_id, ledger_line_id")
    .eq("session_id", sessionId);
  if (existingError) {
    throw new Error(`Could not read matches: ${existingError.message}`);
  }

  const alreadySaved = new Set(
    (existing ?? []).map((row) => `${row.bank_line_id}:${row.ledger_line_id}`),
  );

  const rows: MatchInsert[] = autoPairs
    .map((pair) => ({
      session_id: sessionId,
      bank_line_id: pair.bank.id,
      ledger_line_id: pair.ledger.id,
      match_type: matchTypeFromTier(pair.tier),
    }))
    .filter((row) => !alreadySaved.has(`${row.bank_line_id}:${row.ledger_line_id}`));

  if (rows.length === 0) {
    return { savedCount: 0 };
  }

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("matches").insert(chunk);
    if (error) {
      throw new Error(`Could not save matches: ${error.message}`);
    }
  }

  return { savedCount: rows.length };
}
