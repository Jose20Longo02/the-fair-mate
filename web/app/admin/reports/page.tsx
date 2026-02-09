"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUTTON_BLUE = "#1e40af";
const STATUS_OPTIONS = ["pending", "in_review", "resolved", "dismissed"];

type Report = {
  id: string;
  gameId: string;
  userId: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  game: {
    id: string;
    status: string;
    winner: string | null;
    stake: number;
    createdAt: string;
    white: { id: string; email: string; name: string | null };
    black: { id: string; email: string; name: string | null };
  };
  user: { id: string; email: string; name: string | null };
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [reportEdits, setReportEdits] = useState<Record<string, { status: string; adminNotes: string }>>({});

  const loadReports = () => {
    setLoading(true);
    const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/admin/reports${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        const list = data.reports ?? [];
        setReports(list);
        setReportEdits((prev) => {
          const next = { ...prev };
          list.forEach((r: Report) => {
            next[r.id] = { status: r.status, adminNotes: r.adminNotes ?? "" };
          });
          return next;
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  async function handleUpdateReport(reportId: string) {
    const edit = reportEdits[reportId];
    if (!edit) return;
    setUpdatingReportId(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: edit.status, adminNotes: edit.adminNotes || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, status: data.report.status, adminNotes: data.report.adminNotes }
              : r
          )
        );
        setReportEdits((prev) => ({
          ...prev,
          [reportId]: { status: data.report.status, adminNotes: data.report.adminNotes ?? "" },
        }));
      }
    } finally {
      setUpdatingReportId(null);
    }
  }

  const formatDate = (s: string) => new Date(s).toLocaleString();
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

  const selectClass = "rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";
  const textareaClass = "w-full min-w-0 max-w-[180px] rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Reportes</h1>
      <p className="mt-2 text-stone-400">
        Reclamaciones y solicitudes de revisión. Actualiza estado y notas (visibles para el usuario en &quot;Mis reportes&quot;).
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-stone-400">Estado:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-600/80 bg-stone-800/80">
        {loading ? (
          <p className="p-8 text-center text-stone-400">Cargando…</p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-center text-stone-400">No hay reportes con este filtro.</p>
        ) : (
          <table className="min-w-full divide-y divide-stone-600/80 text-left text-sm">
            <thead className="bg-stone-700/50">
              <tr>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Fecha</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Partida</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Reportador</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4 hidden lg:table-cell">Mensaje</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Estado</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4 hidden xl:table-cell">Notas admin</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-600/60">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-stone-700/30">
                  <td className="whitespace-nowrap px-3 py-3 text-stone-400 sm:px-4">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <Link
                      href={`/admin/games/${r.game.id}`}
                      className="font-medium text-white underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                    >
                      Revisar partida
                    </Link>
                    <span className="block font-mono text-xs text-stone-500">{r.game.id.slice(0, 8)}…</span>
                    <span className="block text-xs text-stone-500">
                      {r.game.white.name || r.game.white.email} vs {r.game.black.name || r.game.black.email}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span className="font-medium text-white">{r.user.name || r.user.email}</span>
                    <span className="block text-xs text-stone-500">{r.user.email}</span>
                  </td>
                  <td className="max-w-[200px] px-3 py-3 lg:table-cell">
                    <span className="line-clamp-2 text-stone-400" title={r.message}>
                      {r.message}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <select
                      value={reportEdits[r.id]?.status ?? r.status}
                      onChange={(e) =>
                        setReportEdits((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], status: e.target.value, adminNotes: prev[r.id]?.adminNotes ?? r.adminNotes ?? "" },
                        }))
                      }
                      className={selectClass}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 xl:table-cell">
                    <textarea
                      rows={2}
                      className={textareaClass}
                      placeholder="Notas (visibles para el usuario)"
                      value={reportEdits[r.id]?.adminNotes ?? r.adminNotes ?? ""}
                      onChange={(e) =>
                        setReportEdits((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], status: prev[r.id]?.status ?? r.status, adminNotes: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => handleUpdateReport(r.id)}
                      disabled={updatingReportId === r.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      {updatingReportId === r.id ? "…" : "Actualizar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
