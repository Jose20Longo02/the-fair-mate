"use client";

import { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Scholar's mate: e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7# */
const DEMO_MOVES = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7"];
const MOVE_INTERVAL_MS = 1200;
const CHECKMATE_PAUSE_MS = 2800;

/** Dark squares: medium blue (not as dark as navy) so black pieces contrast better */
const SQUARE_DARK = "#1e40af";

export default function LoopingChessDemo() {
  const [fen, setFen] = useState(START_FEN);
  const [showCheckmate, setShowCheckmate] = useState(false);
  const [showMoney, setShowMoney] = useState(false);
  const chessRef = useRef(new Chess(START_FEN));
  const stepRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const step = stepRef.current;
      if (step >= DEMO_MOVES.length) {
        setShowCheckmate(true);
        setShowMoney(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        timeoutRef.current = setTimeout(() => {
          setShowCheckmate(false);
          setShowMoney(false);
          chessRef.current = new Chess(START_FEN);
          stepRef.current = 0;
          setFen(START_FEN);
          intervalRef.current = setInterval(tick, MOVE_INTERVAL_MS);
        }, CHECKMATE_PAUSE_MS);
        return;
      }

      const chess = chessRef.current;
      const move = chess.move(DEMO_MOVES[step]);
      if (move) {
        stepRef.current = step + 1;
        setFen(chess.fen());
      }
    }

    intervalRef.current = setInterval(tick, MOVE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className="relative aspect-square w-full max-w-[min(88vw,340px)] overflow-hidden rounded-2xl shadow-xl sm:max-w-[400px] md:max-w-[480px] lg:max-w-[520px]"
      aria-hidden
    >
      <div className="h-full w-full [&_.react-chessboard]:!rounded-2xl">
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            boardOrientation: "white",
            showNotation: false,
            boardStyle: { borderRadius: "1rem" },
            darkSquareStyle: { backgroundColor: SQUARE_DARK },
            lightSquareStyle: { backgroundColor: "#fff" },
            animationDurationInMs: 400,
            showAnimations: true,
            squareStyles: showCheckmate
              ? { e8: { backgroundColor: "rgba(229, 57, 53, 0.9)" } }
              : undefined,
          }}
        />
      </div>

      {/* +$10 floating animation */}
      {showMoney && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <span
            className="animate-loop-money text-3xl font-black text-emerald-400 sm:text-4xl"
            style={{
              textShadow: "0 0 20px rgba(52, 211, 153, 0.8), 0 0 40px rgba(52, 211, 153, 0.4)",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
            }}
          >
            +$10
          </span>
        </div>
      )}
    </div>
  );
}
