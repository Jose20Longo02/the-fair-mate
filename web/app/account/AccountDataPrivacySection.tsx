"use client";

import { useState } from "react";
import Link from "next/link";

export default function AccountDataPrivacySection() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `fairmate-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      window.location.href = "/";
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-white shadow-xl sm:mt-8 sm:p-6">
      <h2 className="text-xs font-medium uppercase tracking-widest text-stone-500">Data and privacy</h2>
      <p className="mt-3 text-sm text-stone-400">
        You can export a copy of your data or delete your account. See our{" "}
        <Link href="/privacy" className="text-amber-400 underline underline-offset-2 hover:no-underline">
          Privacy Policy
        </Link>{" "}
        for your rights.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg border border-stone-500/60 bg-stone-700/80 px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-600/80 disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Export my data"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/40"
        >
          Delete my account
        </button>
      </div>
      {deleteError && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-600 bg-stone-800 p-6 shadow-xl">
            <h3 id="delete-title" className="text-lg font-semibold text-white">
              Delete account?
            </h3>
            <p className="mt-2 text-sm text-stone-400">
              Your account will be permanently anonymized. You will be logged out and will not be able to sign in again.
              Withdraw any balance first. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-lg border border-stone-500 bg-stone-700 px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
