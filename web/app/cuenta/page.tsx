import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DepositButton from "@/components/DepositButton";
import AccountAvatarSection from "./AccountAvatarSection";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

export default async function Cuenta() {
  const session = await getSession();
  if (!session) redirect("/login?from=/cuenta");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, elo: true, balance: true, createdAt: true, avatar: true },
  });
  if (!user) redirect("/login?from=/cuenta");

  const ledger = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const formatBalance = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              My account
            </h1>
            <p className="mt-1 text-sm text-stone-400 sm:text-base">Your profile, balance and history.</p>
          </div>
          <Link href="/" className="shrink-0 text-sm font-medium text-stone-400 transition hover:text-white">
            ← Back to home
          </Link>
        </div>

        {/* Balance */}
        <div
          className="mt-6 rounded-xl border border-stone-600/80 px-5 py-5 text-center sm:mt-8 sm:py-6"
          style={{
            background: `linear-gradient(180deg, ${BUTTON_BLUE} 0%, #1e3a8a 100%)`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Available balance (simulated USDC)</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">{formatBalance(user.balance)}</p>
          <div className="mt-4">
            <DepositButton className="min-h-[44px] rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1e40af] hover:bg-white/95 touch-manipulation" />
          </div>
        </div>

        {/* Profile */}
        <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-white shadow-xl sm:mt-8 sm:p-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-500">Profile</h2>
          <AccountAvatarSection currentAvatar={user.avatar} />
          <dl className="mt-4 space-y-3 sm:mt-5">
            <div>
              <dt className="text-sm font-medium text-stone-500">ID (for testing)</dt>
              <dd className="mt-0.5 font-mono text-sm text-stone-300 break-all">{user.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-stone-500">Email</dt>
              <dd className="mt-0.5 text-base text-stone-200">{user.email}</dd>
            </div>
            {user.name && (
              <div>
                <dt className="text-sm font-medium text-stone-500">Name</dt>
                <dd className="mt-0.5 text-base text-stone-200">{user.name}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-stone-500">ELO</dt>
              <dd className="mt-0.5 text-lg font-semibold text-amber-300">{user.elo}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-stone-500">Account since</dt>
              <dd className="mt-0.5 text-sm text-stone-300">
                {new Date(user.createdAt).toLocaleDateString("en", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </div>

        {/* Recent transactions */}
        <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-white shadow-xl sm:mt-8 sm:p-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-500">Recent transactions</h2>
          {ledger.length === 0 ? (
            <p className="mt-4 text-base text-stone-500">No transactions yet.</p>
          ) : (
            <div className="mt-4 space-y-0 divide-y divide-stone-600/60">
              {ledger.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div className="min-w-0">
                    <span className="capitalize text-base font-medium text-stone-200">{entry.type}</span>
                    {entry.description && (
                      <span className="ml-2 text-sm text-stone-500">— {entry.description}</span>
                    )}
                  </div>
                  <span className={`shrink-0 text-base font-semibold tabular-nums ${entry.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.amount >= 0 ? "+" : ""}{formatBalance(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
