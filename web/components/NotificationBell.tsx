"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getWsToken, wsUrlWithToken } from "@/lib/ws-auth";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
};

type ToastNotification = {
  id: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [mounted, setMounted] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = () => {
    fetch("/api/notifications?limit=8")
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
    const t = setInterval(fetchNotifications, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getWsToken();
      if (!token) return;
      const base = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002").replace(/^http/, "ws");
      const ws = new WebSocket(wsUrlWithToken(base, token));
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "presence", userId }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notificationNew" && data.notification) {
            setToast({
              id: data.notification.id,
              title: data.notification.title,
              message: data.notification.message ?? null,
              linkUrl: data.notification.linkUrl ?? null,
            });
            fetchNotifications();
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = setTimeout(() => setToast(null), 6000);
          }
          if (data.type === "challengeUpdated") {
            window.dispatchEvent(new CustomEvent("challenge-updated"));
          }
          if (data.type === "challengeAccepted" && data.gameId) {
            router.push(`/partida/${data.gameId}`);
          }
        } catch (e) {
          console.error("[NotificationBell] Error processing WS message:", e);
        }
      };
      ws.onerror = () => {
        // WebSocket may be unavailable (e.g. server not running); notifications still work via HTTP polling
      };
    })();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [userId, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && unreadCount > 0) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readAll" }),
      }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      });
    }
  }, [open]);

  const isChallengeNotification = (type: string) =>
    type === "challenge_received" ||
    type === "challenge_counter_proposal" ||
    type === "challenge_rejected" ||
    type === "challenge_cancelled";

  function goTo(linkUrl: string, type?: string) {
    setOpen(false);
    const url = type && isChallengeNotification(type) ? "/#my-challenges" : linkUrl;
    router.push(url);
  }

  const formatDate = (s: string) => {
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative shrink-0 overflow-visible" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-stone-400 hover:bg-white/10 hover:text-white"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-stone-600 bg-stone-800 py-0 shadow-xl">
          <div className="border-b border-stone-600/80 px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">No notifications</p>
            ) : (
              <ul className="py-1">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`border-b border-stone-600/60 last:border-0 ${
                      !n.read ? "bg-stone-700/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2 px-4 py-3">
                      <div className="min-w-0 flex-1 text-left text-sm">
                        <p className="font-medium text-white">{n.title}</p>
                        {n.message && (
                          <p className="mt-0.5 line-clamp-2 text-stone-400">{n.message}</p>
                        )}
                        <p className="mt-1 text-xs text-stone-500">{formatDate(n.createdAt)}</p>
                      </div>
                      {(n.linkUrl || isChallengeNotification(n.type)) && (
                        <button
                          type="button"
                          onClick={() => goTo(n.linkUrl || "/#my-challenges", n.type)}
                          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                          style={{ backgroundColor: "#1e40af" }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-stone-600/80 px-2 py-2">
            <Link
              href="/cuenta/notificaciones"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-center text-sm font-medium text-white transition hover:bg-stone-700"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}

      {mounted && toast && createPortal(
        <div
          role="alert"
          className="fixed top-[60%] right-6 z-[9999] w-80 max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-xl border border-stone-600 bg-stone-800 p-4 shadow-2xl"
          style={{ pointerEvents: 'auto' }}
        >
          <p className="font-semibold text-white">{toast.title}</p>
          {toast.message && <p className="mt-1 text-sm text-stone-400 line-clamp-2">{toast.message}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            {toast.linkUrl && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                  router.push(toast.linkUrl!);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: "#1e40af" }}
              >
                View
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setToast(null);
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
              }}
              className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm font-medium text-stone-300 transition hover:bg-stone-700 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
