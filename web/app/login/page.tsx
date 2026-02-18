"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
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
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Log in</h1>
          <p className="mt-1 text-stone-400">Sign in to your account.</p>

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
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-stone-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-stone-500 transition hover:text-stone-300"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2.5 text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BUTTON_BLUE }}
            >
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium underline hover:no-underline" style={{ color: "#3794FF" }}>
              Sign up
            </Link>
          </p>
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

export default function Login() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-6 text-white shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Log in</h1>
          <p className="mt-4 text-stone-400">Loading…</p>
        </div>
      </div>
    </main>
  );
}
