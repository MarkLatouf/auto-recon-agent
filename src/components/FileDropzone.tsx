"use client";

/**
 * FileDropzone
 *
 * A Client Component because it uses browser-only APIs: drag-and-drop,
 * <input type="file">, and React state.
 *
 * `"use client"` tells Next.js: "hydrate this in the browser so onClick
 * and onDrop work." Server Components cannot listen to those events.
 */

import { useCallback, useRef, useState } from "react";
import type { DatasetKind, ParsedCsv } from "@/lib/types";
import { parseCsvFile } from "@/lib/parseCsv";

type FileDropzoneProps = {
  kind: DatasetKind;
  label: string;
  hint: string;
  parsed: ParsedCsv | null;
  onParsed: (data: ParsedCsv) => void;
  onClear: () => void;
};

export function FileDropzone({
  kind,
  label,
  hint,
  parsed,
  onParsed,
  onClear,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      // Only accept CSV so users do not drop Excel workbooks by accident.
      const isCsv =
        file.type === "text/csv" ||
        file.name.toLowerCase().endsWith(".csv");

      if (!isCsv) {
        setError("Please upload a .csv file.");
        return;
      }

      setError(null);
      setIsReading(true);

      try {
        const data = await parseCsvFile(file, kind);
        onParsed(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to read this file.";
        setError(message);
      } finally {
        setIsReading(false);
      }
    },
    [kind, onParsed],
  );

  return (
    <section className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
        {parsed ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClear();
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      {parsed ? (
        <p className="mt-auto rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Loaded <span className="font-medium">{parsed.fileName}</span>
          {" · "}
          {parsed.rows.length} rows
          {" · "}
          {parsed.headers.length} columns
        </p>
      ) : (
        <button
          type="button"
          disabled={isReading}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            // preventDefault is required or the browser will not fire onDrop.
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
          className={[
            "mt-auto flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition",
            isDragging
              ? "border-teal-500 bg-teal-50"
              : "border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/50",
            isReading ? "cursor-wait opacity-70" : "cursor-pointer",
          ].join(" ")}
        >
          <span className="text-sm font-medium text-slate-700">
            {isReading ? "Reading CSV…" : "Drop a CSV here, or click to browse"}
          </span>
          <span className="mt-1 text-xs text-slate-500">.csv files only</span>
        </button>
      )}

      {/* Hidden native file picker; the dashed box above triggers it. */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
        }}
      />

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
