"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUTTON_BLUE = "#1e40af";

type Stats = {
  totalUsers: number;
  totalGames: number;
  gamesToday: number;
  gamesThisWeek: number;
  activeGames: number;
  statusCounts: Record<string, number>;
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
        <p className="text-stone-400">Cargando…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-8">
        <p className="text-red-400">{error || "No stats"}</p>
        <Link href="/admin" className="mt-4 inline-block text-stone-400 hover:text-white">
          Reintentar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Dashboard
      </h1>
      <p className="mt-2 text-stone-400">Resumen y acceso rápido.</p>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Resumen</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Usuarios totales</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Partidas totales</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.totalGames}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Partidas hoy</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.gamesToday}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Partidas (7 días)</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.gamesThisWeek}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 p-4" style={{ backgroundColor: "rgba(30, 64, 175, 0.2)" }}>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400 sm:text-sm">Partidas activas</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stats.activeGames}</p>
          </div>
          <div className="rounded-xl border border-stone-600/80 bg-stone-800/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 sm:text-sm">Por estado</p>
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
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-white">Acceso rápido</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/games"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">♟️</span>
            <span className="font-semibold text-white">Partidas</span>
            <span className="mt-1 text-sm text-stone-400">Historial con filtros (usuario, ID, estado, fechas)</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">👤</span>
            <span className="font-semibold text-white">Usuarios</span>
            <span className="mt-1 text-sm text-stone-400">Lista, métricas, % retorno, detalle por usuario</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex flex-col rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 transition hover:border-stone-500 hover:bg-stone-800 sm:p-6"
          >
            <span className="text-3xl mb-2">📋</span>
            <span className="font-semibold text-white">Reportes</span>
            <span className="mt-1 text-sm text-stone-400">Reclamaciones y revisión de resultados</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
