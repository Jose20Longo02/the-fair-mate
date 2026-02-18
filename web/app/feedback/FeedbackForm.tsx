"use client";

import { useState } from "react";

const BUTTON_GREEN = "#15803d";

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (message.trim().length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not submit feedback.");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-300">Thank you for your feedback.</p>
        <p className="mt-1 text-sm text-stone-300">
          We use this to improve FairMate.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="feedback-message" className="block text-sm font-medium text-stone-300">
          Your feedback
        </label>
        <textarea
          id="feedback-message"
          name="message"
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What should we improve or add?"
          className="mt-2 min-h-[160px] w-full rounded-lg border border-stone-600 bg-stone-800/80 px-4 py-3 text-base text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/30"
        />
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="rounded-lg px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: BUTTON_GREEN }}
      >
        {sending ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
