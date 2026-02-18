"use client";

import Link from "next/link";
import { useState } from "react";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-6 text-white shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Forgot password</h1>
          <p className="mt-1 text-stone-400">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="mt-8">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm font-medium text-emerald-400">Check your inbox</p>
                <p className="mt-1 text-sm text-stone-400">
                  If an account with that email exists, we sent a password reset link. It expires in 1 hour.
                </p>
              </div>
              <Link
                href="/login"
                className="mt-6 block text-center text-sm font-medium text-stone-400 transition hover:text-white"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-stone-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2.5 text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: BUTTON_BLUE }}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-400">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-medium underline hover:no-underline"
                  style={{ color: "#3794FF" }}
                >
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
        <p className="mt-6 text-center">
          <Link href="/" className="text-sm text-stone-400 transition hover:text-white">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
