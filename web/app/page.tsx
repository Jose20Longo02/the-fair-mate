import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LoopingChessDemo from "@/components/LoopingChessDemo";
import CtaButton from "@/components/CtaButton";
import Home1v1Card from "@/components/Home1v1Card";
import HomeChallengeCard from "@/components/HomeChallengeCard";
import HomeChallengesSection from "@/components/HomeChallengesSection";
import HomeRecentGames from "@/components/HomeRecentGames";
import ScrollToMyChallenges from "@/components/ScrollToMyChallenges";
import ReconnectGameModal from "@/components/ReconnectGameModal";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <main
        className="flex min-h-[calc(100vh-4rem)] w-full flex-1 items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 sm:py-10 md:min-h-[calc(100vh-6rem)] md:py-12 lg:py-16"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 sm:gap-10 md:flex-row md:items-center md:justify-center md:gap-14 lg:gap-16 xl:gap-20">
          <div className="flex w-full shrink-0 justify-center sm:w-auto">
            <LoopingChessDemo />
          </div>
          <div className="flex shrink-0 flex-col items-center text-center">
            <div className="w-full min-w-0 max-w-lg px-1 sm:min-w-[18rem] sm:px-0">
              <h1 className="mx-auto max-w-[16ch] text-4xl font-black leading-tight text-white sm:text-5xl md:text-5xl lg:text-5xl">
                Play where every game counts!
              </h1>
              <p className="mx-auto mt-4 max-w-[18rem] text-[15px] font-normal leading-snug text-stone-400 sm:mt-5 sm:max-w-[20rem] sm:text-base md:mt-6 md:max-w-[22rem] md:text-lg">
                Fair 1v1 matches against players your level. Fixed stakes. Transparent rules.
              </p>
              <CtaButton
                href="/register"
                className="btn-cta-glow relative mx-auto mt-6 flex w-full max-w-xs items-center justify-center rounded-lg px-5 py-3.5 text-center text-base font-normal text-white transition-all duration-200 hover:scale-105 hover:opacity-90 sm:mt-8 sm:max-w-md sm:px-6 sm:py-4 sm:text-lg"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                <span className="relative z-10">Start playing</span>
              </CtaButton>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, elo: true, email: true, balance: true, emailVerified: true },
  });
  if (!user) {
    return null;
  }

  const games = await prisma.game.findMany({
    where: {
      OR: [{ whiteId: user.id }, { blackId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      white: { select: { id: true, name: true, email: true, elo: true } },
      black: { select: { id: true, name: true, email: true, elo: true } },
    },
  });

  const displayName = user.name || user.email.split("@")[0];
  const recentGamesRows = games.map((game) => {
    const isWhite = game.whiteId === user.id;
    const me = isWhite ? game.white : game.black;
    const opp = isWhite ? game.black : game.white;
    const myName = me.name || me.email.split("@")[0];
    const oppName = opp.name || opp.email.split("@")[0];
    let moveCount = 0;
    if (game.moves) {
      try {
        const arr = JSON.parse(game.moves) as string[];
        moveCount = Array.isArray(arr) ? arr.length : 0;
      } catch {}
    }
    return {
      id: game.id,
      isWhite,
      won: game.winner === user.id,
      lost: Boolean(game.winner && game.winner !== user.id),
      myName,
      myElo: me.elo,
      oppName,
      oppElo: opp.elo,
      moveCount,
      stakeCents: game.stake,
      date: new Date(game.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };
  });

  return (
    <main
      className="relative min-h-[calc(100vh-4rem)] w-full flex-1 overflow-hidden px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 sm:py-8 md:min-h-[calc(100vh-6rem)] md:py-10"
      style={{
        background: `
          radial-gradient(ellipse 100% 60% at 50% -10%, rgba(30,64,175,0.08) 0%, transparent 50%),
          linear-gradient(180deg, #282828 0%, ${PAGE_BG} 25%, #1e1e1e 100%)
        `,
      }}
    >
      <ReconnectGameModal />
      <ScrollToMyChallenges />
      <div className="mx-auto max-w-6xl">
        {/* Email verification banner */}
        {!user.emailVerified && (
          <a
            href="/verify-email"
            className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 transition hover:bg-amber-500/20 sm:mb-8"
          >
            <span className="text-2xl">✉️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-300">Verify your email to start playing</p>
              <p className="mt-0.5 text-sm text-stone-400">
                You need to verify your email before you can play or deposit. Tap here to verify.
              </p>
            </div>
          </a>
        )}

        {/* Title row: Play a game | Username (ELO) — stack on mobile */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <h1 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">Play a game</h1>
          <p className="text-lg font-normal text-stone-300 sm:text-xl md:text-2xl lg:text-3xl">
            {displayName} <span className="text-stone-400">({user.elo})</span>
          </p>
        </div>

        {/* 2 columns: 1v1, Challenge — single column on mobile with clear separator */}
        <div className="mt-10 grid grid-cols-1 gap-0 sm:mt-12 lg:grid-cols-2 lg:gap-10">
          <Home1v1Card userId={user.id} balanceCents={user.balance} />
          <div className="flex flex-col items-center gap-4 px-4 py-6 sm:py-8 lg:hidden" aria-hidden>
            <span className="h-px w-20 shrink-0 bg-gradient-to-r from-transparent via-stone-500 to-transparent" />
            <span className="text-xs font-medium uppercase tracking-wider text-stone-500">or</span>
            <span className="h-px w-20 shrink-0 bg-gradient-to-r from-transparent via-stone-500 to-transparent" />
          </div>
          <HomeChallengeCard userId={user.id} />
        </div>

        {/* My Challenges */}
        <div id="my-challenges" className="mt-12 scroll-mt-20 sm:mt-14 md:mt-16 md:scroll-mt-24">
          <HomeChallengesSection userId={user.id} />
        </div>

        {/* Recent Games */}
        <div className="mt-12 sm:mt-14 md:mt-16">
          <HomeRecentGames games={recentGamesRows} />
        </div>
      </div>
    </main>
  );
}
