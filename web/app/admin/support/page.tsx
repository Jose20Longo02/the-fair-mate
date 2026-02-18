"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUTTON_BLUE = "#1e40af";
const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

type Ticket = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { status: string; adminNotes: string }>>({});

  const loadTickets = () => {
    setLoading(true);
    const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/admin/support${params}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login?from=/admin/support";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data || data.error) return;
        const list: Ticket[] = data.tickets ?? [];
        setTickets(list);
        setEdits((prev) => {
          const next = { ...prev };
          list.forEach((t) => {
            next[t.id] = { status: t.status, adminNotes: t.adminNotes ?? "" };
          });
          return next;
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  async function handleUpdate(ticketId: string) {
    const edit = edits[ticketId];
    if (!edit) return;
    setUpdatingId(ticketId);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: edit.status, adminNotes: edit.adminNotes || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId
              ? { ...t, status: data.ticket.status, adminNotes: data.ticket.adminNotes }
              : t
          )
        );
        setEdits((prev) => ({
          ...prev,
          [ticketId]: { status: data.ticket.status, adminNotes: data.ticket.adminNotes ?? "" },
        }));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const formatDate = (s: string) => new Date(s).toLocaleString();

  const selectClass =
    "rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";
  const textareaClass =
    "w-full min-w-0 max-w-[200px] rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="text-sm font-medium text-stone-400 transition hover:text-white"
        >
          ← Dashboard
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Support tickets
      </h1>
      <p className="mt-2 text-stone-400">
        User support requests from the contact form. Update status and add notes.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-stone-400">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-600/80 bg-stone-800/80">
        {loading ? (
          <p className="p-8 text-center text-stone-400">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="p-8 text-center text-stone-400">No tickets with this filter.</p>
        ) : (
          <table className="min-w-full divide-y divide-stone-600/80 text-left text-sm">
            <thead className="bg-stone-700/50">
              <tr>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Date</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Name</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Email</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Message</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Status</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4 hidden xl:table-cell">
                  Admin notes
                </th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-600/60">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-stone-700/30">
                  <td className="whitespace-nowrap px-3 py-3 text-stone-400 sm:px-4">
                    {formatDate(t.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-medium text-white sm:px-4">{t.name}</td>
                  <td className="px-3 py-3 text-stone-300 sm:px-4">
                    <a
                      href={`mailto:${t.email}`}
                      className="underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                    >
                      {t.email}
                    </a>
                  </td>
                  <td className="max-w-[250px] px-3 py-3 sm:px-4">
                    <span className="line-clamp-3 text-stone-400" title={t.message}>
                      {t.message}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <select
                      value={edits[t.id]?.status ?? t.status}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [t.id]: {
                            ...prev[t.id],
                            status: e.target.value,
                            adminNotes: prev[t.id]?.adminNotes ?? t.adminNotes ?? "",
                          },
                        }))
                      }
                      className={selectClass}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 xl:table-cell">
                    <textarea
                      rows={2}
                      className={textareaClass}
                      placeholder="Internal notes"
                      value={edits[t.id]?.adminNotes ?? t.adminNotes ?? ""}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [t.id]: {
                            ...prev[t.id],
                            status: prev[t.id]?.status ?? t.status,
                            adminNotes: e.target.value,
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => handleUpdate(t.id)}
                      disabled={updatingId === t.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      {updatingId === t.id ? "…" : "Update"}
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
