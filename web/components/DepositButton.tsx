"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BUTTON_BLUE = "#1e40af";

export default function DepositButton({
  variant,
  className,
  onClick: onClose,
}: {
  variant?: "default" | "header";
  className?: string;
  onClick?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDeposit = async () => {
    setLoading(true);
    onClose?.();
    try {
      const res = await fetch("/api/account/deposit", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Deposit failed");
      }
    } catch {
      alert("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const isHeader = variant === "header";

  const baseClass = isHeader
    ? "inline-flex min-h-[40px] min-w-[5.5rem] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:min-h-[44px] sm:min-w-0 sm:px-5 sm:py-2.5"
    : "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

  const fullClass = className
    ? `${baseClass} ${className}`.trim()
    : `${baseClass} bg-emerald-700 text-white hover:bg-emerald-800`.trim();

  return (
    <button
      onClick={handleDeposit}
      disabled={loading}
      className={fullClass}
      style={isHeader ? { backgroundColor: BUTTON_BLUE } : undefined}
    >
      {loading ? "Depositing…" : isHeader ? "Deposit" : "Deposit $10 (simulated)"}
    </button>
  );
}
