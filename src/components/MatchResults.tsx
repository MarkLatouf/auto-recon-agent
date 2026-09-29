"use client";

/**
 * MatchResults
 *
 * Unmatched lists are clickable for Manual Match.
 * Matched pairs render a derived filtered/sorted list from the dashboard —
 * the original `result.matched` array is never mutated here.
 */

import type { MatchResult, MatchTier, MatchTypeFilter, MatchedPair, ReconLine, SortConfig } from "@/lib/types";

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

function SortMark({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  return (
    <span className="ml-1 inline-flex flex-col text-[9px] leading-[9px] text-slate-400" aria-hidden>
      <span className={active && direction === "asc" ? "text-teal-700" : ""}>▲</span>
      <span className={active && direction === "desc" ? "text-teal-700" : ""}>▼</span>
    </span>
  );
}

type MatchResultsProps = {
  result: MatchResult;
  filteredAndSortedMatches: MatchedPair[];
  searchQuery: string;
  matchTypeFilter: MatchTypeFilter;
  sortConfig: SortConfig;
  onSearchQueryChange: (value: string) => void;
  onMatchTypeFilterChange: (value: MatchTypeFilter) => void;
  onToggleSort: (key: SortConfig["key"]) => void;
  selectedBankLineId: string | null;
  selectedLedgerLineId: string | null;
  onSelectBank: (id: string) => void;
  onSelectLedger: (id: string) => void;
};

export function MatchResults({
  result,
  filteredAndSortedMatches,
  searchQuery,
  matchTypeFilter,
  sortConfig,
  onSearchQueryChange,
  onMatchTypeFilterChange,
  onToggleSort,
  selectedBankLineId,
  selectedLedgerLineId,
  onSelectBank,
  onSelectLedger,
}: MatchResultsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Matched pairs</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredAndSortedMatches.length} of {result.matched.length} pairs
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="matched-search">
              Search matched pairs
            </label>
            <input
              id="matched-search"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search descriptions, memos, amounts…"
              className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 sm:flex-none sm:w-72"
            />
            <label className="sr-only" htmlFor="matched-type-filter">
              Filter by match type
            </label>
            <select
              id="matched-type-filter"
              value={matchTypeFilter}
              onChange={(event) => onMatchTypeFilterChange(event.target.value as MatchTypeFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            >
              <option value="All">All</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Tier 3">Tier 3</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
        </div>

        {result.matched.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No pairs yet. Run Auto-Match after saving a session.
          </p>
        ) : filteredAndSortedMatches.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No pairs match this search or filter.</p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-600">Type</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => onToggleSort("date")}
                      className="inline-flex items-center font-medium text-slate-600 hover:text-teal-800"
                    >
                      Date
                      <SortMark active={sortConfig.key === "date"} direction={sortConfig.direction} />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Bank / Ledger</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => onToggleSort("amount")}
                      className="inline-flex items-center font-medium text-slate-600 hover:text-teal-800"
                    >
                      Amount
                      <SortMark active={sortConfig.key === "amount"} direction={sortConfig.direction} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedMatches.map((pair) => (
                  <tr
                    key={`${pair.bank.id}-${pair.ledger.id}`}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          pair.tier === 3
                            ? "rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-violet-800"
                            : pair.tier === "manual"
                              ? "rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sky-800"
                              : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800"
                        }
                      >
                        {pairLabel(pair.tier, pair.dateDiffDays, pair.similarity)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <div>{pair.bank.transaction_date ?? "—"}</div>
                      <div className="text-xs text-slate-400">{pair.ledger.transaction_date ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div>{pair.bank.description ?? "—"}</div>
                      <div className="text-xs text-slate-500">{pair.ledger.description ?? "—"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">
                      <div>{money(pair.bank.amount)}</div>
                      <div className="text-xs text-slate-500">{money(pair.ledger.amount)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
