"use client";

import { useState } from "react";
import MiniChessBoard from "./MiniChessBoard";

const BUTTON_BLUE = "#1e40af";
const DIFFICULTIES = ["Easy", "Normal", "Hard"] as const;

export default function HomePracticeCard() {
  const [difficulty, setDifficulty] = useState<"Easy" | "Normal" | "Hard">("Normal");

  return (
    <div className="overflow-hidden rounded-xl bg-stone-800/80 text-white shadow-xl">
      <div
        className="py-3 text-center text-lg font-semibold text-white"
        style={{ backgroundColor: BUTTON_BLUE }}
      >
        Practice with bots
      </div>
      <div className="p-6">
      <p className="text-sm text-stone-300">
        Play against bots to practice, test openings, or warm up.
      </p>
      <div className="mt-4 flex items-start gap-4">
        <MiniChessBoard />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-300">Difficulty</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                  difficulty === d ? "ring-2 ring-white ring-offset-2 ring-offset-stone-800" : ""
                }`}
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mt-6 w-full rounded-lg py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: BUTTON_BLUE }}
        disabled
        title="Coming soon"
      >
        Start Match
      </button>
      </div>
    </div>
  );
}
