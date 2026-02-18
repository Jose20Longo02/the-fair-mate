"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserProvider, Contract, parseUnits } from "ethers";

const CHAIN_IDS: Record<string, number> = { polygon: 137, base: 8453 };

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
] as const;
const DEPOSIT_ABI = [
  "function depositFor(string userId, uint256 amount)",
] as const;

type Network = { id: "polygon" | "base"; name: string; depositContract: string; usdcAddress: string };

export default function DepositForm({
  userId,
  networks,
  className = "",
}: {
  userId: string;
  networks: Network[];
  className?: string;
}) {
  const [network, setNetwork] = useState<Network>(networks[0]);
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const connectWallet = async () => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No wallet found. Install MetaMask or another Web3 wallet.");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts?.length) setWallet(accounts[0] as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  const deposit = async () => {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!wallet || !window.ethereum) {
      setError("Connect your wallet first");
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const chainId = Number(await provider.getNetwork().then((n) => n.chainId));
      const expectedChainId = CHAIN_IDS[network.id];
      if (chainId !== expectedChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
        } catch (switchErr: unknown) {
          setError("Please switch your wallet to " + network.name);
          setLoading(false);
          return;
        }
      }
      const amountWei = parseUnits(amountNum.toFixed(6), 6);
      const usdc = new Contract(network.usdcAddress, USDC_ABI, signer);
      const depositContract = new Contract(network.depositContract, DEPOSIT_ABI, signer);
      const currentAllowance = await usdc.allowance(wallet, network.depositContract);
      if (currentAllowance < amountWei) {
        const approveTx = await usdc.approve(network.depositContract, amountWei);
        await approveTx.wait();
      }
      const tx = await depositContract.depositFor(userId, amountWei);
      await tx.wait();
      router.refresh();
      setAmount("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-white shadow-xl sm:p-6 ${className}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-400">Network</label>
          <select
            value={network.id}
            onChange={(e) => setNetwork(networks.find((n) => n.id === e.target.value) ?? network)}
            className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-400">Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-white placeholder-stone-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {!wallet ? (
          <button
            type="button"
            onClick={connectWallet}
            className="w-full rounded-xl bg-[#1e40af] px-4 py-3 font-semibold text-white transition hover:bg-[#1e3a8a]"
          >
            Connect wallet
          </button>
        ) : (
          <>
            <p className="text-sm text-stone-500">
              Connected: {wallet.slice(0, 6)}…{wallet.slice(-4)}
            </p>
            <button
              type="button"
              onClick={deposit}
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Confirm in wallet…" : "Deposit"}
            </button>
          </>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
