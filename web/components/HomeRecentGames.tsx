import Link from "next/link";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

type GameRow = {
  id: string;
  isWhite: boolean;
  won: boolean;
  lost: boolean;
  myName: string;
  myElo: number;
  oppName: string;
  oppElo: number;
  moveCount: number;
  stakeCents: number;
  date: string;
};

function winnerProfitCents(stakeCents: number): number {
  const potCents = stakeCents * 2;
  const winnerGetsCents = Math.floor(potCents * (1 - PLATFORM_FEE_PERCENT));
  return winnerGetsCents - stakeCents;
}

export default function HomeRecentGames({ games }: { games: GameRow[] }) {
  if (games.length === 0) {
    return (
      <section className="rounded-xl border border-stone-600/90 bg-stone-800/90 p-5 text-white shadow-xl shadow-black/20 transition-all duration-300 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.5) 0%, rgba(28,25,23,0.7) 100%)" }}>
        <h2 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl md:font-thin">Recent Games</h2>
        <p className="mt-3 text-sm text-stone-400 sm:mt-4">You haven&apos;t played any games yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-600/90 bg-stone-800/90 p-5 text-white shadow-xl shadow-black/20 transition-all duration-300 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(41,37,36,0.5) 0%, rgba(28,25,23,0.7) 100%)" }}>
      <h2 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl md:font-thin">Recent Games</h2>
      <ul className="mt-4 space-y-4 sm:mt-5">
        {games.map((g) => {
          const profitCents = g.won ? winnerProfitCents(g.stakeCents) : g.lost ? -g.stakeCents : 0;
          const profitFormatted =
            g.won || g.lost
              ? `${profitCents >= 0 ? "+" : ""}$${(Math.abs(profitCents) / 100).toFixed(1)}`
              : "$0";

          return (
            <li key={g.id}>
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-stone-600/80 bg-stone-700/50 px-4 py-4 transition-colors hover:bg-stone-700/70 sm:px-6 sm:py-4 md:items-center md:gap-6 md:py-5 md:px-6 lg:gap-6 lg:px-8 md:[grid-template-columns:repeat(7,auto)]">
                {/* 1. Result icon */}
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-3xl md:h-10 md:w-10 md:text-2xl ${
                    g.won ? "bg-emerald-900/50 text-emerald-400" : g.lost ? "bg-red-900/30 text-red-400" : "bg-stone-600 text-stone-400"
                  }`}
                  aria-hidden
                >
                  ♔
                </span>
                {/* 2. Players — ancho según contenido */}
                <div className="min-w-0">
                  <p className="font-medium text-white md:whitespace-nowrap">
                    {g.myName} <span className="text-stone-400">({g.myElo})</span>
                  </p>
                  <p className="text-sm text-stone-400 md:whitespace-nowrap">
                    {g.oppName} ({g.oppElo})
                  </p>
                </div>
                {/* 3. Piece colors */}
                <div className="text-sm text-white sm:text-base md:whitespace-nowrap">
                  <p>{g.isWhite ? "Whites" : "Blacks"}</p>
                  <p className="text-stone-400">{g.isWhite ? "Blacks" : "Whites"}</p>
                  <p className="mt-0.5 text-stone-500 md:hidden">{g.moveCount} moves</p>
                </div>
                {/* 4. Movements — desktop */}
                <span className="hidden text-base text-stone-300 md:inline md:whitespace-nowrap">{g.moveCount} moves</span>
                {/* 5. Summary button */}
                <Link
                  href={`/partida/${g.id}`}
                  className="min-h-[44px] flex shrink-0 items-center justify-center rounded-lg bg-stone-600 px-4 py-2.5 text-center text-sm font-medium text-stone-300 transition-colors hover:bg-stone-500 hover:text-white md:py-2"
                >
                  Summary
                </Link>
                {/* 6. Date — ancho según contenido */}
                <span className="text-sm text-stone-500 sm:text-base md:whitespace-nowrap">{g.date}</span>
                {/* 7. Profit/Loss */}
                <span
                  className={`text-base font-medium md:whitespace-nowrap ${
                    g.won ? "text-emerald-400" : g.lost ? "text-red-400" : "text-stone-500"
                  }`}
                >
                  {profitFormatted}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
