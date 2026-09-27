/**
 * CsvTable
 *
 * This is a Server-Component-safe presentational table: no hooks, no browser
 * APIs. We still import it from a Client Component (the dashboard) which is
 * allowed — Client Components may render child components that themselves
 * have no `"use client"` directive.
 */

import type { ParsedCsv } from "@/lib/types";

type CsvTableProps = {
  title: string;
  data: ParsedCsv | null;
  emptyMessage: string;
};

export function CsvTable({ title, data, emptyMessage }: CsvTableProps) {
  if (!data) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500">{data.fileName}</p>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {data.headers.map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-3 py-2 font-medium text-slate-600"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={`${data.kind}-${index}`} className="border-t border-slate-100">
                {data.headers.map((header) => (
                  <td key={header} className="whitespace-nowrap px-3 py-2 text-slate-800">
                    {row[header] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
