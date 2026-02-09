"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUTTON_BLUE = "#1e40af";
const STATUS_OPTIONS = ["active", "checkmate", "stalemate", "draw", "resigned", "timeout", "disconnected"];

type Game = {
  id: string;
  status: string;
  stake: number;
  winner: string | null;
  createdAt: string;
  white: { id: string; email: string; name: string | null; elo: number };
  black: { id: string; email: string; name: string | null; elo: number };
};

type UserOption = { id: string; email: string; name: string | null };

const LIMIT = 20;

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: "",
    gameId: "",
    status: "",
    from: "",
    to: "",
  });
  const [offset, setOffset] = useState(0);

  const loadGames = (opts?: { offset?: number }) => {
    setLoading(true);
    const off = opts?.offset ?? offset;
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(off));
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.gameId) params.set("gameId", filters.gameId);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    fetch(`/api/admin/games?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setGames(data.games ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGames();
  }, [offset]);

  useEffect(() => {
    fetch("/api/admin/users?limit=100")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const formatDate = (s: string) => new Date(s).toLocaleString();
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const inputClass = "mt-1 w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";
  const labelClass = "block text-xs font-medium text-stone-400";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Historial de partidas</h1>
      <p className="mt-2 text-stone-400">Últimas partidas con filtros. 20 por página.</p>

      <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/80 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className={labelClass}>Usuario</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>ID partida</label>
            <input
              type="text"
              placeholder="Ej. clxxx..."
              value={filters.gameId}
              onChange={(e) => setFilters((f) => ({ ...f, gameId: e.target.value }))}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className={inputClass}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => { setOffset(0); loadGames({ offset: 0 }); }}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: BUTTON_BLUE }}
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters({ userId: "", gameId: "", status: "", from: "", to: "" });
                setOffset(0);
                loadGames({ offset: 0 });
              }}
              className="w-full rounded-lg border border-stone-600 px-4 py-2.5 text-sm font-medium text-stone-300 transition hover:bg-stone-700 sm:w-auto"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-600/80 bg-stone-800/80">
        {loading ? (
          <p className="p-8 text-center text-stone-400">Cargando…</p>
        ) : games.length === 0 ? (
          <p className="p-8 text-center text-stone-400">No hay partidas con estos filtros.</p>
        ) : (
          <>
            <table className="min-w-full divide-y divide-stone-600/80 text-left text-sm">
              <thead className="bg-stone-700/50">
                <tr>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Fecha</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Blancas</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Negras</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Stake</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Estado</th>
                  <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-600/60">
                {games.map((g) => (
                  <tr key={g.id} className="hover:bg-stone-700/30">
                    <td className="whitespace-nowrap px-3 py-3 text-stone-400 sm:px-4">{formatDate(g.createdAt)}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <span className="font-medium text-white">{g.white.name || g.white.email}</span>
                      <span className="text-stone-500"> ({g.white.elo})</span>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <span className="font-medium text-white">{g.black.name || g.black.email}</span>
                      <span className="text-stone-500"> ({g.black.elo})</span>
                    </td>
                    <td className="px-3 py-3 text-stone-300 sm:px-4">{formatCents(g.stake)}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <span className="inline-flex rounded-full bg-stone-600/80 px-2 py-0.5 text-xs font-medium text-stone-300">
                        {g.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <Link
                        href={`/admin/games/${g.id}`}
                        className="font-medium text-white underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                      >
                        Revisar partida
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > LIMIT && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-600/80 px-4 py-3">
                <p className="text-sm text-stone-400">
                  {total} partidas · Página {currentPage} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                    disabled={offset === 0}
                    className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 disabled:opacity-50 hover:bg-stone-700"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((o) => o + LIMIT)}
                    disabled={offset + LIMIT >= total}
                    className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 disabled:opacity-50 hover:bg-stone-700"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
