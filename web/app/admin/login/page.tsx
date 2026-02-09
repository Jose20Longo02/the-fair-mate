"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/admin";

  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid secret");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans sm:px-6"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Admin login
        </h1>
        <p className="mt-2 text-stone-400">
          Enter the admin secret to access the panel.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="secret" className="block text-sm font-medium text-stone-400">
              Admin secret
            </label>
            <input
              id="secret"
              type="password"
              autoComplete="off"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2.5 text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="Secret"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: BUTTON_BLUE }}
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>

        <p className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-stone-400 transition hover:text-white"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center font-sans text-stone-400" style={{ backgroundColor: PAGE_BG }}>
        Loading…
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}
