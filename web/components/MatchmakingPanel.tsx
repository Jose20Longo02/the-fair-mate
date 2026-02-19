"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getWsToken, wsUrlWithToken } from "@/lib/ws-auth";

const STAKES = [
  { label: "$1", cents: 100 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
];

export default function MatchmakingPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "searching" | "matched" | "error">("idle");
  const [error, setError] = useState("");
  const [searchElapsedSec, setSearchElapsedSec] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const matchedRef = useRef(false);
  const searchingRef = useRef(false);
  const noPlayersHint = status === "searching" && searchElapsedSec >= 30;

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  async function joinQueue(stake: number) {
    setError("");
    setStatus("searching");
    setSearchElapsedSec(0);
    matchedRef.current = false;
    searchingRef.current = true;
    const token = await getWsToken();
    if (!token) {
      searchingRef.current = false;
      setStatus("error");
      setError("Please log in to play.");
      return;
    }
    const base = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002").replace(/^http/, "ws");
    const wsUrl = wsUrlWithToken(base, token);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "joinQueue", userId, stake }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "matched" && data.gameId) {
          matchedRef.current = true;
          searchingRef.current = false;
          setStatus("matched");
          ws.close();
          wsRef.current = null;
          router.push(`/game/${data.gameId}`);
        }
        if (data.type === "matchError") {
          searchingRef.current = false;
          setStatus("error");
          setError(data.error || "Could not create game");
          ws.close();
          wsRef.current = null;
        }
      } catch {}
    };

    ws.onerror = () => {
      searchingRef.current = false;
      setStatus("error");
      setError("Server connection error");
      wsRef.current = null;
    };

    ws.onclose = () => {
      if (!matchedRef.current && searchingRef.current) {
        searchingRef.current = false;
        setStatus("idle");
        setError("Connection closed. Please try again.");
      }
      wsRef.current = null;
    };
  }

  function cancelSearch() {
    searchingRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setError("");
    setSearchElapsedSec(0);
  }

  function inviteFriend() {
    cancelSearch();
    if (typeof window === "undefined") return;
    const challengeSection = document.getElementById("challenge-someone");
    if (challengeSection) {
      challengeSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/play#challenge-someone");
  }

  useEffect(() => {
    if (status !== "searching") return;
    const id = setInterval(() => setSearchElapsedSec((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {STAKES.map(({ label, cents }) => (
          <button
            key={cents}
            type="button"
            disabled={status === "searching"}
            onClick={() => joinQueue(cents)}
            className="rounded-xl border border-stone-200 bg-white px-6 py-4 text-lg font-semibold text-stone-900 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      {status === "searching" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="font-medium text-amber-800">Searching for opponent…</p>
          <p className="mt-1 text-sm text-amber-700">
            Wait for another player to choose the same stake.
          </p>
          {noPlayersHint && (
            <div className="mx-auto mt-3 max-w-md rounded-md border border-amber-300 bg-amber-100 p-3 text-left">
              <p className="text-sm font-semibold text-amber-900">No players available at the moment.</p>
              <p className="mt-1 text-xs text-amber-800">
                We&apos;ll keep searching. You can also invite a friend or try another stake.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={inviteFriend}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  Invite a friend
                </button>
                <button
                  type="button"
                  onClick={cancelSearch}
                  className="rounded border border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
                >
                  Try another stake
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={cancelSearch}
            className="mt-3 text-sm font-medium text-amber-800 underline hover:no-underline"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "error" && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
