"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type GameReplayerProps = {
  moves: string[];
  initialFen?: string;
};

/** Returns FEN after applying moves[0..step-1]. Step 0 = initial position. */
function getFenAtStep(initialFen: string, moves: string[], step: number): string {
  if (step <= 0) return initialFen;
  const chess = new Chess(initialFen);
  for (let i = 0; i < step && i < moves.length; i++) {
    const result = chess.move(moves[i]);
    if (!result) return chess.fen(); // invalid move, return current
  }
  return chess.fen();
}

export default function GameReplayer({ moves, initialFen = START_FEN }: GameReplayerProps) {
  const [step, setStep] = useState(0);
  const maxStep = moves.length;

  const currentFen = useMemo(
    () => getFenAtStep(initialFen, moves, step),
    [initialFen, moves, step]
  );

  if (moves.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-stone-500">
        No moves to replay. Showing start position.
        <div className="mx-auto mt-4 max-w-[400px]">
          <Chessboard
            options={{
              position: initialFen,
              allowDragging: false,
              boardOrientation: "white",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-700">
          {step === 0
            ? "Start position"
            : `After move ${step} (${moves[step - 1]})`}
        </span>
        <span className="text-xs text-stone-500">
          {step} / {maxStep}
        </span>
      </div>

      <div className="mx-auto max-w-[500px]">
        <Chessboard
          key={currentFen}
          options={{
            position: currentFen,
            allowDragging: false,
            boardOrientation: "white",
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setStep(0)}
          disabled={step === 0}
          className="rounded bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50 disabled:pointer-events-none"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50 disabled:pointer-events-none"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
          disabled={step === maxStep}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => setStep(maxStep)}
          disabled={step === maxStep}
          className="rounded bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50 disabled:pointer-events-none"
        >
          Last
        </button>
      </div>
    </div>
  );
}
