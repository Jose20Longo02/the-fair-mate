"use client";

import { useState } from "react";
import MiniChessBoard from "./MiniChessBoard";

const BUTTON_BLUE = "#1e40af";
const STAKES = [
  { label: "$1", cents: 100 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
];

export default function HomeChallengeCard({ userId }: { userId: string }) {
  const [opponent, setOpponent] = useState("");
  const [stakeCents, setStakeCents] = useState(500);
  const [customStakeInput, setCustomStakeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (stakeCents < 100) {
      setError("Choose a stake between $1 and $1000");
      return;
    }
    setLoading(true);
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
          setError(data.error);
          return;
        }
        setOpponent("");
        setStakeCents(500);
        setCustomStakeInput("");
        window.dispatchEvent(new Event("challenge-updated"));
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-600/90 bg-stone-800/90 text-white shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/25 hover:border-stone-500/80">
      <div
        className="py-3.5 text-center text-base font-semibold text-white shadow-inner sm:text-lg"
        style={{
          background: "linear-gradient(180deg, #047857 0%, #064e3b 100%)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset",
        }}
      >
        Challenge a friend
      </div>
      <div className="p-5 sm:p-6 md:p-8" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.4) 0%, rgba(28,25,23,0.6) 100%)" }}>
        <p className="text-sm text-stone-300 leading-snug">
          Challenge a specific player, set your own stake, and play on your terms.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
          {/* Mobile: stack board → stakes → custom stake. Desktop: board | (stakes above, custom below) */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6 md:gap-6">
            <div className="flex justify-center shrink-0 sm:block">
              <MiniChessBoard />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4 text-center sm:py-0.5">
              <div className="w-full min-w-0">
                <p className="text-sm font-medium text-stone-300 sm:text-base">Select Stake</p>
                <div className="mt-2 flex gap-2 sm:mt-1.5 sm:gap-2">
                  {STAKES.map(({ label, cents }) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => {
                        setStakeCents(cents);
                        setCustomStakeInput("");
                      }}
                      className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                        stakeCents === cents ? "ring-2 ring-white ring-offset-2 ring-offset-stone-800" : ""
                      }`}
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full min-w-0">
                <input
                  id="challenge-custom-stake"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  placeholder="Custom stake"
                  value={customStakeInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomStakeInput(v);
                    const n = parseFloat(v);
                    if (v === "") setStakeCents(0);
                    else if (!Number.isNaN(n) && n >= 1 && n <= 50) setStakeCents(Math.round(n * 100));
                  }}
                  className="min-h-[44px] w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2 text-sm text-white placeholder-stone-500"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="min-w-0 flex-1">
              <label htmlFor="opponent" className="block text-sm font-medium text-stone-300">
                Email or nickname
              </label>
              <input
                id="opponent"
                type="text"
                placeholder="user@email.com or Nickname"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="mt-2 min-h-[44px] w-full rounded-lg border border-stone-600 bg-stone-700/80 px-3 py-2.5 text-sm text-white placeholder-stone-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !opponent.trim() || stakeCents < 100}
              className="min-h-[48px] shrink-0 rounded-lg py-3.5 px-6 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:px-8"
              style={{ backgroundColor: BUTTON_BLUE }}
            >
              Challenge
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
