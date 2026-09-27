"use client";

/**
 * ReconDashboard
 *
 * Holds the two parsed CSVs in React state and lays out:
 * 1) two upload dropzones
 * 2) two tables side-by-side
 *
 * This must be a Client Component because useState lives in the browser.
 * The page (`src/app/page.tsx`) is a Server Component that simply renders us.
 */

import { useState } from "react";
import type { ParsedCsv } from "@/lib/types";
import { CsvTable } from "./CsvTable";
import { FileDropzone } from "./FileDropzone";

export function ReconDashboard() {
  const [bank, setBank] = useState<ParsedCsv | null>(null);
  const [ledger, setLedger] = useState<ParsedCsv | null>(null);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone
          kind="bank"
          label="Bank statement"
          hint="Transactions exported from your bank."
          parsed={bank}
          onParsed={setBank}
          onClear={() => setBank(null)}
        />
        <FileDropzone
          kind="ledger"
          label="Accounting ledger"
          hint="Journal lines exported from your books."
          parsed={ledger}
          onParsed={setLedger}
          onClear={() => setLedger(null)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CsvTable
          title="Bank statement preview"
          data={bank}
          emptyMessage="Upload a bank CSV to see its rows here."
        />
        <CsvTable
          title="Ledger preview"
          data={ledger}
          emptyMessage="Upload a ledger CSV to see its rows here."
        />
      </div>
    </div>
  );
}
