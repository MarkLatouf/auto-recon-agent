"use client";

/**
 * MatchResults
 *
 * Unmatched lists are clickable so the user can pick one bank line and
 * one ledger line for Manual Match. Matched pairs stay read-only.
 */

import type { MatchResult, MatchTier, ReconLine } from "@/lib/types";

function money(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pairLabel(tier: MatchTier, dateDiffDays: number, similarity?: number): string {
  if (tier === "manual") return "Manual";
  if (tier === 3) {
    const score =
      similarity === undefined ? "" : ` · ${(similarity * 100).toFixed(0)}% similar`;
    return `Tier 3 · AI Semantic${score}`;
  }
  if (tier === 2) return `Tier 2 · ${dateDiffDays} day gap`;
  return "Tier 1 · same date";
}

function LineCard({
  line,
  selected,
  onToggle,
}: {
  line: ReconLine;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={[
          "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
          selected
            ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
            : "border-slate-100 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/60",
        ].join(" ")}
      >
        <p className="font-medium text-slate-800">{line.description ?? "No description"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {line.transaction_date ?? "No date"}
          {" · "}
          {money(line.amount)}
        </p>
      </button>
    </li>
  );
}

type MatchResultsProps = {
  result: MatchResult;
  selectedBankLineId: string | null;
  selectedLedgerLineId: string | null;
  onSelectBank: (id: string) => void;
  onSelectLedger: (id: string) => void;
};

export function MatchResults({
  result,
  selectedBankLineId,
  selectedLedgerLineId,
  onSelectBank,
  onSelectLedger,
}: MatchResultsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">Unmatched bank lines</h3>
        <p className="mb-3 text-xs text-slate-500">{result.unmatchedBank.length} remaining</p>
        {result.unmatchedBank.length === 0 ? (
          <p className="text-sm text-slate-500">None — every bank line found a partner.</p>
        ) : (
          <ul className="space-y-2">
            {result.unmatchedBank.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                selected={selectedBankLineId === line.id}
                onToggle={() => onSelectBank(line.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">Unmatched ledger lines</h3>
        <p className="mb-3 text-xs text-slate-500">{result.unmatchedLedger.length} remaining</p>
        {result.unmatchedLedger.length === 0 ? (
          <p className="text-sm text-slate-500">None — every ledger line found a partner.</p>
        ) : (
          <ul className="space-y-2">
            {result.unmatchedLedger.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                selected={selectedLedgerLineId === line.id}
                onToggle={() => onSelectLedger(line.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">Matched pairs</h3>
        <p className="mb-3 text-xs text-slate-500">{result.matched.length} pairs</p>
        {result.matched.length === 0 ? (
          <p className="text-sm text-slate-500">No pairs yet. Run Auto-Match after saving a session.</p>
        ) : (
          <ul className="space-y-2">
            {result.matched.map((pair) => (
              <li
                key={`${pair.bank.id}-${pair.ledger.id}`}
                className={
                  pair.tier === 3
                    ? "rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm"
                    : "rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm"
                }
              >
                <p
                  className={
                    pair.tier === 3
                      ? "text-xs font-medium uppercase tracking-wide text-violet-800"
                      : "text-xs font-medium uppercase tracking-wide text-emerald-800"
                  }
                >
                  {pairLabel(pair.tier, pair.dateDiffDays, pair.similarity)}
                </p>
                <p className="mt-1 text-slate-800">
                  Bank: {pair.bank.description ?? "—"} ({money(pair.bank.amount)})
                </p>
                <p className="text-slate-800">
                  Ledger: {pair.ledger.description ?? "—"} ({money(pair.ledger.amount)})
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {pair.bank.transaction_date} → {pair.ledger.transaction_date}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
