/**
 * CSV parsing helpers.
 *
 * Papa Parse runs in the browser and turns a File into JSON-like rows.
 * We wrap it in a Promise so React components can use async/await.
 */

import Papa from "papaparse";
import type { CsvRow, DatasetKind, ParsedCsv } from "./types";

/**
 * Reads a CSV File and returns headers + rows.
 * Rejects if the file is empty or Papa Parse reports an error.
 */
export function parseCsvFile(file: File, kind: DatasetKind): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      // First row becomes object keys: { Date: "2026-01-02", Amount: "12.50" }
      header: true,
      skipEmptyLines: true,
      // Trim spaces around headers and values so matching is easier later.
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0]?.message ?? "Could not parse CSV"));
          return;
        }

        const headers = results.meta.fields?.filter(Boolean) ?? [];
        const rows = results.data.filter((row) =>
          Object.values(row).some((cell) => cell.length > 0),
        );

        if (headers.length === 0 || rows.length === 0) {
          reject(new Error("This CSV looks empty. Check that it has a header row and data."));
          return;
        }

        resolve({
          kind,
          fileName: file.name,
          headers,
          rows,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
