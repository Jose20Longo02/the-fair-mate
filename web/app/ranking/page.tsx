import Link from "next/link";
import { prisma } from "@/lib/prisma";

const PAGE_BG = "#252525";
const ACCENT_BLUE = "#1e40af";

type SortBy = "elo" | "earnings";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await searchParams;
  const sort: SortBy =
    sortParam === "earnings" ? "earnings" : "elo";

  const earningsRows = await prisma.ledgerEntry.groupBy({
    by: ["userId"],
    where: { type: { in: ["stake", "win", "refund"] } },
    _sum: { amount: true },
  });
  const earningsByUserId = new Map<string, number>(
    earningsRows.map((r) => [r.userId, r._sum.amount ?? 0])
  );

  const allUsers = await prisma.user.findMany({
    orderBy: { elo: "desc" },
    select: { id: true, name: true, email: true, elo: true },
  });

  const withEarnings = allUsers.map((u) => ({
    ...u,
    earningsCents: earningsByUserId.get(u.id) ?? 0,
  }));

  const players =
    sort === "earnings"
      ? [...withEarnings].sort((a, b) => b.earningsCents - a.earningsCents).slice(0, 50)
      : withEarnings.slice(0, 50);

  const formatEarnings = (cents: number) => {
    const sign = cents >= 0 ? "" : "-";
    return `${sign}$${Math.abs(cents / 100).toFixed(2)}`;
  };

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl min-w-0">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ranking
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-400 sm:mt-5 sm:text-base">
              {sort === "elo"
                ? "Top 50 players by ELO rating."
                : "Top 50 players by net earnings from games."}
            </p>
          </div>
          <Link
            href="/"
            className="flex min-h-[44px] shrink-0 items-center rounded-lg px-3 py-2.5 text-base font-medium text-stone-400 transition hover:bg-stone-800/80 hover:text-white touch-manipulation sm:py-2.5"
          >
            ← Back to home
          </Link>
        </div>

        {/* Sort: pill tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-3">
          <span className="w-full text-sm font-medium text-stone-500 sm:w-auto sm:mr-1">
            Sort by
          </span>
          <div className="inline-flex w-full min-w-0 flex-1 rounded-xl border border-stone-600/80 bg-stone-800/50 p-1 shadow-inner sm:w-auto sm:flex-initial">
            <Link
              href="/ranking?sort=elo"
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition touch-manipulation sm:min-h-0 sm:flex-initial ${
                sort === "elo"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-stone-400 hover:bg-stone-700/50 hover:text-stone-200"
              }`}
              style={sort === "elo" ? { backgroundColor: ACCENT_BLUE } : undefined}
            >
              ELO
            </Link>
            <Link
              href="/ranking?sort=earnings"
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition touch-manipulation sm:min-h-0 sm:flex-initial ${
                sort === "earnings"
                  ? "text-white shadow-sm"
                  : "text-stone-400 hover:bg-stone-700/50 hover:text-stone-200"
              }`}
              style={sort === "earnings" ? { backgroundColor: ACCENT_BLUE } : undefined}
            >
              Earnings
            </Link>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-stone-600/80 bg-stone-800/90 p-6 text-center shadow-xl sm:mt-8 sm:p-10">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-700/80 text-stone-500 sm:mb-4 sm:h-14 sm:w-14">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-base font-medium text-stone-400 sm:text-lg">
              No players registered yet.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Be the first to play and appear on the leaderboard.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-600/80 bg-stone-800/90 shadow-xl sm:mt-8">
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[260px] text-left sm:min-w-[320px]">
                <thead>
                  <tr
                    className="border-b border-stone-600/80"
                    style={{
                      background: "linear-gradient(180deg, rgba(68,64,60,0.6) 0%, rgba(41,37,36,0.5) 100%)",
                    }}
                  >
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400 sm:px-5 sm:py-4 md:px-6">
                      #
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400 sm:px-5 sm:py-4 md:px-6">
                      Player
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-400 sm:px-5 sm:py-4 md:px-6">
                      ELO
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-400 sm:px-5 sm:py-4 md:px-6">
                      Earnings
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-600/50">
                  {players.map((player, i) => {
                    const isTopThree = i < 3;
                    const borderAccent =
                      i === 0 ? "border-amber-400/70" : i === 1 ? "border-stone-400/60" : i === 2 ? "border-amber-600/60" : "";
                    return (
                      <tr
                        key={player.id}
                        className={`transition-colors hover:bg-stone-700/40 ${
                          i % 2 === 1 ? "bg-stone-800/30" : ""
                        } ${isTopThree ? `border-l-4 ${borderAccent}` : ""}`}
                      >
                        <td className="px-3 py-3 font-mono text-sm tabular-nums text-stone-500 sm:px-5 sm:py-4 sm:text-base md:px-6">
                          {i + 1}
                        </td>
                        <td className="max-w-[120px] px-3 py-3 sm:max-w-none sm:px-5 sm:py-4 md:px-6">
                          <span className="block truncate font-medium text-stone-100 sm:text-base" title={player.name || player.email}>
                            {player.name || player.email.split("@")[0]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right sm:px-5 sm:py-4 md:px-6">
                          <span className="inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-amber-300 sm:text-base md:text-lg">
                            {player.elo}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-3 text-right text-sm font-semibold tabular-nums sm:px-5 sm:py-4 sm:text-base md:px-6 md:text-lg ${
                            player.earningsCents > 0
                              ? "text-emerald-400"
                              : player.earningsCents < 0
                                ? "text-red-400"
                                : "text-stone-500"
                          }`}
                        >
                          {formatEarnings(player.earningsCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
