"use client";

import { useState, useEffect, useCallback } from "react";
import DepositButton from "@/components/DepositButton";
import WithdrawForm from "@/components/WithdrawForm";

const BUTTON_BLUE = "#1e40af";
const POLL_INTERVAL_MS = 15_000;

type NetworkOption = { id: string; name: string };

export default function AccountBalanceSection({
  initialBalanceCents,
  withdrawNetworks,
}: {
  initialBalanceCents: number;
  withdrawNetworks: NetworkOption[];
}) {
  const [balanceCents, setBalanceCents] = useState(initialBalanceCents);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/account/balance");
      if (res.ok) {
        const data = await res.json();
        setBalanceCents(data.balance);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const id = setInterval(fetchBalance, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchBalance]);

  const formatBalance = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      {/* Balance */}
      <div
        className="mt-6 rounded-xl border border-stone-600/80 px-5 py-5 text-center sm:mt-8 sm:py-6"
        style={{
          background: `linear-gradient(180deg, ${BUTTON_BLUE} 0%, #1e3a8a 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Available balance</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">{formatBalance(balanceCents)}</p>
        <div className="mt-4">
          <DepositButton className="min-h-[44px] rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1e40af] hover:bg-white/95 touch-manipulation" />
        </div>
      </div>

      {/* Withdraw */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-stone-600/60 bg-gradient-to-b from-stone-800/95 to-stone-900/95 text-white shadow-2xl shadow-black/30 sm:mt-8">
        <div className="border-b border-stone-600/50 bg-stone-800/50 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Withdraw</h2>
          <p className="mt-1 text-sm text-stone-500">Send balance to your wallet.</p>
        </div>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <WithdrawForm networks={withdrawNetworks} balanceCents={balanceCents} />
        </div>
      </div>
    </>
  );
}
