import Link from "next/link";
import type { Metadata } from "next";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Page not found — FairMate",
  description: "The page you requested does not exist.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFoundPage() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-12 sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-16 md:min-h-[calc(100vh-6rem)] md:px-10 md:py-20"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">404</h1>
        <p className="mt-4 text-lg text-stone-300">Page not found</p>
        <p className="mt-2 text-sm text-stone-500">
          The URL may be outdated or typed incorrectly.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-stone-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-600"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
