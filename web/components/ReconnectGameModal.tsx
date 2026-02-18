"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BUTTON_BLUE = "#1e40af";

type ReconnectGame = {
  id: string;
  stake: number;
  opponentName: string;
};

export default function ReconnectGameModal() {
  const router = useRouter();
  const [game, setGame] = useState<ReconnectGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [forfeiting, setForfeiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/my-active-reconnect")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.canReconnect && data?.game) {
          setGame(data.game);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReconnect = () => {
    if (!game) return;
    setDismissed(true);
    router.push(`/game/${game.id}`);
  };

  const handleForfeit = async () => {
    if (!game) return;
    setForfeiting(true);
    try {
      const res = await fetch(`/api/games/${game.id}/forfeit-disconnect`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to forfeit");
        return;
      }
      setDismissed(true);
      setGame(null);
      router.refresh();
    } finally {
      setForfeiting(false);
    }
  };

  if (loading || dismissed || !game) return null;

  const stakeStr = (game.stake / 100).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconnect-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-stone-600 bg-stone-800 p-6 shadow-xl">
        <h2 id="reconnect-title" className="text-lg font-bold text-white">
          You have an existing match
        </h2>
        <p className="mt-2 text-stone-300">
          You disconnected from a game vs <span className="font-medium text-white">{game.opponentName}</span> (stake ${stakeStr}).
          You can still reconnect before the forfeit timer ends.
        </p>
        <p className="mt-3 text-sm font-medium text-amber-200">Do you want to reconnect?</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleReconnect}
            className="flex-1 rounded-lg px-4 py-2.5 text-center font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: BUTTON_BLUE }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={handleForfeit}
            disabled={forfeiting}
            className="flex-1 rounded-lg border border-stone-500 bg-stone-700 px-4 py-2.5 text-center font-medium text-white transition hover:bg-stone-600 disabled:opacity-50"
          >
            {forfeiting ? "…" : "No"}
          </button>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          No = forfeit the game (your opponent wins).
        </p>
      </div>
    </div>
  );
}
