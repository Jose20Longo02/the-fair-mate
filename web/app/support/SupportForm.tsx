"use client";

import { useState } from "react";

const BUTTON_BLUE = "#1e40af";

export default function SupportForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim();

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "min-h-[48px] w-full rounded-lg border border-stone-600 bg-stone-700/80 px-4 py-3 text-base text-white placeholder-stone-500 transition focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/30 sm:min-h-[48px] sm:px-5 sm:py-3";

  if (sent) {
    return (
      <div className="mt-10 rounded-xl border border-stone-600/80 bg-stone-800/90 p-8 text-center sm:mt-12 sm:p-10">
        <p className="text-lg font-medium text-white sm:text-xl">
          Thank you for reaching out.
        </p>
        <p className="mt-2 text-base text-stone-400">
          We&apos;ll get back to you as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex w-full flex-col gap-5 sm:mt-10 sm:gap-6"
    >
      <div className="w-full min-w-0 text-left">
        <label htmlFor="support-name" className="block text-sm font-medium text-stone-400 sm:text-base">
          Full name <span className="text-stone-500">*</span>
        </label>
        <input
          id="support-name"
          type="text"
          name="name"
          required
          placeholder="Your full name"
          className={`mt-2 ${inputClass}`}
        />
      </div>
      <div className="w-full min-w-0 text-left">
        <label htmlFor="support-email" className="block text-sm font-medium text-stone-400 sm:text-base">
          Email Address <span className="text-stone-500">*</span>
        </label>
        <input
          id="support-email"
          type="email"
          name="email"
          required
          placeholder="your@email.com"
          className={`mt-2 ${inputClass}`}
        />
      </div>
      <div className="w-full min-w-0 text-left">
        <label htmlFor="support-message" className="block text-sm font-medium text-stone-400 sm:text-base">
          Message <span className="text-stone-500">*</span>
        </label>
        <textarea
          id="support-message"
          name="message"
          required
          rows={5}
          placeholder="How can we help you?"
          className={`mt-2 min-h-[120px] w-full resize-y rounded-lg border border-stone-600 bg-stone-700/80 px-4 py-3 text-base text-white placeholder-stone-500 transition focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/30 sm:min-h-[140px] sm:px-5 sm:py-4`}
        />
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="w-full min-w-0 pt-1 sm:pt-2">
        <button
          type="submit"
          disabled={sending}
          className="min-h-[48px] w-full rounded-lg px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60 touch-manipulation sm:min-h-[52px] sm:py-4 sm:text-lg"
          style={{ backgroundColor: BUTTON_BLUE }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
