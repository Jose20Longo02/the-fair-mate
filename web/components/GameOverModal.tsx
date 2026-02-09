"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const BUTTON_BLUE = "#1e40af";

export type GameOverModalProps = {
  result: "win" | "loss" | "draw";
  stake: number;
  eloDelta: number;
  onClose: () => void;
  lossReason?: "timeout" | "checkmate" | "disconnected" | "resigned";
  gameId?: string;
  alreadyReported?: boolean;
  opponentName?: string;
  rematchRequestedByMe?: boolean;
  rematchRequestedByOpponent?: boolean;
  rematchDeclined?: boolean;
  rematchError?: string | null;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
};

export default function GameOverModal({
  result,
  stake,
  eloDelta,
  onClose,
  lossReason,
  gameId,
  alreadyReported,
  opponentName = "Opponent",
  rematchRequestedByMe = false,
  rematchRequestedByOpponent = false,
  rematchDeclined = false,
  rematchError = null,
  onRematch,
  onAcceptRematch,
  onDeclineRematch,
}: GameOverModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  useEffect(() => setMounted(true), []);

  const formatStake = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const eloText = eloDelta >= 0 ? `+${eloDelta}` : String(eloDelta);

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!gameId || !reportMessage.trim() || reportMessage.trim().length < 10) {
      setReportError("Please write at least 10 characters explaining your concern.");
      return;
    }
    setReportError("");
    setReportLoading(true);
    try {
      const res = await fetch(`/api/games/${gameId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reportMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error ?? "Failed to send report");
        return;
      }
      setReportSent(true);
      setShowReportForm(false);
      setReportMessage("");
    } catch {
      setReportError("Connection error");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${mounted ? "opacity-100" : "opacity-0"}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-sm animate-modal-in rounded-2xl overflow-hidden bg-stone-800 text-white shadow-2xl ring-1 ring-stone-600/50 transition-all duration-300 ${mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Result header strip — same treatment as "1v1 Mode" on home cards */}
        <div
          className="py-3.5 text-center text-base font-semibold text-white sm:text-lg"
          style={{
            backgroundColor:
              result === "win"
                ? BUTTON_BLUE
                : result === "loss"
                  ? "rgba(127, 29, 29, 0.6)"
                  : "rgba(69, 69, 69, 0.8)",
          }}
        >
          {result === "win" && "Victory"}
          {result === "loss" &&
            (lossReason === "timeout"
              ? "Out of time"
              : lossReason === "disconnected"
                ? "Disconnected"
                : lossReason === "resigned"
                  ? "You resigned"
                  : "Game over")}
          {result === "draw" && "Draw"}
        </div>

        <div className="p-6 sm:p-8">
          {/* Short message */}
          <p className="text-center text-sm text-stone-400">
            {result === "win" && "You won this game."}
            {result === "loss" &&
              (lossReason === "timeout"
                ? "Your clock ran out."
                : lossReason === "disconnected"
                  ? "You didn’t reconnect in time."
                  : lossReason === "resigned"
                    ? "Your opponent wins."
                    : "Good fight.")}
            {result === "draw" && "Stakes are refunded."}
          </p>

          {/* Stats block — same style as inner cards on home (rounded-lg border border-stone-600 bg-stone-700/50) */}
          <div className="mt-6 rounded-lg border border-stone-600 bg-stone-700/50 px-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Result</span>
              <span
                className={
                  result === "win"
                    ? "font-semibold text-emerald-400"
                    : result === "loss"
                      ? "font-semibold text-red-400"
                      : "font-medium text-stone-300"
                }
              >
                {result === "win" && `+${formatStake(Math.floor(stake * 2 * 0.95))}`}
                {result === "loss" && `-${formatStake(stake)}`}
                {result === "draw" && formatStake(stake) + " refunded"}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-stone-400">ELO</span>
              <span className="font-medium text-stone-300">{eloText}</span>
            </div>
          </div>

          {/* Rematch */}
          {onRematch && (
            <div className="mt-6">
              {rematchRequestedByMe && (
                <p className="text-center text-sm text-stone-400">
                  Waiting for {opponentName} to accept…
                </p>
              )}
              {rematchRequestedByOpponent && (
                <div className="space-y-3">
                  <p className="text-center text-sm text-stone-300">
                    {opponentName} wants a rematch
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onAcceptRematch}
                      className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={onDeclineRematch}
                      className="flex-1 rounded-lg border border-stone-600 bg-stone-700 py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-600"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
              {rematchDeclined && (
                <p className="text-center text-sm text-stone-500">{opponentName} declined rematch</p>
              )}
              {rematchError && (
                <p className="text-center text-sm text-red-400">{rematchError}</p>
              )}
              {!rematchRequestedByMe && !rematchRequestedByOpponent && !rematchDeclined && (
                <button
                  type="button"
                  onClick={onRematch}
                  className="w-full rounded-lg py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BUTTON_BLUE }}
                >
                  Rematch
                </button>
              )}
            </div>
          )}

          {/* Report */}
          {gameId && (
            <div className="mt-6 border-t border-stone-600 pt-6">
              {reportSent ? (
                <div className="text-center text-sm text-stone-400">
                  <p>Report sent.</p>
                  <Link href="/cuenta/reportes" className="font-medium text-stone-300 underline hover:no-underline">
                    Track your reports
                  </Link>
                </div>
              ) : alreadyReported ? (
                <div className="text-center text-sm text-stone-500">
                  <p>You already reported this game.</p>
                  <Link href="/cuenta/reportes" className="font-medium text-stone-400 underline hover:no-underline">
                    View your report
                  </Link>
                </div>
              ) : showReportForm ? (
                <form onSubmit={handleSubmitReport} className="space-y-3">
                  <label htmlFor="report-message" className="block text-sm font-medium text-stone-300">
                    Explain why you want a review
                  </label>
                  <textarea
                    id="report-message"
                    rows={3}
                    maxLength={2000}
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder="e.g. I believe the result was incorrect because..."
                    className="w-full rounded-lg border border-stone-600 bg-stone-700 px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  />
                  <p className="text-xs text-stone-500">{reportMessage.length} / 2000</p>
                  {reportError && <p className="text-sm text-red-400">{reportError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowReportForm(false); setReportError(""); setReportMessage(""); }}
                      className="flex-1 rounded-lg border border-stone-600 bg-stone-700 py-2 text-sm font-medium text-stone-300 hover:bg-stone-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reportLoading || reportMessage.trim().length < 10}
                      className="flex-1 rounded-lg py-2 text-sm font-medium text-white opacity-90 hover:opacity-100 disabled:opacity-50"
                      style={{ backgroundColor: BUTTON_BLUE }}
                    >
                      {reportLoading ? "Sending…" : "Send report"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReportForm(true)}
                  className="w-full rounded-lg border border-amber-500/60 bg-amber-500/20 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/30 hover:text-amber-100"
                >
                  Request review or report result
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-lg border border-stone-600 bg-stone-700 py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-600 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
