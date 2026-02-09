"use client";

/** Pot = 2 × stake. Platform takes 5%, winner gets 95%. Profit = winnerGets - stake. */
function winnerProfitCents(stakeCents: number): number {
  const potCents = stakeCents * 2;
  const platformFeePercent = 0.05;
  return Math.floor(potCents * (1 - platformFeePercent)) - stakeCents;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type GameSummarySectionProps = {
  game: {
    status: string;
    winner: string | null;
    stake: number;
    white: { id: string; name: string | null; email: string; elo: number };
    black: { id: string; name: string | null; email: string; elo: number };
    whiteId: string;
    blackId: string;
    moves: string | null;
    createdAt?: string;
    updatedAt?: string;
    whiteEloBefore?: number | null;
    blackEloBefore?: number | null;
    whiteEloAfter?: number | null;
    blackEloAfter?: number | null;
    whiteBalanceBeforeCents?: number | null;
    blackBalanceBeforeCents?: number | null;
  };
  userId: string;
  /** Cuando existe (p. ej. al cerrar el modal), mostramos el delta de ELO. */
  eloDelta?: number;
};

function statusToLabel(status: string): string {
  switch (status) {
    case "checkmate":
      return "Checkmate";
    case "stalemate":
      return "Stalemate";
    case "draw":
      return "Draw";
    case "resigned":
      return "Game abandoned";
    case "timeout":
      return "Time's up";
    case "disconnected":
      return "Opponent disconnected";
    default:
      return "Game over";
  }
}

export default function GameSummarySection({
  game,
  userId,
  eloDelta,
}: GameSummarySectionProps) {
  const isPlayerWhite = game.whiteId === userId;
  const won = game.winner === userId;
  const lost = Boolean(game.winner && game.winner !== userId);
  const isDraw = !game.winner;

  const whiteName = game.white.name || game.white.email.split("@")[0];
  const blackName = game.black.name || game.black.email.split("@")[0];

  let moveCount = 0;
  if (game.moves) {
    try {
      const arr = JSON.parse(game.moves) as string[];
      moveCount = Array.isArray(arr) ? arr.length : 0;
    } catch {}
  }

  const profitCents = won ? winnerProfitCents(game.stake) : lost ? -game.stake : 0;
  const profitFormatted =
    won || lost
      ? `${profitCents >= 0 ? "+" : "-"}${formatCents(Math.abs(profitCents))}`
      : formatCents(0);

  const dateStr =
    game.updatedAt || game.createdAt
      ? new Date(game.updatedAt || game.createdAt!).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const durationStr =
    game.createdAt && game.updatedAt
      ? (() => {
          const start = new Date(game.createdAt).getTime();
          const end = new Date(game.updatedAt).getTime();
          const mins = Math.max(0, Math.round((end - start) / 60000));
          if (mins < 60) return `${mins} min`;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return m ? `${h}h ${m}m` : `${h}h`;
        })()
      : null;

  const resultLabel = won ? "Victory" : lost ? "Defeat" : "Draw";

  const stakeCents = game.stake;
  const balanceBeforeCents =
    isPlayerWhite ? game.whiteBalanceBeforeCents : game.blackBalanceBeforeCents;
  const balanceAfterCents =
    balanceBeforeCents != null
      ? balanceBeforeCents -
        stakeCents +
        (won ? stakeCents + winnerProfitCents(stakeCents) : isDraw ? stakeCents : 0)
      : null;
  const balanceDeltaCents =
    balanceBeforeCents != null && balanceAfterCents != null
      ? balanceAfterCents - balanceBeforeCents
      : null;

  const eloBefore = isPlayerWhite ? game.whiteEloBefore : game.blackEloBefore;
  const eloAfter = isPlayerWhite ? game.whiteEloAfter : game.blackEloAfter;
  const eloDeltaStored =
    eloBefore != null && eloAfter != null ? eloAfter - eloBefore : eloDelta ?? null;

  const hasSnapshot =
    balanceBeforeCents != null ||
    eloBefore != null ||
    eloAfter != null;

  return (
    <section className="min-w-0 rounded-xl border border-stone-600 bg-stone-800/90 p-4 shadow-xl sm:p-6">
      <h2 className="text-base font-bold text-white sm:text-xl">Game summary</h2>
      <p className="mt-0.5 text-sm text-stone-400 sm:text-base">Result, balance and ELO</p>

      <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
        {/* Resultado + motivo */}
        <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
          <p className="text-base font-medium text-stone-300 sm:text-lg">
            Result:{" "}
            <span
              className={
                won
                  ? "text-emerald-400"
                  : lost
                    ? "text-red-400"
                    : "text-stone-400"
              }
            >
              {resultLabel}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-stone-400 sm:text-base">{statusToLabel(game.status)}</p>
        </div>

        {/* Jugadores */}
        <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
          <p className="text-sm text-stone-400 sm:text-base">Players</p>
          <p className="mt-0.5 text-base font-medium text-white sm:text-lg">
            {whiteName} ({game.white.elo}) — White
          </p>
          <p className="text-base font-medium text-white sm:text-lg">
            {blackName} ({game.black.elo}) — Black
          </p>
        </div>

        {/* Balance: before, after, difference */}
        {hasSnapshot && (
          <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
            <p className="text-sm font-medium text-stone-300">Your balance</p>
            {balanceBeforeCents != null && (
              <p className="mt-1 text-sm text-stone-400">
                Before match: <span className="font-medium text-stone-300">{formatCents(balanceBeforeCents)}</span>
              </p>
            )}
            {balanceAfterCents != null && (
              <p className="mt-0.5 text-sm text-stone-400">
                After match: <span className="font-medium text-stone-300">{formatCents(balanceAfterCents)}</span>
              </p>
            )}
            {balanceDeltaCents != null && (
              <p className="mt-1 text-base font-medium">
                Difference:{" "}
                <span
                  className={
                    balanceDeltaCents > 0
                      ? "text-emerald-400"
                      : balanceDeltaCents < 0
                        ? "text-red-400"
                        : "text-stone-400"
                  }
                >
                  {balanceDeltaCents >= 0 ? "+" : ""}
                  {formatCents(balanceDeltaCents)}
                </span>
              </p>
            )}
          </div>
        )}

        {/* ELO: before, after, difference */}
        {(eloBefore != null || eloAfter != null || eloDeltaStored != null) && (
          <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
            <p className="text-sm font-medium text-stone-300">Your ELO</p>
            {eloBefore != null && (
              <p className="mt-1 text-sm text-stone-400">
                Before match: <span className="font-medium text-stone-300">{eloBefore}</span>
              </p>
            )}
            {eloAfter != null && (
              <p className="mt-0.5 text-sm text-stone-400">
                After match: <span className="font-medium text-stone-300">{eloAfter}</span>
              </p>
            )}
            {eloDeltaStored != null && (
              <p className="mt-1 text-base font-medium">
                Difference:{" "}
                <span
                  className={
                    eloDeltaStored > 0
                      ? "text-emerald-400"
                      : eloDeltaStored < 0
                        ? "text-red-400"
                        : "text-stone-400"
                  }
                >
                  {eloDeltaStored >= 0 ? "+" : ""}
                  {eloDeltaStored}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Stake + Your result (legacy block, keep for games without snapshot) */}
        <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
          <p className="text-sm text-stone-400">Stake</p>
          <p className="mt-0.5 text-base font-medium text-stone-300">
            {formatCents(game.stake)} each
          </p>
          <p className="mt-2 text-sm text-stone-400">Your result</p>
          <p
            className={`mt-0.5 text-base font-medium ${
              won ? "text-emerald-400" : lost ? "text-red-400" : "text-stone-400"
            }`}
          >
            {profitFormatted}
          </p>
        </div>

        {/* ELO fallback when no ELO snapshot (e.g. old games) */}
        {eloBefore == null && eloAfter == null && (
          <div className="rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:px-4 sm:py-3">
            <p className="text-sm text-stone-400">ELO</p>
            {eloDelta != null ? (
              <p className="mt-0.5 text-base font-medium text-stone-300">
                <span className={eloDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {eloDelta >= 0 ? "+" : ""}
                  {eloDelta}
                </span>{" "}
                (your rating after this game)
              </p>
            ) : (
              <p className="mt-0.5 text-base font-medium text-stone-300">
                Your rating:{" "}
                {isPlayerWhite ? game.white.elo : game.black.elo}
              </p>
            )}
          </div>
        )}

        {/* Datos de la partida: fecha, duración, movimientos */}
        <div className="flex flex-wrap gap-3 rounded-lg border border-stone-600 bg-stone-700/60 px-3 py-2.5 text-white sm:gap-4 sm:px-4 sm:py-3">
          {dateStr && (
            <div className="min-w-0">
              <p className="text-xs text-stone-500 sm:text-sm">Date</p>
              <p className="text-xs font-medium text-stone-300 sm:text-sm">{dateStr}</p>
            </div>
          )}
          {durationStr && (
            <div className="min-w-0">
              <p className="text-xs text-stone-500 sm:text-sm">Duration</p>
              <p className="text-xs font-medium text-stone-300 sm:text-sm">{durationStr}</p>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-stone-500 sm:text-sm">Moves</p>
            <p className="text-xs font-medium text-stone-300 sm:text-sm">{moveCount} movements</p>
          </div>
        </div>
      </div>
    </section>
  );
}
