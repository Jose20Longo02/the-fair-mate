"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Challenge = {
  id: string;
  challengerId: string;
  challengedId: string;
  initialStakeCents: number;
  currentStakeCents: number;
  lastProposedBy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  challenger: { id: string; email: string; name: string | null; elo: number };
  challenged: { id: string; email: string; name: string | null; elo: number };
};

const STAKES = [
  { label: "$1", cents: 100 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
];

export default function ChallengePanel({ userId }: { userId: string }) {
  const router = useRouter();
  const [opponent, setOpponent] = useState("");
  const [stakeCents, setStakeCents] = useState(500);
  const [customStakeInput, setCustomStakeInput] = useState("5");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [proposeStake, setProposeStake] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadChallenges = useCallback(() => {
    setLoadingChallenges(true);
    fetch("/api/challenges", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setChallenges(data.challenges ?? []);
      })
      .finally(() => setLoadingChallenges(false));
  }, []);

  useEffect(() => {
    const onChallengeUpdated = () => loadChallenges();
    window.addEventListener("challenge-updated", onChallengeUpdated);
    return () => window.removeEventListener("challenge-updated", onChallengeUpdated);
  }, [loadChallenges]);

  useEffect(() => {
    loadChallenges();
    const t = setInterval(loadChallenges, 5000);
    return () => clearInterval(t);
  }, [loadChallenges]);

  useEffect(() => {
    const onFocus = () => loadChallenges();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadChallenges();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadChallenges]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (stakeCents < 100) {
      setCreateError("Choose a stake between $1 and $1000");
      return;
    }
    setCreateLoading(true);
    fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opponentEmailOrName: opponent.trim(),
        stakeCents,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setCreateError(data.error);
          return;
        }
        setOpponent("");
        setStakeCents(500);
        setCustomStakeInput("5");
        loadChallenges();
      })
      .finally(() => setCreateLoading(false));
  }

  function handleRespond(challengeId: string, action: "accept" | "propose", stakeCentsArg?: number) {
    setRespondingId(challengeId);
    const body: { action: "accept" | "propose"; stakeCents?: number } = { action };
    if (action === "propose" && stakeCentsArg != null) body.stakeCents = stakeCentsArg;

    fetch(`/api/challenges/${challengeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          return;
        }
        if (data.game) {
          router.push(`/partida/${data.game.id}`);
          return;
        }
        setProposeStake((prev) => ({ ...prev, [challengeId]: "" }));
        loadChallenges();
      })
      .finally(() => setRespondingId(null));
  }

  function handleReject(challengeId: string) {
    if (!confirm("Reject this challenge?")) return;
    setRespondingId(challengeId);
    fetch(`/api/challenges/${challengeId}/reject`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) loadChallenges();
      })
      .finally(() => setRespondingId(null));
  }

  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const formatDate = (s: string) => new Date(s).toLocaleString();

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Challenge someone</h2>
        <p className="mt-1 text-sm text-stone-600">
          Enter opponent email or nickname and proposed stake. They can accept, propose a different stake, or reject.
        </p>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label htmlFor="opponent" className="block text-sm font-medium text-stone-700">
              Opponent email or nickname
            </label>
            <input
              id="opponent"
              type="text"
              placeholder="example@email.com or Nickname"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Proposed stake</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAKES.map(({ label, cents }) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => {
                    setStakeCents(cents);
                    setCustomStakeInput(String(cents / 100));
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    stakeCents === cents
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-stone-300 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {label}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                placeholder="e.g. 50"
                value={customStakeInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomStakeInput(v);
                  const n = parseFloat(v);
                  if (v === "") {
                    setStakeCents(0);
                  } else if (!Number.isNaN(n) && n >= 1 && n <= 1000) {
                    setStakeCents(Math.round(n * 100));
                  }
                }}
                className="w-20 rounded border border-stone-300 px-2 py-2 text-sm"
              />
              <span className="py-2 text-sm text-stone-500">USD</span>
            </div>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button
            type="submit"
            disabled={createLoading}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {createLoading ? "Sending…" : "Send challenge"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">My challenges</h2>
        <p className="mt-1 text-sm text-stone-600">
          Pending challenges. Accept current stake, propose another (lower = game starts; higher = opponent must accept), or reject.
        </p>
        {loadingChallenges ? (
          <p className="mt-4 text-sm text-stone-500">Loading…</p>
        ) : challenges.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No pending challenges.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {challenges.map((c) => {
              const isChallenger = c.challengerId === userId;
              const other = isChallenger ? c.challenged : c.challenger;
              const otherName = other.name || other.email;
              const isMyTurn =
                (c.status === "pending_accept" && !isChallenger) ||
                (c.status === "pending_challenger" && isChallenger) ||
                (c.status === "pending_challenged" && !isChallenger);
              const canCancelAsChallenger = c.status === "pending_accept" && isChallenger;
              const busy = respondingId === c.id;

              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-stone-900">
                        {isChallenger ? "Challenge to " : "Challenge from "}{otherName}
                      </span>
                      <span className="ml-2 text-sm text-stone-500">
                        Current stake: {formatCents(c.currentStakeCents)}
                      </span>
                    </div>
                    <span className="text-xs text-stone-500">
                      {isMyTurn ? "Your turn" : "Waiting for opponent"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(c.updatedAt)}</p>
                  {isMyTurn && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespond(c.id, "accept")}
                        disabled={busy}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Accept {formatCents(c.currentStakeCents)}
                      </button>
                      <span className="text-stone-400">o</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="0.5"
                        placeholder="Stake $"
                        value={proposeStake[c.id] ?? ""}
                        onChange={(e) => setProposeStake((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-20 rounded border border-stone-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = parseFloat(proposeStake[c.id] ?? "0");
                          if (v >= 1 && v <= 1000) handleRespond(c.id, "propose", Math.round(v * 100));
                          else alert("Enter a stake between $1 and $1000");
                        }}
                        disabled={busy}
                        className="rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Propose stake
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(c.id)}
                        disabled={busy}
                        className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {canCancelAsChallenger && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleReject(c.id)}
                        disabled={busy}
                        className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                      >
                        Cancel challenge
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
