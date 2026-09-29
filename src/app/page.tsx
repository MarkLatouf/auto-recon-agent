/**
 * Home page — a Server Component.
 *
 * Workspace is a Client Component so the dashboard can use React state.
 * `/?session=<id>` opens a saved session after you pick one on /history.
 */

import { Workspace } from "@/components/Workspace";

type HomePageProps = {
  searchParams: Promise<{ session?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { session } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Workspace initialView="new" inspectSessionId={session ?? null} />
    </main>
  );
}
