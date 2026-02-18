import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import ScrollToTop from "./ScrollToTop";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Fair Play — FairMate",
  description: "Skill-based matchmaking, fixed stakes, anti-abuse monitoring, consistent result handling.",
  keywords: [
    "fair play chess for money",
    "anti-cheat chess platform",
    "FairMate fair play",
  ],
  alternates: {
    canonical: "/fair-play",
  },
  openGraph: {
    title: "Fair Play — FairMate",
    description: "See how FairMate protects skill-based competition and enforces fair play in USDC chess.",
    url: "/fair-play",
    images: [{ url: "/images/FairMate%20Logo.jpg?v=3", alt: "FairMate logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fair Play — FairMate",
    description: "See how FairMate protects skill-based competition and enforces fair play in USDC chess.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
};

const FAIR_PLAY_ITEMS = [
  {
    title: "Skill-based matchmaking",
    description:
      "Players are paired based on rating to avoid large skill gaps and one-sided matches.",
  },
  {
    title: "Fixed stakes in public matches",
    description:
      "Public matches use fixed stakes to prevent pressure, manipulation, or last-minute changes.",
  },
  {
    title: "Anti-abuse monitoring",
    description:
      "We monitor gameplay patterns to detect engine use, sandbagging, or coordinated abuse.",
  },
  {
    title: "Consistent result handling",
    description:
      "Results are processed automatically, and exceptional cases are reviewed manually when needed.",
  },
] as const;

const FOOTER_TEXT =
  "Private challenges are clearly marked and handled separately from public competition.";

export default function FairPlayPage() {
  return (
    <>
      <ScrollToTop />
      <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 pt-16 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-6 sm:pt-16 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-10 md:pt-4 lg:px-12 lg:pt-6 lg:pb-[max(2rem,env(safe-area-inset-bottom))]"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-6xl min-w-0">
        {/* Hero: mobile = text first, then image; desktop = text left, image right */}
        <section className="grid grid-cols-1 gap-8 pt-0 sm:gap-10 sm:pt-2 md:grid-cols-2 md:items-center md:gap-12 md:pt-4 lg:gap-16 lg:pt-6 xl:gap-20">
          <div className="min-w-0 order-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
              What Fair Play means here
            </h1>
            <p className="mt-6 text-base leading-relaxed text-stone-300 sm:mt-8 sm:text-lg md:mt-10 md:text-xl lg:mt-12">
              Fair play means every match is decided by skill, under the same rules, without manipulation or abuse.
            </p>
            <p className="mt-4 text-base leading-relaxed text-stone-300 sm:mt-4 sm:text-lg md:mt-4 md:text-xl lg:mt-5">
              Our role is not to influence outcomes, but to enforce consistency and protect competitive integrity.
            </p>
          </div>
          <div className="relative order-2 aspect-[4/3] min-w-0 overflow-hidden rounded-lg sm:aspect-[5/4] sm:rounded-xl md:aspect-square">
            <Image
              src="/images/Fair Play.png"
              alt="Fair Play"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 90vw, 50vw"
              priority
              unoptimized
            />
          </div>
        </section>

        {/* How we keep matches fair — 4 columns */}
        <section className="mt-10 sm:mt-12 lg:mt-8">
          <h2 className="text-center text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
            How we keep matches fair?
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:mt-16 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:mt-24 lg:grid-cols-4 lg:gap-0 lg:gap-y-0">
            {FAIR_PLAY_ITEMS.map((item, index) => (
              <div
                key={item.title}
                className={`flex flex-col text-center lg:px-4 xl:px-6 ${
                  index < FAIR_PLAY_ITEMS.length - 1
                    ? "lg:border-r lg:border-dashed lg:border-stone-500/40"
                    : ""
                }`}
              >
                <h3 className="text-lg font-bold leading-snug text-white sm:text-xl md:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-stone-400 sm:mt-4 sm:text-base md:mt-6 md:text-base">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-14 px-2 text-center text-base leading-relaxed text-stone-400 sm:mt-20 sm:px-0 lg:mt-24 lg:text-lg">
            {FOOTER_TEXT}
          </p>
          <p className="mt-5 text-center text-sm text-stone-400">
            Learn the full match flow on{" "}
            <Link href="/how-it-works" className="text-white underline underline-offset-2 hover:no-underline">
              How it works
            </Link>{" "}
            or contact{" "}
            <Link href="/support" className="text-white underline underline-offset-2 hover:no-underline">
              Support
            </Link>.
          </p>
        </section>
      </div>
    </main>
    </>
  );
}
