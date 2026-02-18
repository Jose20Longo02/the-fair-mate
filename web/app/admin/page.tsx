"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

const BUTTON_BLUE = "#1e40af";

type Stats = {
  totalUsers: number;
  totalGames: number;
  gamesToday: number;
  gamesThisWeek: number;
  activeGames: number;
  statusCounts: Record<string, number>;
  totalVolumeCents: number;
  totalCommissionCents: number;
  failedSettlementsCount: number;
  depositsTodayCents: number;
  withdrawalsTodayCents: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login?from=/admin";
          return null;
        }
        if (!r.ok) {
          setError("Failed to load stats");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => setError("Connection error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-8">
        <p className="text-stone-400">Loading…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-8">
        <p className="text-red-400">{error || "No stats"}</p>
        <Link href="/admin" className="mt-4 inline-block text-stone-400 hover:text-white">
          Retry
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Dashboard
      </h1>
      <p className="mt-2 text-stone-400">Overview and quick access.</p>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Total users</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Total games</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalGames}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Games today</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.gamesToday}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Games (7 days)</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.gamesThisWeek}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 p-4" style={{ backgroundColor: "rgba(30, 64, 175, 0.2)" }}>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400 sm:text-sm">Active games</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.activeGames}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">By status</p>
            <ul className="mt-1 space-y-0.5 text-sm text-stone-400">
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <li key={status}>{status}: {count}</li>
              ))}
              {Object.keys(stats.statusCounts).length === 0 && (
                <li className="text-stone-500">—</li>
              )}
            </ul>
          </div>
        </div>

        {stats.failedSettlementsCount > 0 && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-400">Failed on-chain settlements: {stats.failedSettlementsCount}</p>
            <p className="mt-1 text-xs text-stone-400">Cron retries these automatically. Check logs or Games list filtered by settlement status.</p>
          </div>
        )}

        <h2 className="mb-4 mt-8 text-lg font-semibold text-white">Revenue &amp; cash flow</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Total volume</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">${(stats.totalVolumeCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 p-4" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400 sm:text-sm">Commission ({PLATFORM_FEE_PERCENT * 100}%)</p>
            <p className="mt-1 text-xl font-bold text-emerald-400 sm:text-2xl">${(stats.totalCommissionCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Deposits today</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">${(stats.depositsTodayCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Withdrawals today</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">${(stats.withdrawalsTodayCents / 100).toFixed(2)}</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-white">Quick access</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/games"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">♟️</span>
            <span className="font-semibold text-white">Games</span>
            <span className="mt-1 text-sm text-stone-400">History with filters (user, ID, status, dates)</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">👤</span>
            <span className="font-semibold text-white">Users</span>
            <span className="mt-1 text-sm text-stone-400">List, metrics, return %, user detail</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">📋</span>
            <span className="font-semibold text-white">Reports</span>
            <span className="mt-1 text-sm text-stone-400">Claims and result review</span>
          </Link>
          <Link
            href="/admin/support"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">💬</span>
            <span className="font-semibold text-white">Support</span>
            <span className="mt-1 text-sm text-stone-400">User support tickets from the contact form</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
