/**
 * Reconciliation matching engine.
 *
 * This file is pure TypeScript: no React, no Supabase. The dashboard loads
 * rows for the current session, then calls `autoMatch`.
 *
 * Rules (greedy, one-to-one):
 * - Each bank line and each ledger line may be used in at most one pair.
 * - Tier 1 runs first: same amount (in cents) AND the same calendar date.
 * - Tier 2 uses leftovers: same amount AND dates within 3 days (1–3 day gap).
 *
 * Greedy means “first unused candidate wins” (Tier 1) or “closest date wins”
 * (Tier 2). We do not try to globally optimize every possible pairing.
 */

import type { MatchResult, MatchedPair, ReconLine } from "@/lib/types";

/** 3 calendar days is a common window for cheques / card settlement lag. */
const TIER_2_MAX_DAY_GAP = 3;

/**
 * Compare money in integer cents so 10.10 and 10.1 still match.
 * Floating-point 10.1 + 0.2 can become 10.299999, which would fail ===.
 */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Normalize PostgREST dates like "2026-01-03" or "2026-01-03T00:00:00+00:00". */
export function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * Whole calendar days between two YYYY-MM-DD strings, using UTC so
 * the browser timezone cannot shift the date overnight.
 */
export function daysBetween(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  return Math.abs(Math.round((a - b) / 86_400_000));
}

function canCompare(line: ReconLine): line is ReconLine & { amount: number } {
  return line.amount !== null && toIsoDate(line.transaction_date) !== null;
}

/**
 * Walk unused ledger lines and pick one partner for this bank line.
 *
 * Edge cases we skip (the bank line stays unmatched for this tier):
 * - missing amount or date on either side
 * - amount cents do not match
 * - day gap is outside [minGap, maxGap]
 * - that ledger id is already in `usedLedgerIds`
 *
 * If several ledgers still qualify, we take the smallest gap, then the
 * earlier row (stable, beginner-friendly, no random “best” search).
 */
function findLedgerPartner(
  bank: ReconLine,
  ledgerLines: ReconLine[],
  usedLedgerIds: Set<string>,
  minGap: number,
  maxGap: number,
): { ledger: ReconLine; dateDiffDays: number } | null {
  if (!canCompare(bank)) return null;

  const bankDate = toIsoDate(bank.transaction_date);
  const bankCents = amountToCents(bank.amount);
  if (!bankDate) return null;

  let best: { ledger: ReconLine; dateDiffDays: number; index: number } | null = null;

  for (let index = 0; index < ledgerLines.length; index += 1) {
    const ledger = ledgerLines[index];
    // Skip lines already paired, or lines we cannot date/amount-compare.
    if (usedLedgerIds.has(ledger.id)) continue;
    if (!canCompare(ledger)) continue;

    const ledgerDate = toIsoDate(ledger.transaction_date);
    if (!ledgerDate) continue;
    if (amountToCents(ledger.amount) !== bankCents) continue;

    const dateDiffDays = daysBetween(bankDate, ledgerDate);
    if (dateDiffDays < minGap || dateDiffDays > maxGap) continue;

    // Prefer a tighter date gap; if tied, keep the earlier ledger row.
    if (
      !best ||
      dateDiffDays < best.dateDiffDays ||
      (dateDiffDays === best.dateDiffDays && index < best.index)
    ) {
      best = { ledger, dateDiffDays, index };
    }
  }

  if (!best) return null;
  return { ledger: best.ledger, dateDiffDays: best.dateDiffDays };
}

function pairOff(
  bankLines: ReconLine[],
  ledgerLines: ReconLine[],
  usedBankIds: Set<string>,
  usedLedgerIds: Set<string>,
  minGap: number,
  maxGap: number,
  tier: 1 | 2,
): MatchedPair[] {
  const pairs: MatchedPair[] = [];

  // Outer loop: every unused bank line, in file / database order.
  for (const bank of bankLines) {
    if (usedBankIds.has(bank.id)) continue;

    const partner = findLedgerPartner(bank, ledgerLines, usedLedgerIds, minGap, maxGap);
    if (!partner) continue;

    // Lock both sides so a later bank line cannot reuse this ledger line.
    usedBankIds.add(bank.id);
    usedLedgerIds.add(partner.ledger.id);
    pairs.push({
      bank,
      ledger: partner.ledger,
      tier,
      dateDiffDays: partner.dateDiffDays,
    });
  }

  return pairs;
}

/**
 * Run Tier 1 then Tier 2. Returns matched pairs plus whatever is still free.
 */
export function autoMatch(bankLines: ReconLine[], ledgerLines: ReconLine[]): MatchResult {
  const usedBankIds = new Set<string>();
  const usedLedgerIds = new Set<string>();

  // Tier 1: exact amount + exact date (gap === 0).
  const tier1 = pairOff(bankLines, ledgerLines, usedBankIds, usedLedgerIds, 0, 0, 1);

  // Tier 2: leftovers only; exact amount + 1..3 calendar days apart.
  const tier2 = pairOff(
    bankLines,
    ledgerLines,
    usedBankIds,
    usedLedgerIds,
    1,
    TIER_2_MAX_DAY_GAP,
    2,
  );

  return {
    matched: [...tier1, ...tier2],
    unmatchedBank: bankLines.filter((line) => !usedBankIds.has(line.id)),
    unmatchedLedger: ledgerLines.filter((line) => !usedLedgerIds.has(line.id)),
  };
}
