/**
 * MatchResults
 *
 * Presentational lists for Auto-Match output: unmatched bank, unmatched
 * ledger, and matched pairs. No matching logic lives here.
 */

import type { MatchResult, ReconLine } from "@/lib/types";

function money(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LineCard({ line }: { line: ReconLine }) {
  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium text-slate-800">{line.description ?? "No description"}</p>
      <p className="mt-1 text-xs text-slate-500">
        {line.transaction_date ?? "No date"}
        {" · "}
        {money(line.amount)}
      </p>
    </li>
  );
}

type MatchResultsProps = {
  result: MatchResult;
};

export function MatchResults({ result }: MatchResultsProps) {
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
              <LineCard key={line.id} line={line} />
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
              <LineCard key={line.id} line={line} />
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
                className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                  Tier {pair.tier}
                  {pair.tier === 2 ? ` · ${pair.dateDiffDays} day gap` : " · same date"}
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
