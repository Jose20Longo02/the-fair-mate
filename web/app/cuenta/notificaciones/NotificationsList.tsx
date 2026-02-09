"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsList() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    fetch("/api/notifications?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function markAsRead(id: string, linkUrl: string | null) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    if (linkUrl) router.push(linkUrl);
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setMarkingAll(false);
  }

  const formatDate = (s: string) => new Date(s).toLocaleString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (loading) {
    return <p className="mt-5 text-sm text-stone-500 sm:mt-6">Loading notifications…</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-center text-sm text-stone-400 sm:mt-8 sm:p-6">
        No notifications.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="min-h-[44px] rounded-xl border border-stone-500/80 bg-stone-700/60 px-4 py-2.5 text-sm font-medium text-stone-300 hover:bg-stone-600/60 disabled:opacity-50 touch-manipulation"
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      )}

      <ul className="space-y-2 sm:space-y-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-3 sm:p-4 ${
              !n.read
                ? "border-amber-500/50 bg-amber-950/40"
                : "border-stone-600/80 bg-stone-800/90"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className={`text-base font-medium sm:text-base ${!n.read ? "text-white" : "text-stone-300"}`}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="mt-1 break-words text-sm text-stone-400">{n.message}</p>
                )}
                <p className="mt-1 text-xs text-stone-500">{formatDate(n.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {n.linkUrl && (
                  <Link
                    href={n.linkUrl}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 touch-manipulation"
                    style={{ backgroundColor: "#1e40af" }}
                  >
                    Go
                  </Link>
                )}
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markAsRead(n.id, null)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-500/80 bg-stone-700/60 px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-600/60 touch-manipulation"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
