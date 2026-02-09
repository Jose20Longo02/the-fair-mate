"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STAKES = [
  { label: "$1", cents: 100 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
];

export default function MatchmakingPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "searching" | "matched" | "error">("idle");
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const matchedRef = useRef(false);
  const searchingRef = useRef(false);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  function joinQueue(stake: number) {
    setError("");
    setStatus("searching");
    matchedRef.current = false;
    searchingRef.current = true;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";
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
          router.push(`/partida/${data.gameId}`);
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
  }

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
