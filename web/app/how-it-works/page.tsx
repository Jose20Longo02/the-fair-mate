import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "How It Works — FairMate",
  description: "Learn how FairMate USDC chess matches work: choose a stake, get matched, play, and settle transparently.",
  keywords: [
    "how chess stake payouts work",
    "USDC chess platform",
    "FairMate how it works",
  ],
  alternates: {
    canonical: "/how-it-works",
  },
  openGraph: {
    title: "How It Works — FairMate",
    description: "Choose a stake, get matched, play a skill-based chess game, and settle transparently.",
    url: "/how-it-works",
    images: [{ url: "/images/FairMate%20Logo.jpg?v=3", alt: "FairMate logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How It Works — FairMate",
    description: "Choose a stake, get matched, play a skill-based chess game, and settle transparently.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
};
const BUTTON_BLUE = "#1e40af";

const STEPS = [
  {
    title: "Choose a stake",
    description: "Select a fixed stake before the match begins.",
    image: "/images/Choose%20a%20stake.png",
  },
  {
    title: "Get matched",
    description: "You're paired with a player close to your rating.",
    image: "/images/Get%20matched.png",
  },
  {
    title: "Play the game",
    description: "Play a standard chess match under clear rules.",
    image: "/images/Play%20the%20game.png",
  },
  {
    title: "Winner takes the pot",
    description: "The winner receives the combined stake minus a flat fee (2%).",
    image: "/images/Winner%20takes%20the%20pot.png",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:pt-10 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12 md:pt-12 md:pb-[max(2rem,env(safe-area-inset-bottom))] lg:py-16 lg:pt-16"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-6xl min-w-0">
        <header className="text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
            How it works:
          </h1>
          <p className="mt-6 text-base leading-relaxed text-stone-300 sm:mt-6 sm:text-lg md:mt-4 md:text-xl lg:text-2xl">
            Simple rules. Clear amounts. Fair matches.
          </p>
        </header>

        <section
          aria-label="Steps"
          className="mt-14 border-t border-stone-600/70 pt-14 sm:mt-12 sm:border-0 sm:pt-12 lg:mt-16 lg:pt-16"
        >
          <div className="grid grid-cols-2 gap-6 gap-y-14 sm:gap-8 sm:gap-y-10 lg:grid-cols-4 lg:gap-8 lg:gap-y-0">
            {STEPS.map((step, index) => {
              const isLast = index === STEPS.length - 1;
              const borderClass = isLast
                ? ""
                : index === 1
                  ? "border-r-0 sm:border-r-0 lg:border-r border-dotted border-stone-500/40 lg:pr-6 xl:pr-8"
                  : "border-r-0 sm:border-r lg:border-r border-dotted border-stone-500/40 sm:pr-4 lg:pr-6 xl:pr-8";
              return (
                <div
                  key={step.title}
                  className={`flex flex-col items-center text-center sm:border-0 ${borderClass} rounded-2xl border border-stone-600/60 bg-stone-800/50 px-5 py-6 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0`}
                >
                  <h2 className="text-xl font-bold leading-snug text-white sm:text-xl lg:text-2xl">
                    {step.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-stone-400 sm:mt-4 sm:text-base">
                    {step.description}
                  </p>
                  <div className="relative mx-auto mt-5 w-full max-w-[160px] overflow-hidden rounded-xl sm:mx-0 sm:mt-6 sm:max-w-none lg:mt-8">
                    <div className="relative aspect-square w-full sm:aspect-[4/3]">
                      <Image
                        src={step.image}
                        alt={step.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 160px, (max-width: 1024px) 50vw, 25vw"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="fair-play"
          className="mt-16 grid grid-cols-1 gap-10 border-t border-stone-600/70 pt-14 sm:mt-12 sm:grid-cols-2 sm:items-center sm:gap-16 sm:border-0 sm:pt-12 md:mt-16 md:gap-24 md:pt-16 lg:gap-32 lg:pt-16 xl:gap-48"
        >
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
              What makes it fair?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-stone-300 sm:mt-4 sm:text-base md:text-lg">
              Players are matched by skill, stakes are set in advance, and the
              same rules apply to every game.
            </p>
            <Link
              href="/fair-play"
              className="mt-4 inline-block min-h-[44px] py-2.5 text-base font-medium text-white underline underline-offset-2 hover:no-underline sm:mt-4 sm:text-base md:text-lg touch-manipulation"
            >
              Learn more about our fair play here.
            </Link>
          </div>
          <div className="flex min-w-0 items-center justify-center rounded-2xl border border-stone-600/60 bg-stone-800/50 px-5 py-6 text-center sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:justify-center">
            <p className="text-lg font-light leading-snug text-white sm:text-xl md:text-2xl lg:text-3xl">
              Or, simply challenge a friend with your own rules!
            </p>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-stone-600/80 bg-stone-800/60 px-6 py-10 text-center sm:mt-16 sm:px-8 sm:py-12 md:mt-20 md:px-10 md:py-16 lg:mt-24">
          <h2 className="text-3xl font-bold text-white sm:text-2xl md:text-3xl lg:text-4xl">
            Skill over luck.
          </h2>
          <Link
            href="/register"
            className="mt-6 inline-block min-h-[48px] min-w-[10rem] rounded-xl px-8 py-3.5 text-base font-semibold text-white transition hover:opacity-90 sm:mt-8 sm:px-10 sm:py-4 sm:text-lg touch-manipulation"
            style={{ backgroundColor: BUTTON_BLUE }}
          >
            Start playing
          </Link>
        </section>

        <p className="mt-14 text-center sm:mt-10">
          <Link
            href="/"
            className="inline-block min-h-[44px] py-2.5 text-base font-medium text-stone-400 transition hover:text-white touch-manipulation sm:text-base"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
