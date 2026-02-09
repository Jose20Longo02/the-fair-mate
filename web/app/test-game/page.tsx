"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TestGame() {
  const router = useRouter();
  const [opponentId, setOpponentId] = useState("");
  const [stake, setStake] = useState(100);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, stake }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error creating game");
        return;
      }
      router.push(`/partida/${data.game.id}`);
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">
        Create game (test)
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Temporary page for testing. Phase 5 has automatic matchmaking.
      </p>

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="opponentId" className="block text-sm font-medium text-stone-700">
            Opponent ID
          </label>
          <input
            id="opponentId"
            type="text"
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900"
            placeholder="Paste another user's ID"
          />
          <p className="mt-1 text-xs text-stone-500">
            You can see your ID on /cuenta. Create two accounts and use the other one&apos;s ID.
          </p>
        </div>
        <div>
          <label htmlFor="stake" className="block text-sm font-medium text-stone-700">
            Stake (cents)
          </label>
          <input
            id="stake"
            type="number"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900"
          />
          <p className="mt-1 text-xs text-stone-500">
            100 = $1, 500 = $5, 1000 = $10
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !opponentId}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create game"}
        </button>
      </div>

      <p className="mt-6 text-center">
        <Link href="/cuenta" className="text-stone-500 hover:underline">
          ← Back to My account
        </Link>
      </p>
    </main>
  );
}
