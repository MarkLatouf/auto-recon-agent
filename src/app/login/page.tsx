/**
 * Public login route. Middleware sends unauthenticated users here
 * when they try to open `/` or `/history`.
 */

import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Auto-reconciliation
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">
          Use your email and password. New here? Fill the same fields and click Sign Up.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
