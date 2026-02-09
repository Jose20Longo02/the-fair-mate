"use client";

import { useState } from "react";

type OpenInLichessProps = {
  pgn: string;
  fen: string;
};

/** Lichess editor URL with FEN: opens the position in the board editor. */
function editorUrl(fen: string): string {
  const encoded = encodeURIComponent(fen);
  return `https://lichess.org/editor?fen=${encoded}`;
}

export default function OpenInLichess({ pgn, fen }: OpenInLichessProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyPgnAndOpen() {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      window.open("https://lichess.org/paste", "_blank", "noopener,noreferrer");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: just open paste and show PGN in a way user can copy
      window.open("https://lichess.org/paste", "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900 mb-2">Open in Lichess</h2>
      <p className="text-sm text-stone-600 mb-4">
        Use Lichess (free) to analyze the position with an engine or import the full game.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={editorUrl(fen)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Open final position in Lichess Editor
        </a>
        <button
          type="button"
          onClick={handleCopyPgnAndOpen}
          className="inline-flex items-center rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
        >
          {copied ? "Copied! Paste (Ctrl+V) on Lichess" : "Copy PGN and open Lichess paste"}
        </button>
      </div>
      <p className="mt-3 text-xs text-stone-500">
        The second button copies the full game PGN and opens lichess.org/paste. Paste there (Ctrl+V) to get a browsable replay and computer analysis.
      </p>
    </div>
  );
}
