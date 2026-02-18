import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWithdrawNetworks } from "@/lib/networks";
import AccountBalanceSection from "@/components/AccountBalanceSection";
import AccountAvatarSection from "./AccountAvatarSection";
import AccountDataPrivacySection from "./AccountDataPrivacySection";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "My account — FairMate",
  description: "Your profile, balance and history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, elo: true, balance: true, createdAt: true, avatar: true, emailVerified: true },
  });
  if (!user) redirect("/login?from=/account");

  const ledger = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const withdrawNetworks = getWithdrawNetworks();
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

        {!user.emailVerified && (
          <Link
            href="/verify-email"
            className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 transition hover:bg-amber-500/20 sm:mt-8"
          >
            <span className="text-2xl">✉️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-300">Verify your email</p>
              <p className="mt-0.5 text-sm text-stone-400">
                You need to verify your email before you can play or deposit. Tap here to verify.
              </p>
            </div>
          </Link>
        )}

        <AccountBalanceSection
          initialBalanceCents={user.balance}
          withdrawNetworks={withdrawNetworks}
        />

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
              <dd className="mt-0.5 flex items-center gap-2 text-base text-stone-200">
                {user.email}
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Verified
                  </span>
                ) : (
                  <Link
                    href="/verify-email"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/25"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M6 3v3.5M6 8.5h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Not verified
                  </Link>
                )}
              </dd>
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

        <AccountDataPrivacySection />
      </div>
    </main>
  );
}
