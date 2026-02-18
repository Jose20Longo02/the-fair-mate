import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildPgn } from "@/lib/pgn";
import GameReplayer from "@/components/GameReplayer";
import OpenInLichess from "@/components/OpenInLichess";

const END_REASON: Record<string, string> = {
  active: "In progress",
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  draw: "Draw",
  resigned: "Resigned",
  timeout: "Timeout (out of time)",
  disconnected: "Disconnected (forfeit)",
};

export default async function AdminReviewGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ok = await hasAdminSession();
  if (!ok) redirect("/admin/login?from=/admin/games");

  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      white: { select: { id: true, email: true, name: true, elo: true } },
      black: { select: { id: true, email: true, name: true, elo: true } },
      reports: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (!game) notFound();

  const moves: string[] = game.moves ? JSON.parse(game.moves) : [];
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const winnerName =
    game.winner === game.whiteId
      ? game.white.name || game.white.email
      : game.winner === game.blackId
        ? game.black.name || game.black.email
        : null;

  const pgnResult: "1-0" | "0-1" | "1/2-1/2" | "*" =
    game.winner === game.whiteId
      ? "1-0"
      : game.winner === game.blackId
        ? "0-1"
        : game.status === "stalemate" || game.status === "draw"
          ? "1/2-1/2"
          : "*";
  const pgn = buildPgn({
    whiteName: game.white.name || game.white.email,
    blackName: game.black.name || game.black.email,
    whiteElo: game.white.elo,
    blackElo: game.black.elo,
    result: pgnResult,
    date: new Date(game.createdAt),
    moves,
  });

  return (
    <main className="mx-auto max-w-4xl min-w-0 px-0 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="text-sm font-medium text-stone-400 transition hover:text-white"
        >
          ← Dashboard
        </Link>
        <Link
          href="/admin/reports"
          className="text-sm font-medium text-stone-400 transition hover:text-white"
        >
          Reports
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Review game
      </h1>
      <p className="mt-1 font-mono text-sm text-stone-500">{game.id}</p>

      {/* Game summary */}
      <section className="mt-8 rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Game summary</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-stone-500">White</dt>
            <dd className="font-medium text-white">
              {game.white.name || game.white.email}
            </dd>
            <dd className="text-xs text-stone-500">{game.white.email} · ELO {game.white.elo}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Black</dt>
            <dd className="font-medium text-white">
              {game.black.name || game.black.email}
            </dd>
            <dd className="text-xs text-stone-500">{game.black.email} · ELO {game.black.elo}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Stake</dt>
            <dd className="text-white">{formatCents(game.stake)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Status</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-stone-600/80 px-2 py-0.5 text-xs font-medium text-stone-300">
                {game.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">End reason</dt>
            <dd className="text-stone-300">{END_REASON[game.status] ?? game.status}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Winner</dt>
            <dd className="text-stone-300">
              {winnerName ?? (game.status === "stalemate" || game.status === "draw" ? "Draw" : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Started</dt>
            <dd className="text-stone-400">{formatDate(game.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Replayer */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Replay game</h2>
        <GameReplayer moves={moves} />
      </section>

      {/* Open in Lichess */}
      <section className="mt-8">
        <OpenInLichess pgn={pgn} fen={game.fen} />
      </section>

      {/* Move history (text list) */}
      <section className="mt-8 rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Move history</h2>
        {moves.length === 0 ? (
          <p className="text-sm text-stone-500">No moves recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {moves.map((san, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-stone-700/80 px-2.5 py-1 text-sm font-medium text-stone-200"
              >
                <span className="mr-1.5 text-xs text-stone-500">{Math.floor(i / 2) + 1}.</span>
                {san}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Reports for this game */}
      <section className="mt-8 rounded-xl border border-stone-600/80 bg-stone-800/80 p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Reports for this game</h2>
        {game.reports.length === 0 ? (
          <p className="text-sm text-stone-500">No reports for this game.</p>
        ) : (
          <ul className="space-y-4">
            {game.reports.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-stone-600/80 bg-stone-700/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">
                    {r.user.name || r.user.email}
                  </span>
                  <span className="text-xs text-stone-500">{formatDate(r.createdAt)}</span>
                  <span className="inline-flex items-center rounded-full bg-stone-600/80 px-2 py-0.5 text-xs font-medium text-stone-300">
                    {r.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-stone-400">{r.message}</p>
                {r.adminNotes && (
                  <div className="mt-3 rounded-lg border border-stone-600 bg-stone-700/80 p-3 text-sm text-stone-300">
                    <span className="font-medium">Admin note:</span> {r.adminNotes}
                  </div>
                )}
                <p className="mt-2">
                  <Link
                    href="/admin/reports"
                    className="text-xs font-medium text-white underline decoration-stone-500 underline-offset-2 hover:decoration-white"
                  >
                    Edit report in dashboard →
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8">
        <Link href="/admin" className="text-sm font-medium text-stone-400 transition hover:text-white">
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}
