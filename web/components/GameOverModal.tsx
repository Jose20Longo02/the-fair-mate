"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import ShareGameImageCard from "@/components/ShareGameImageCard";
import { getShareBgGrayscaleDataUrl } from "@/lib/share-bg-grayscale";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

const BUTTON_BLUE = "#1e40af";

function resultAndStatusLabels(
  result: "win" | "loss" | "draw",
  lossReason?: "timeout" | "checkmate" | "disconnected" | "resigned"
): { resultLabel: string; statusLabel: string } {
  if (result === "win") return { resultLabel: "Victory", statusLabel: "You won this game." };
  if (result === "draw") return { resultLabel: "Draw", statusLabel: "Stakes are refunded." };
  switch (lossReason) {
    case "timeout":
      return { resultLabel: "Out of time", statusLabel: "Your clock ran out." };
    case "disconnected":
      return { resultLabel: "Disconnected", statusLabel: "You didn't reconnect in time." };
    case "resigned":
      return { resultLabel: "You resigned", statusLabel: "Your opponent wins." };
    default:
      return { resultLabel: "Game over", statusLabel: "Good fight." };
  }
}

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
  /** For share image */
  fen?: string;
  profitCents?: number;
  whiteName?: string;
  blackName?: string;
  whiteElo?: number;
  blackElo?: number;
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
  fen,
  profitCents = 0,
  whiteName = "White",
  blackName = "Black",
  whiteElo,
  blackElo,
}: GameOverModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const { resultLabel, statusLabel } = resultAndStatusLabels(result, lossReason);

  async function handleShareImage() {
    if (!shareCardRef.current || shareLoading) return;
    setShareLoading(true);
    try {
      const grayscaleDataUrl = await getShareBgGrayscaleDataUrl();
      const cardCanvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        onclone(_, clonedNode) {
          const img = clonedNode.querySelector<HTMLImageElement>('img[src*="share-bg-fluid"]');
          if (img) {
            img.style.display = "none";
            if (img.parentElement) img.parentElement.style.backgroundColor = "transparent";
          }
          clonedNode.querySelectorAll("[data-share-glass]").forEach((el) => {
            const div = el as HTMLElement;
            div.style.backgroundColor = "rgba(28,25,23,0.75)";
            div.style.backdropFilter = "none";
            div.style.setProperty("-webkit-backdrop-filter", "none");
            div.style.boxShadow = "none";
            div.style.border = "1px solid rgba(255,255,255,0.1)";
          });
        },
      });
      const w = cardCanvas.width;
      const h = cardCanvas.height;
      const bgImg = new Image();
      await new Promise<void>((resolve, reject) => {
        bgImg.onload = () => resolve();
        bgImg.onerror = () => reject(new Error("Grayscale bg load failed"));
        bgImg.src = grayscaleDataUrl;
      });
      const final = document.createElement("canvas");
      final.width = w;
      final.height = h;
      const ctx = final.getContext("2d");
      if (!ctx) throw new Error("Canvas 2d unavailable");
      const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
      const sw = bgImg.naturalWidth;
      const sh = bgImg.naturalHeight;
      const dx = (w - sw * scale) / 2;
      const dy = (h - sh * scale) / 2;
      ctx.drawImage(bgImg, 0, 0, sw, sh, dx, dy, sw * scale, sh * scale);
      ctx.drawImage(cardCanvas, 0, 0);
      const link = document.createElement("a");
      link.download = `fairmate-${result}-${Date.now()}.png`;
      link.href = final.toDataURL("image/png");
      link.click();
    } catch {
      // ignore
    } finally {
      setShareLoading(false);
    }
  }

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
      {/* Off-screen card for html2canvas capture */}
      {fen && (
        <div
          className="fixed left-[-9999px] top-0 z-0"
          aria-hidden
          ref={shareCardRef}
        >
          <ShareGameImageCard
            result={result}
            resultLabel={resultLabel}
            statusLabel={statusLabel}
            fen={fen}
            stakeCents={stake}
            profitCents={profitCents}
            eloDelta={eloDelta}
            whiteName={whiteName}
            blackName={blackName}
            whiteElo={whiteElo}
            blackElo={blackElo}
          />
        </div>
      )}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
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
                {result === "win" && `+${formatStake(Math.floor(stake * 2 * (1 - PLATFORM_FEE_PERCENT)))}`}
                {result === "loss" && `-${formatStake(stake)}`}
                {result === "draw" && formatStake(stake) + " refunded"}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-stone-400">ELO</span>
              <span className="font-medium text-stone-300">{eloText}</span>
            </div>
          </div>

          {/* Share: download image */}
          {fen && (
            <button
              type="button"
              onClick={handleShareImage}
              disabled={shareLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#059669" }}
            >
              {shareLoading ? (
                "Preparing…"
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Share — Download image
                </>
              )}
            </button>
          )}

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
