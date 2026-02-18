import type { Metadata } from "next";
import Link from "next/link";
import SupportForm from "./SupportForm";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Support — FairMate",
  description: "Get help with deposits, withdrawals, game results, and account issues on FairMate.",
  keywords: [
    "FairMate support",
    "secure USDC deposits for chess",
    "instant USDC withdrawal chess",
  ],
  alternates: {
    canonical: "/support",
  },
  openGraph: {
    title: "Support — FairMate",
    description: "Get help with deposits, withdrawals, game results, and account issues on FairMate.",
    url: "/support",
    images: [{ url: "/images/FairMate%20Logo.jpg?v=3", alt: "FairMate logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Support — FairMate",
    description: "Get help with deposits, withdrawals, game results, and account issues on FairMate.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long does a USDC deposit take to appear?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Deposits are credited after on-chain confirmation and indexing, usually within around 2 minutes.",
      },
    },
    {
      "@type": "Question",
      name: "How are stake payouts calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Both players stake the same amount. The winner receives the pot minus a 2% platform fee. Draws are refunded.",
      },
    },
    {
      "@type": "Question",
      name: "What should I do if I think a game result is wrong?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Submit a report from the game result screen. Our team reviews reports and provides a response in your reports section.",
      },
    },
  ],
};

export default function SupportPage() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-xl min-w-0 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          FairMate support
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-stone-400 sm:mt-5 sm:text-lg md:mt-6">
          Get help with deposits, withdrawals, game reports, and account issues. We usually respond quickly.
        </p>
        <div className="mt-6 rounded-xl border border-stone-600/80 bg-stone-800/80 p-4 text-left text-sm text-stone-300">
          <h2 className="text-base font-semibold text-white">Quick answers</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Deposits can take around 2 minutes after confirmation to appear in balance.</li>
            <li>Withdrawals may take a few minutes depending on network conditions.</li>
            <li>For game disputes, use the report flow to receive an official review.</li>
          </ul>
          <p className="mt-3 text-stone-400">
            Also read{" "}
            <Link href="/how-it-works" className="text-white underline underline-offset-2 hover:no-underline">
              How it works
            </Link>{" "}
            and{" "}
            <Link href="/fair-play" className="text-white underline underline-offset-2 hover:no-underline">
              Fair Play
            </Link>.
          </p>
        </div>
        <SupportForm />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </div>
    </main>
  );
}
