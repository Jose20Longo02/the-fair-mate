"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import Link from "next/link";
import ShareGameImageCard from "@/components/ShareGameImageCard";
import { getShareBgGrayscaleDataUrl } from "@/lib/share-bg-grayscale";

const PAGE_BG = "#252525";

const SAMPLE_FEN_WIN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
const SAMPLE_FEN_LOSS = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const SAMPLE_FEN_DRAW = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

const SAMPLES: { result: "win" | "loss" | "draw"; resultLabel: string; statusLabel: string; fen: string; profitCents: number }[] = [
  {
    result: "win",
    resultLabel: "Victory",
    statusLabel: "You won this game.",
    fen: SAMPLE_FEN_WIN,
    profitCents: 475,
  },
  {
    result: "loss",
    resultLabel: "Out of time",
    statusLabel: "Your clock ran out.",
    fen: SAMPLE_FEN_LOSS,
    profitCents: -500,
  },
  {
    result: "draw",
    resultLabel: "Draw",
    statusLabel: "Stakes are refunded.",
    fen: SAMPLE_FEN_DRAW,
    profitCents: 0,
  },
];

export default function SharePreviewPage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  const sample = SAMPLES[sampleIndex];
  const stakeCents = 500; // $5
  const eloDelta = sample.result === "win" ? 12 : sample.result === "loss" ? -8 : 0;

  async function handleDownload() {
    if (!cardRef.current || loading) return;
    setLoading(true);
    try {
      const grayscaleDataUrl = await getShareBgGrayscaleDataUrl();
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        onclone(_, clonedNode) {
          const img = clonedNode.querySelector<HTMLImageElement>('img[src*="share-bg-fluid"]');
          if (img) {
            img.src = grayscaleDataUrl;
            img.style.filter = "none";
          }
          // Paneles: en descarga con transparencia (sin blur) para que se vea el fondo
          clonedNode.querySelectorAll("[data-share-glass]").forEach((el) => {
            const div = el as HTMLElement;
            div.style.backgroundColor = "rgba(28,25,23,0.75)";
            div.style.backdropFilter = "none";
            div.style.webkitBackdropFilter = "none";
            div.style.boxShadow = "none";
            div.style.border = "1px solid rgba(255,255,255,0.1)";
          });
        },
      });
      const link = document.createElement("a");
      link.download = `fairmate-${sample.result}-preview.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen w-full px-4 py-8 pb-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-stone-400 transition hover:text-white"
        >
          ← Back to home
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white">
          Share image preview
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          Preview and download the game result card (for design testing). No game required.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <span>Result:</span>
            <select
              value={sampleIndex}
              onChange={(e) => setSampleIndex(Number(e.target.value))}
              className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-white focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            >
              {SAMPLES.map((s, i) => (
                <option key={i} value={i}>
                  {s.resultLabel}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Preparing…" : "Download image"}
          </button>
        </div>

        <div className="mt-8 flex justify-center rounded-xl border border-stone-600 bg-stone-800/50 p-6">
          <div ref={cardRef}>
            <ShareGameImageCard
              result={sample.result}
              resultLabel={sample.resultLabel}
              statusLabel={sample.statusLabel}
              fen={sample.fen}
              stakeCents={stakeCents}
              profitCents={sample.profitCents}
              eloDelta={eloDelta}
              whiteName="You"
              blackName="Opponent"
              whiteElo={1200}
              blackElo={1185}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
