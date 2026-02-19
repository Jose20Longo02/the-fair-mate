"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import MiniChessBoard from "./MiniChessBoard";
import { getWsToken, wsUrlWithToken } from "@/lib/ws-auth";

const BUTTON_BLUE = "#1e40af";
const STAKES = [
  { label: "$1", cents: 100 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
];

export default function Home1v1Card({ userId, balanceCents }: { userId: string; balanceCents: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "searching" | "matched" | "error">("idle");
  const [error, setError] = useState("");
  const [selectedStake, setSelectedStake] = useState<number | null>(500);
  const wsRef = useRef<WebSocket | null>(null);
  const matchedRef = useRef(false);
  const searchingRef = useRef(false);
  const [searchElapsedSec, setSearchElapsedSec] = useState(0);
  const noPlayersHint = status === "searching" && searchElapsedSec >= 20;

  const canAffordStake = selectedStake != null && balanceCents >= selectedStake;

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  async function joinQueue(stake: number) {
    if (balanceCents < stake) {
      setError("Your balance is not sufficient for this stake.");
      setStatus("error");
      return;
    }
    setError("");
    setSelectedStake(stake);
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
      setError("Cannot connect to matchmaking server. Make sure the WebSocket server is running (npm run dev:ws in another terminal).");
      wsRef.current = null;
    };

    ws.onclose = (ev) => {
      if (!matchedRef.current && searchingRef.current) {
        searchingRef.current = false;
        setStatus("error");
        if (ev.code !== 1000 && !ev.wasClean) {
          setError("Connection closed. Is the WebSocket server running? Run: npm run dev:ws");
        } else {
          setStatus("idle");
          setError("Connection closed. Please try again.");
        }
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
    setSelectedStake(null);
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
    <div className="overflow-hidden rounded-xl border border-stone-600/90 bg-stone-800/90 text-white shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/25 hover:border-stone-500/80">
      <div
        className="py-3.5 text-center text-base font-semibold text-white shadow-inner sm:text-lg"
        style={{
          background: `linear-gradient(180deg, ${BUTTON_BLUE} 0%, #1e3a8a 100%)`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        1v1 Mode
      </div>
      <div className="p-5 sm:p-6 md:p-8" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.4) 0%, rgba(28,25,23,0.6) 100%)" }}>
        <p className="text-sm text-stone-300 leading-snug">
          Play focused, head-to-head chess against a single opponent at your level.
        </p>
        {/* Mobile: stack board then stakes. Desktop: side by side */}
        <div className="mt-5 flex flex-col items-center gap-6 sm:mt-6 md:flex-row md:items-start md:gap-6">
          <div className="shrink-0">
            <MiniChessBoard />
          </div>
          <div className="w-full min-w-0 flex-1 flex-col items-center space-y-4 text-center md:flex md:justify-center">
            <div className="w-full">
              <p className="text-sm font-medium text-stone-300 sm:text-base">Select Stake</p>
              <div className="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
                {STAKES.map(({ label, cents }) => (
                  <button
                    key={cents}
                    type="button"
                    disabled={status === "searching"}
                    onClick={() => setSelectedStake(cents)}
                    className={`min-h-[44px] flex-1 rounded-lg px-3 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:px-4 sm:py-3 ${
                      selectedStake === cents ? "ring-2 ring-white ring-offset-2 ring-offset-stone-800" : ""
                    }`}
                    style={{ backgroundColor: BUTTON_BLUE }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-stone-500 sm:mt-2">Higher Stakes will be available soon</p>
            </div>
          </div>
        </div>
      {status === "searching" &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
            aria-labelledby="searching-title"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full max-w-sm animate-modal-in rounded-2xl bg-stone-800 p-6 text-center shadow-2xl ring-1 ring-stone-600/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex justify-center">
                <div className="h-12 w-12 rounded-full border-2 border-stone-500 border-t-[#1e40af] animate-spin" />
              </div>
              <h2 id="searching-title" className="text-lg font-semibold text-white">
                Searching for opponent…
              </h2>
              <p className="mt-2 text-sm text-stone-400">
                We&apos;re matching you with a player at your stake. You can cancel anytime.
              </p>
              {noPlayersHint && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left">
                  <p className="text-sm font-semibold text-amber-300">
                    No players available at the moment.
                  </p>
                  <p className="mt-1 text-xs text-stone-300">
                    We&apos;ll keep searching. You can also invite a friend or try another stake.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={inviteFriend}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-600"
                    >
                      Invite a friend
                    </button>
                    <button
                      type="button"
                      onClick={cancelSearch}
                      className="rounded-lg border border-stone-500 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-stone-700"
                    >
                      Try another stake
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={cancelSearch}
                className="mt-6 w-full rounded-lg py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
      {status === "error" && error && (
        <p className="mt-6 text-center text-sm text-red-400">{error}</p>
      )}
      {status === "idle" && (
        <>
          {selectedStake != null && balanceCents < selectedStake && (
            <p className="mt-4 text-center text-sm text-amber-400">
              Your balance (${(balanceCents / 100).toFixed(2)}) is not sufficient for this stake.
            </p>
          )}
          <button
          type="button"
          className="mt-6 min-h-[48px] w-full rounded-lg py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:mt-8"
          style={{ backgroundColor: BUTTON_BLUE }}
          onClick={() => selectedStake != null && joinQueue(selectedStake)}
          disabled={selectedStake == null || !canAffordStake}
        >
          Search Opponent
          </button>
        </>
      )}
      </div>
    </div>
  );
}
