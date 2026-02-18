"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUTTON_BLUE = "#1e40af";
const STATUS_OPTIONS = ["new", "in_review", "planned", "closed"];

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_review: "In review",
  planned: "Planned",
  closed: "Closed",
};

type FeedbackEntry = {
  id: string;
  userId: string;
  emailSnapshot: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export default function AdminFeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { status: string; adminNotes: string }>>({});

  const loadFeedback = () => {
    setLoading(true);
    const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/admin/feedback${params}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login?from=/admin/feedback";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data || data.error) return;
        const list: FeedbackEntry[] = data.feedback ?? [];
        setEntries(list);
        setEdits((prev) => {
          const next = { ...prev };
          list.forEach((f) => {
            next[f.id] = { status: f.status, adminNotes: f.adminNotes ?? "" };
          });
          return next;
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFeedback();
  }, [statusFilter]);

  async function handleUpdate(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: edit.status,
          adminNotes: edit.adminNotes || undefined,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { feedback?: FeedbackEntry };
      if (!data.feedback) return;
      setEntries((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...data.feedback } : f))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const formatDate = (s: string) => new Date(s).toLocaleString();

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
        User feedback
      </h1>
      <p className="mt-2 text-stone-400">
        Product suggestions and improvement ideas submitted by logged-in users.
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
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-stone-400">No feedback with this filter.</p>
        ) : (
          <table className="min-w-full divide-y divide-stone-600/80 text-left text-sm">
            <thead className="bg-stone-700/50">
              <tr>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Date</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">User</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Email</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Feedback</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Status</th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4 hidden xl:table-cell">
                  Admin notes
                </th>
                <th className="px-3 py-3 font-medium text-stone-300 sm:px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-600/60">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-stone-700/30">
                  <td className="whitespace-nowrap px-3 py-3 text-stone-400 sm:px-4">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-medium text-white sm:px-4">
                    {entry.user.name || entry.user.email}
                  </td>
                  <td className="px-3 py-3 text-stone-300 sm:px-4">
                    <a
                      href={`mailto:${entry.emailSnapshot}`}
                      className="underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                    >
                      {entry.emailSnapshot}
                    </a>
                  </td>
                  <td className="max-w-[320px] px-3 py-3 sm:px-4">
                    <span className="line-clamp-4 text-stone-300" title={entry.message}>
                      {entry.message}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <select
                      value={edits[entry.id]?.status ?? entry.status}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [entry.id]: {
                            status: e.target.value,
                            adminNotes: prev[entry.id]?.adminNotes ?? entry.adminNotes ?? "",
                          },
                        }))
                      }
                      className="rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <textarea
                      rows={2}
                      value={edits[entry.id]?.adminNotes ?? entry.adminNotes ?? ""}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [entry.id]: {
                            status: prev[entry.id]?.status ?? entry.status,
                            adminNotes: e.target.value,
                          },
                        }))
                      }
                      className="w-full min-w-0 max-w-[220px] rounded-lg border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                      placeholder="Internal notes"
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => void handleUpdate(entry.id)}
                      disabled={updatingId === entry.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      {updatingId === entry.id ? "…" : "Update"}
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
