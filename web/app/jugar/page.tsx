import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MatchmakingPanel from "@/components/MatchmakingPanel";
import ChallengePanel from "@/components/ChallengePanel";

export const metadata: Metadata = {
  title: "Play a game — FairMate",
  description: "Random matchmaking or challenge someone by email or nickname.",
};

export default async function Jugar() {
  const session = await getSession();
  if (!session) redirect("/login?from=/jugar");

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { emailVerified: true } });
  if (user && !user.emailVerified) redirect("/verify-email");

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">
        Play a game
      </h1>
      <p className="mt-1 text-stone-600">
        Random matchmaking or challenge someone by email or nickname.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-stone-900">Random matchmaking</h2>
        <p className="mt-1 text-sm text-stone-600">
          Choose your stake and we'll match you with another player with the same stake.
        </p>
        <MatchmakingPanel userId={session.userId} />
      </section>

      <section className="mt-12 border-t border-stone-200 pt-10">
        <h2 className="text-lg font-semibold text-stone-900">Challenge someone</h2>
        <p className="mt-1 text-sm text-stone-600">
          Enter opponent email or nickname. You can negotiate the stake before playing.
        </p>
        <ChallengePanel userId={session.userId} />
      </section>

      <p className="mt-8 text-center">
        <Link href="/cuenta" className="text-stone-500 hover:underline">
          ← Back to My account
        </Link>
      </p>
    </main>
  );
}
