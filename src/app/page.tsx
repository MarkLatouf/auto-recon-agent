/**
 * Home page — a Server Component.
 *
 * In the App Router, files named `page.tsx` become routes.
 * This file is `/` (the homepage).
 *
 * It stays a Server Component: it renders static heading copy on the server,
 * then mounts <ReconDashboard />, which is a Client Component for uploads.
 */

import { ReconDashboard } from "@/components/ReconDashboard";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Auto-reconciliation
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          Bank vs ledger
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Upload two CSV files. We parse them in the browser and show both
          datasets side by side. Matching and saving to Supabase come next.
        </p>
      </header>

      <ReconDashboard />
    </main>
  );
}
