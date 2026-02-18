"use client";

/**
 * Card layout for the share image: result, board (FEN), stake, profit, logo.
 * Uses the same react-chessboard component as in-game for identical piece design.
 */

import { Chessboard } from "react-chessboard";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BG_DARK = "#1c1917";
const BG_CARD = "#292524";
const BORDER = "#57534e";
const BLUE_HEADER = "#1e40af";
const RED_HEADER = "rgba(127, 29, 29, 0.85)";
const GRAY_HEADER = "rgba(69, 69, 69, 0.9)";
const TEXT_WHITE = "#fafaf9";
const TEXT_MUTED = "#a8a29e";
const SQUARE_DARK = "#1e40af";

export type ShareGameImageCardProps = {
  result: "win" | "loss" | "draw";
  resultLabel: string;
  statusLabel: string;
  fen: string;
  stakeCents: number;
  profitCents: number;
  eloDelta?: number;
  whiteName: string;
  blackName: string;
  whiteElo?: number;
  blackElo?: number;
};

function formatCents(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function ShareGameImageCard({
  result,
  resultLabel,
  statusLabel,
  fen,
  stakeCents,
  profitCents,
  eloDelta,
  whiteName,
  blackName,
  whiteElo,
  blackElo,
}: ShareGameImageCardProps) {
  const headerBg =
    result === "win" ? BLUE_HEADER : result === "loss" ? RED_HEADER : GRAY_HEADER;
  const profitText =
    result === "win"
      ? `+${formatCents(profitCents)}`
      : result === "loss"
        ? `-${formatCents(profitCents)}`
        : "Refunded";

  const resultColor =
    result === "win" ? "#22c55e" : result === "loss" ? "#fca5a5" : TEXT_WHITE;
  const eloPositiveColor = "#22c55e";

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        width: 520,
        fontFamily: "system-ui, -apple-system, sans-serif",
        border: `1px solid rgba(87,83,78,0.5)`,
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.35)",
        backgroundColor: "#0c0a09",
      }}
    >
      {/* Fondo en grises — <img> para que html2canvas capture el filtro al descargar; contain para fit */}
      <img
        src="/images/share-bg-fluid.png"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          filter: "grayscale(1) brightness(0.82) contrast(1.1)",
        }}
      />
      {/* Overlay suave para legibilidad (sin tapar los grises) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(12,10,9,0.25) 0%, rgba(12,10,9,0.4) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col">
      {/* Header — padding igual arriba/abajo para centrado en descarga */}
      <div style={{ backgroundColor: headerBg, padding: "18px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: "0.04em" }}>
          {resultLabel}
        </span>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 6, letterSpacing: "0.06em" }}>
          {statusLabel}
        </div>
      </div>

      {/* Content — espacio optimizado, gaps moderados */}
      <div
        className="flex flex-col items-center shrink-0 px-5"
        style={{ gap: 18, paddingTop: 22, paddingBottom: 22 }}
      >
        {/* Players — padding igual arriba/abajo para centrado en descarga */}
        <div
          data-share-glass
          className="w-full rounded-lg text-center"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "14px 16px",
          }}
        >
          <span style={{ fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.16em" }}>
            Players
          </span>
          <div style={{ marginTop: 4, fontSize: 14, color: TEXT_WHITE, fontWeight: 500 }}>
            <span>{whiteName}{whiteElo != null ? ` (${whiteElo})` : ""}</span>
            <span style={{ color: TEXT_MUTED, fontWeight: 300 }}> - </span>
            <span>{blackName}{blackElo != null ? ` (${blackElo})` : ""}</span>
          </div>
        </div>

        {/* Board */}
        <div
          className="rounded-lg overflow-hidden shrink-0 [&_.react-chessboard]:!rounded-lg [&_.react-chessboard]:!h-full [&_.react-chessboard]:!w-full [&_.react-chessboard]:!min-h-0 [&_.react-chessboard]:!min-w-0"
          style={{ width: 376, height: 376, border: `1px solid rgba(87,83,78,0.5)` }}
        >
          <Chessboard
            options={{
              position: fen || DEFAULT_FEN,
              allowDragging: false,
              boardOrientation: "white",
              showNotation: false,
              showAnimations: false,
              boardStyle: { borderRadius: "0.5rem" },
              darkSquareStyle: { backgroundColor: SQUARE_DARK },
              lightSquareStyle: { backgroundColor: "#fff" },
            }}
          />
        </div>

        {/* Stake + Result + ELO — padding igual arriba/abajo para centrado en descarga */}
        <div
          data-share-glass
          className="w-full rounded-lg"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 2px 0" }}>
                Stake
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_WHITE, fontVariantNumeric: "tabular-nums", margin: 0 }}>
                {formatCents(stakeCents)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 2px 0" }}>
                Result
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.03em", fontVariantNumeric: "tabular-nums", color: resultColor, lineHeight: 1.2, margin: 0 }}>
                {profitText}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              {eloDelta != null ? (
                <>
                  <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 2px 0" }}>
                    ELO
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: eloDelta >= 0 ? eloPositiveColor : "#fca5a5", fontVariantNumeric: "tabular-nums", margin: 0 }}>
                    {eloDelta >= 0 ? "+" : ""}{eloDelta}
                  </p>
                </>
              ) : (
                <span style={{ display: "inline-block", width: 72 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — logo y texto juntos, centrados */}
      <div style={{ borderTop: "1px solid rgba(87,83,78,0.5)", backgroundColor: BG_DARK, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <img
          src="/images/FairMate Logo.jpg"
          alt="FairMate"
          width={22}
          height={22}
          className="rounded object-cover"
          style={{ width: 22, height: 22, borderRadius: 5 }}
        />
        <span style={{ fontSize: 13, color: "rgba(250,250,249,0.88)", letterSpacing: "0.06em" }}>
          thefairmate.com
        </span>
      </div>
      </div>
    </div>
  );
}
