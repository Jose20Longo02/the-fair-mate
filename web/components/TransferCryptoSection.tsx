"use client";

import { useState } from "react";

const USDC_LOGO_URL = "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg";

type Network = { id: string; name: string; chainId: number; logoUrl: string };

export default function TransferCryptoSection({
  depositAddress,
  networks,
  className = "",
}: {
  depositAddress: string;
  networks: Network[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Network>(networks[0] ?? { id: "", name: "", chainId: 137, logoUrl: "" });
  const [txHash, setTxHash] = useState("");
  const [registeringPending, setRegisteringPending] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingOk, setPendingOk] = useState("");

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = depositAddress;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const current = selected.chainId ? selected : networks[0];
  const ethereumUri = current ? `ethereum:${depositAddress}@${current.chainId}` : depositAddress;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ethereumUri)}`;

  const registerPendingDeposit = async () => {
    const normalizedTxHash = txHash.trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(normalizedTxHash)) {
      setPendingError("Enter a valid transaction hash (0x...).");
      setPendingOk("");
      return;
    }
    if (!current?.chainId) {
      setPendingError("Select a network first.");
      setPendingOk("");
      return;
    }
    setRegisteringPending(true);
    setPendingError("");
    setPendingOk("");
    try {
      const res = await fetch("/api/account/deposits/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: normalizedTxHash,
          chainId: current.chainId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPendingError(data.error || "Could not register pending deposit.");
        return;
      }
      setPendingOk("Deposit registered. Balance will show Acreditando... until credited.");
      setTxHash("");
    } catch {
      setPendingError("Network error while registering pending deposit.");
    } finally {
      setRegisteringPending(false);
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-stone-600/60 bg-gradient-to-b from-stone-800/95 to-stone-900/95 text-white shadow-2xl shadow-black/30 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-stone-600/50 bg-stone-800/50 px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
          Transfer crypto
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-stone-700/80 px-3 py-1.5 text-sm font-medium text-stone-200">
            <img src={USDC_LOGO_URL} alt="" className="h-4 w-4" />
            USDC
          </span>
          {networks.length > 1 ? (
            <select
              value={selected.id}
              onChange={(e) => setSelected(networks.find((n) => n.id === e.target.value) ?? selected)}
              className="rounded-full border border-stone-600 bg-stone-800/80 px-3 py-1.5 text-sm font-medium text-stone-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          ) : (
            current && (
              <span className="inline-flex items-center gap-2 rounded-full bg-stone-700/80 px-3 py-1.5 text-sm font-medium text-stone-200">
                <img src={current.logoUrl} alt="" className="h-4 w-4" />
                {current.name}
              </span>
            )
          )}
          <span className="text-xs text-stone-500">Min $1</span>
        </div>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center px-5 py-8 sm:px-6 sm:py-10">
        <div className="relative rounded-2xl bg-white p-4 shadow-inner ring-2 ring-stone-600/40 ring-offset-4 ring-offset-stone-900/80">
          <img
            src={qrUrl}
            alt="QR code for deposit address"
            className="h-44 w-44 sm:h-52 sm:w-52"
          />
          {current?.logoUrl && (
            <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md ring-2 ring-stone-200">
              <img src={current.logoUrl} alt="" className="h-6 w-6" />
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-stone-500">
          Scan with your wallet to send USDC on {current?.name ?? "network"}
        </p>
      </div>

      {/* Address + Copy */}
      <div className="border-t border-stone-600/50 bg-stone-900/50 px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Your deposit address
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-stone-800/80 px-3 py-2.5">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-stone-300 sm:text-sm">
            {depositAddress}
          </code>
          <button
            type="button"
            onClick={copyAddress}
            className="shrink-0 rounded-lg bg-stone-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-600 active:scale-[0.98]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Send USDC on {current?.name ?? "the selected network"} to this address. Your balance will update after confirmation.
        </p>
        <div className="mt-4 rounded-xl border border-stone-600/60 bg-stone-800/70 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
            Track sent deposit
          </p>
          <p className="mt-1 text-xs text-stone-500">
            After sending USDC, paste your tx hash to show pending status in the header.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="min-h-[40px] w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-xs text-white placeholder-stone-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => void registerPendingDeposit()}
              disabled={registeringPending}
              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
            >
              {registeringPending ? "Registering..." : "Register tx"}
            </button>
          </div>
          {pendingError && <p className="mt-2 text-xs text-red-400">{pendingError}</p>}
          {pendingOk && <p className="mt-2 text-xs text-emerald-400">{pendingOk}</p>}
        </div>
        {selected.id === "polygon" && (
          <a
            href={`https://polygonscan.com/address/${depositAddress}#tokentxns`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            View this address on PolygonScan →
          </a>
        )}
        {selected.id === "base" && (
          <a
            href={`https://basescan.org/address/${depositAddress}#tokentxns`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            View this address on BaseScan →
          </a>
        )}
      </div>
    </div>
  );
}
