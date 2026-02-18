import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepositAddress } from "@/lib/deposit-address";
import { getConfiguredNetworks } from "@/lib/networks";
import TransferCryptoSection from "@/components/TransferCryptoSection";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Deposit — FairMate",
  description: "Send USDC to your unique deposit address.",
};

export default async function DepositarPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/cuenta/depositar");

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { emailVerified: true } });
  if (user && !user.emailVerified) redirect("/verify-email");

  let depositAddress: string;
  try {
    depositAddress = getDepositAddress(session.userId);
  } catch {
    depositAddress = "";
  }

  const networks = getConfiguredNetworks();
  if (networks.length === 0 && depositAddress) {
    networks.push({ id: "polygon", name: "Polygon", chainId: 137, logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg" });
  }

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-xl min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Deposit</h1>
          <Link href="/cuenta" className="shrink-0 text-sm font-medium text-stone-400 transition hover:text-white">
            ← Back to account
          </Link>
        </div>
        <p className="mt-2 text-sm text-stone-400">
          Send USDC to your unique deposit address. Funds will appear in your balance after confirmation (usually within a few minutes).
        </p>
        {!depositAddress ? (
          <div className="mt-6 rounded-xl border border-amber-500/50 bg-amber-500/10 px-5 py-4 text-amber-200">
            <p className="font-medium">Deposits not configured</p>
            <p className="mt-1 text-sm text-amber-200/80">
              Set DEPOSIT_MASTER_SECRET in .env (at least 16 characters) to enable unique deposit addresses.
            </p>
          </div>
        ) : (
          <TransferCryptoSection depositAddress={depositAddress} networks={networks} className="mt-6" />
        )}
      </div>
    </main>
  );
}
