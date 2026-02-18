"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

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

export default function HomeChallengesSection({ userId }: { userId: string }) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposeStake, setProposeStake] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadChallenges = useCallback(() => {
    setLoading(true);
    fetch("/api/challenges", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setChallenges(data.challenges ?? []);
      })
      .finally(() => setLoading(false));
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
  const winnerGetsCents = (stakeCents: number) =>
    Math.floor(stakeCents * 2 * (1 - PLATFORM_FEE_PERCENT));

  if (loading) {
    return (
      <section className="rounded-xl border border-stone-600/90 bg-stone-800/90 p-5 text-white shadow-xl shadow-black/20 transition-all duration-300 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.5) 0%, rgba(28,25,23,0.7) 100%)" }}>
        <h2 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl md:font-thin">My Challenges</h2>
        <p className="mt-3 text-sm text-stone-400 sm:mt-4">Loading…</p>
      </section>
    );
  }

  if (challenges.length === 0) {
    return (
      <section className="rounded-xl border border-stone-600/90 bg-stone-800/90 p-5 text-white shadow-xl shadow-black/20 transition-all duration-300 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.5) 0%, rgba(28,25,23,0.7) 100%)" }}>
        <h2 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl md:font-thin">My Challenges</h2>
        <p className="mt-3 text-sm text-stone-400 sm:mt-4">No pending challenges.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-600/90 bg-stone-800/90 p-5 text-white shadow-xl shadow-black/20 transition-all duration-300 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.5) 0%, rgba(28,25,23,0.7) 100%)" }}>
      <h2 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl md:font-thin">My Challenges</h2>
      <ul className="mt-4 space-y-4 sm:mt-5">
        {challenges.map((c) => {
          const isChallenger = c.challengerId === userId;
          const other = isChallenger ? c.challenged : c.challenger;
          const otherName = other.name || other.email;
          const otherElo = other.elo;
          const isMyTurn =
            (c.status === "pending_accept" && !isChallenger) ||
            (c.status === "pending_challenger" && isChallenger) ||
            (c.status === "pending_challenged" && !isChallenger);
          const isProposer =
            (c.lastProposedBy === "challenger" && isChallenger) ||
            (c.lastProposedBy === "challenged" && !isChallenger);
          const canCancel = isProposer;
          const hasNewStakeProposed = isMyTurn && c.status !== "pending_accept";
          const busy = respondingId === c.id;

          return (
            <li key={c.id} className="rounded-lg border border-stone-600/80 bg-stone-700/50 px-4 py-4 transition-colors hover:bg-stone-700/70 sm:px-6 sm:py-4 md:px-8">
              {/* Mobile: stack. Desktop: 3 columns */}
              <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:items-start">
                <div className="min-w-0">
                  <p className="text-lg font-medium text-white sm:text-base">
                    Challenge {isChallenger ? "TO" : "FROM"} {otherName} <span className="text-stone-400">({otherElo})</span>
                  </p>
                  <p className="mt-1 text-sm text-stone-400">{formatDate(c.updatedAt)}</p>
                </div>
                <div className="sm:text-center">
                  <p className="text-base font-medium text-stone-300 sm:text-base">Stake: {formatCents(c.currentStakeCents)}</p>
                  <p className="mt-0.5 text-sm text-stone-400 sm:text-sm">
                    Winner gets {formatCents(winnerGetsCents(c.currentStakeCents))} ({PLATFORM_FEE_PERCENT * 100}% fee)
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  {hasNewStakeProposed && (
                    <span className="inline-block w-fit rounded-lg bg-amber-600/80 px-3 py-1.5 text-xs font-medium text-amber-100 sm:text-sm">
                      New stake proposed
                    </span>
                  )}
                  <span className="inline-block w-fit rounded-lg bg-stone-600 px-3 py-2 text-sm font-medium text-stone-300 sm:px-4 sm:py-2.5 sm:text-base">
                    {isMyTurn ? "Waiting for you" : "Waiting opponent"}
                  </span>
                </div>
              </div>
              {canCancel && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleReject(c.id)}
                    disabled={busy}
                    className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Cancel Challenge
                  </button>
                </div>
              )}
              {isMyTurn && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => handleRespond(c.id, "accept")}
                    disabled={busy}
                    className="min-h-[44px] shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Accept {formatCents(c.currentStakeCents)}
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <span className="hidden text-stone-500 sm:inline">Or</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="0.5"
                      placeholder="e.g. $25"
                      value={proposeStake[c.id] ?? ""}
                      onChange={(e) => setProposeStake((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2 text-sm text-white placeholder-stone-500 sm:max-w-[8rem]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = parseFloat(proposeStake[c.id] ?? "0");
                        if (v >= 1 && v <= 1000) handleRespond(c.id, "propose", Math.round(v * 100));
                        else alert("Enter a stake between $1 and $1000");
                      }}
                      disabled={busy}
                      className="min-h-[44px] shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white sm:px-4"
                      style={{ backgroundColor: "#1e40af" }}
                    >
                      Propose Stake
                    </button>
                  </div>
                  <span className="hidden text-stone-500 sm:inline">Or</span>
                  <button
                    type="button"
                    onClick={() => handleReject(c.id)}
                    disabled={busy}
                    className="min-h-[44px] shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject Game
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
