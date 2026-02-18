"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NetworkOption = { id: string; name: string };

export default function WithdrawForm({
  networks,
  balanceCents,
  className = "",
}: {
  networks: NetworkOption[];
  balanceCents: number;
  className?: string;
}) {
  const firstNetwork = networks[0]?.id ?? "polygon";
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState(firstNetwork);
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const maxDollars = (balanceCents / 100).toFixed(2);

  useEffect(() => {
    if (!loading) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [loading]);

  const setMax = () => {
    setAmount(maxDollars);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amountNum = Math.round(parseFloat(amount) * 100);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    const addr = destination.trim();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError("Enter a valid 0x address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: amountNum,
          network,
          destinationAddress: addr,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(`Withdrawal submitted. Tx: ${data.txHash?.slice(0, 10)}…`);
        setAmount("");
        setDestination("");
        router.refresh();
      } else {
        setError(data.error ?? "Withdrawal failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  if (networks.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No networks configured for withdrawal. Add RPC URLs in .env (e.g. POLYGON_RPC_URL).
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-stone-400">Network</label>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          disabled={loading}
          className="mt-1 w-full rounded-xl border border-stone-600 bg-stone-800/80 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {networks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-stone-400">Amount ($)</label>
          <span className="text-xs text-stone-500">Balance: ${(balanceCents / 100).toFixed(2)}</span>
        </div>
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className="flex-1 rounded-xl border border-stone-600 bg-stone-800/80 px-3 py-2.5 text-white placeholder-stone-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={setMax}
            disabled={loading}
            className="shrink-0 rounded-xl border border-stone-600 bg-stone-700 px-3 py-2.5 text-sm font-medium text-stone-200 transition hover:bg-stone-600"
          >
            Max
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-400">Destination address</label>
        <input
          type="text"
          placeholder="0x..."
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={loading}
          className="mt-1 w-full rounded-xl border border-stone-600 bg-stone-800/80 px-3 py-2.5 font-mono text-sm text-white placeholder-stone-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-stone-600 px-4 py-3 font-semibold text-white transition hover:bg-stone-500 disabled:opacity-50"
      >
        {loading ? "Processing…" : "Withdraw"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-600 bg-stone-800 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-stone-500 border-t-emerald-500 animate-spin" />
            <h3 className="text-lg font-semibold text-white">Processing withdrawal</h3>
            <p className="mt-2 text-sm text-stone-300">
              This might take a few minutes. Please do not close this window.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Navigation is temporarily disabled until the transaction finishes.
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
