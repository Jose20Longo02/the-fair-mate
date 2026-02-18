"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [initialSending, setInitialSending] = useState(true);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const didSendRef = useRef(false);

  // On mount: auto-send a verification code (handles existing users who don't have one)
  useEffect(() => {
    if (didSendRef.current) return;
    didSendRef.current = true;
    fetch("/api/auth/resend-code", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error && !data.error.includes("already verified")) {
          setResendMsg(data.error);
        }
      })
      .catch(() => {})
      .finally(() => setInitialSending(false));
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    const full = next.join("");
    if (full.length === 6 && next.every((d) => d !== "")) {
      submitCode(full);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const next = pasted.split("");
      setCode(next);
      inputsRef.current[5]?.focus();
      submitCode(pasted);
    }
  }

  async function submitCode(fullCode: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setCode(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
        return;
      }
      // Success — redirect to home or account
      router.push("/");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMsg("");
    setError("");
    try {
      const res = await fetch("/api/auth/resend-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResendMsg(data.error || "Failed to resend.");
      } else {
        setResendMsg("New code sent! Check your inbox.");
      }
    } catch {
      setResendMsg("Connection error.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 sm:min-h-[calc(100vh-5rem)] md:min-h-[calc(100vh-6rem)]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Verify your email
        </h1>
        <p className="mt-3 text-base text-stone-400">
          {initialSending
            ? "Sending a verification code to your email…"
            : "We sent a 6-digit code to your email. Enter it below to activate your account."
          }
        </p>

        <div className="mt-8 flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-14 w-11 rounded-lg border border-stone-600 bg-stone-700/80 text-center text-2xl font-bold text-white transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-500/40 sm:h-16 sm:w-12"
              disabled={loading}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => submitCode(code.join(""))}
          disabled={loading || code.some((d) => d === "")}
          className="mt-6 min-h-[48px] w-full rounded-lg px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60 touch-manipulation"
          style={{ backgroundColor: BUTTON_BLUE }}
        >
          {loading ? "Verifying…" : "Verify"}
        </button>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm font-medium text-stone-400 transition hover:text-white disabled:opacity-60"
          >
            {resending ? "Sending…" : "Didn't receive the code? Resend"}
          </button>
          {resendMsg && (
            <p className="mt-2 text-sm text-stone-400">{resendMsg}</p>
          )}
        </div>
      </div>
    </main>
  );
}
