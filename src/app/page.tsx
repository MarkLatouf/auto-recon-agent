/**
 * Home page — a Server Component.
 *
 * Workspace is a Client Component so the New / Past Sessions toggle can
 * use React state. This file still owns the page route (`/`).
 */

import { Workspace } from "@/components/Workspace";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Workspace />
    </main>
  );
}
