/**
 * Past Sessions lives on its own URL so middleware can protect `/history`.
 */

import { Workspace } from "@/components/Workspace";

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Workspace initialView="history" />
    </main>
  );
}
