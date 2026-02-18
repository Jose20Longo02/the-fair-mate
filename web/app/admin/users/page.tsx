"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BUTTON_BLUE = "#1e40af";
const PAGE_SIZE = 15;

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  elo: number;
  balance: number;
  createdAt: string;
  gamesPlayed: number;
};

type UserDetail = {
  user: UserRow & { gamesPlayed: number };
  recentGames: Array<{
    id: string;
    status: string;
    stake: number;
    createdAt: string;
    white: { id: string; name: string | null; email: string };
    black: { id: string; name: string | null; email: string };
  }>;
  recentLedger: Array<{ id: string; type: string; amount: number; createdAt: string; description: string | null }>;
  reports: Array<{ id: string; message: string; status: string; createdAt: string; game: { id: string } }>;
};

type Stats = {
  totalUsers: number;
  totalGames: number;
  activeLast7Days: number;
  returnRatePct: number;
  avgGamesPerUser: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [modalUser, setModalUser] = useState<UserDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const loadUsers = (opts?: { offset?: number }) => {
    setLoading(true);
    const off = opts?.offset ?? offset;
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(off));
    if (search) params.set("search", search);
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [offset]);

  useEffect(() => {
    fetch("/api/admin/users/stats")
      .then((r) => r.json())
      .then((data) => (data.error ? null : setStats(data)))
      .catch(() => {});
  }, []);

  function openUserModal(userId: string) {
    setModalLoading(true);
    setModalUser(null);
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setModalUser(data);
      })
      .finally(() => setModalLoading(false));
  }

  const formatDate = (s: string) => new Date(s).toLocaleString();
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const inputClass = "rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Users</h1>
      <p className="mt-2 text-stone-400">Player list with metrics. 15 per page.</p>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Total users</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Total games</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalGames}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Active (7 days)</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.activeLast7Days}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 p-4" style={{ backgroundColor: "rgba(30, 64, 175, 0.2)" }}>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Return % (7 days)</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.returnRatePct}%</p>
            <p className="text-xs text-stone-500">played in last 7 days</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Avg. games/user</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.avgGamesPerUser}</p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/80 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Search</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setOffset(0), loadUsers({ offset: 0 }))}
            className={`${inputClass} w-full min-w-0 sm:w-64`}
          />
          <button
            type="button"
            onClick={() => { setOffset(0); loadUsers({ offset: 0 }); }}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: BUTTON_BLUE }}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => { setSearch(""); setOffset(0); loadUsers({ offset: 0 }); }}
            className="rounded-lg border border-stone-600 px-4 py-2.5 text-sm font-medium text-stone-300 transition hover:bg-stone-700"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-600/80 bg-stone-800/80">
        {loading ? (
          <p className="p-8 text-center text-stone-400">Loading…</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-stone-400">No users match that criteria.</p>
        ) : (
          <>
            <table className="min-w-full divide-y divide-stone-600/80 text-left text-sm">
              <thead className="bg-stone-700/50">
                <tr>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Email</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Name</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">ELO</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Balance</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Games</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4 hidden md:table-cell">Registered</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-600/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-700/30">
                    <td className="px-3 py-3 font-medium text-white sm:px-4">{u.email}</td>
                    <td className="px-3 py-3 text-stone-400 sm:px-4">{u.name || "—"}</td>
                    <td className="px-3 py-3 text-stone-300 sm:px-4">{u.elo}</td>
                    <td className="px-3 py-3 text-stone-300 sm:px-4">{formatCents(u.balance)}</td>
                    <td className="px-3 py-3 text-stone-300 sm:px-4">{u.gamesPlayed}</td>
                    <td className="hidden px-3 py-3 text-stone-400 md:table-cell sm:px-4">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => openUserModal(u.id)}
                        className="font-medium text-white underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                      >
                        View detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-600/80 px-4 py-3">
                <p className="text-sm text-stone-400">
                  {total} users · Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 disabled:opacity-50 hover:bg-stone-700"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                    className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 disabled:opacity-50 hover:bg-stone-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle usuario */}
      {(modalUser !== null || modalLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !modalLoading && setModalUser(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-stone-600 bg-stone-800 p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <p className="text-stone-400">Loading…</p>
            ) : modalUser ? (
              <>
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <h2 className="text-xl font-bold text-white">User detail</h2>
                  <button
                    type="button"
                    onClick={() => setModalUser(null)}
                    className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-700"
                  >
                    Close
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-stone-500">ID</dt>
                  <dd className="break-all font-mono text-xs text-stone-300">{modalUser.user.id}</dd>
                  <dt className="text-stone-500">Email</dt>
                  <dd className="text-stone-300">{modalUser.user.email}</dd>
                  <dt className="text-stone-500">Name</dt>
                  <dd className="text-stone-300">{modalUser.user.name || "—"}</dd>
                  <dt className="text-stone-500">ELO</dt>
                  <dd className="text-stone-300">{modalUser.user.elo}</dd>
                  <dt className="text-stone-500">Balance</dt>
                  <dd className="text-stone-300">{formatCents(modalUser.user.balance)}</dd>
                  <dt className="text-stone-500">Games played</dt>
                  <dd className="text-stone-300">{modalUser.user.gamesPlayed}</dd>
                  <dt className="text-stone-500">Registered</dt>
                  <dd className="text-stone-300">{formatDate(modalUser.user.createdAt)}</dd>
                </dl>
                <div className="mt-6">
                  <h3 className="font-semibold text-white">Recent games</h3>
                  <ul className="mt-2 space-y-1 text-sm text-stone-400">
                    {modalUser.recentGames.length === 0 ? (
                      <li className="text-stone-500">None</li>
                    ) : (
                      modalUser.recentGames.map((g) => (
                        <li key={g.id}>
                          <Link href={`/admin/games/${g.id}`} className="text-white underline hover:no-underline">
                            {g.id.slice(0, 8)}…
                          </Link>
                          {" "}{g.white.name || g.white.email} vs {g.black.name || g.black.email} · {formatCents(g.stake)} · {g.status}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold text-white">Recent transactions</h3>
                  <ul className="mt-2 space-y-1 text-sm text-stone-400">
                    {modalUser.recentLedger.length === 0 ? (
                      <li className="text-stone-500">None</li>
                    ) : (
                      modalUser.recentLedger.map((e) => (
                        <li key={e.id}>
                          {e.type} {e.amount >= 0 ? "+" : ""}{formatCents(e.amount)}
                          {e.description && ` — ${e.description}`}
                          <span className="ml-1 text-stone-500">{formatDate(e.createdAt)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold text-white">Reports submitted</h3>
                  <ul className="mt-2 space-y-1 text-sm text-stone-400">
                    {modalUser.reports.length === 0 ? (
                      <li className="text-stone-500">None</li>
                    ) : (
                      modalUser.reports.map((r) => (
                        <li key={r.id}>
                          <Link href="/admin/reports" className="text-white underline hover:no-underline">
                            {r.id.slice(0, 8)}…
                          </Link>
                          {" "}{r.status} · {r.message.slice(0, 40)}…
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
