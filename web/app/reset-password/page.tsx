"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main
        className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 md:min-h-[calc(100vh-6rem)]"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-6 text-white shadow-xl sm:p-8">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Invalid link</h1>
            <p className="mt-2 text-stone-400">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block text-sm font-medium underline hover:no-underline"
              style={{ color: "#3794FF" }}
            >
              Request a new reset link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-6 text-white shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Reset password</h1>
          <p className="mt-1 text-stone-400">Choose a new password for your account.</p>

          {success ? (
            <div className="mt-8">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm font-medium text-emerald-400">Password updated</p>
                <p className="mt-1 text-sm text-stone-400">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>
              <Link
                href="/login"
                className="mt-6 block w-full rounded-lg px-4 py-3 text-center font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-stone-300">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2.5 text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-stone-300">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2.5 text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  placeholder="Repeat password"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
            </form>
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

export default function ResetPassword() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordFallback() {
  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-6 text-white shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Reset password</h1>
          <p className="mt-4 text-stone-400">Loading…</p>
        </div>
      </div>
    </main>
  );
}
