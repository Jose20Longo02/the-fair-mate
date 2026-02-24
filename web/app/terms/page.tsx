import Link from "next/link";
import type { Metadata } from "next";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Terms of Service — FairMate",
  description: "Read the Terms of Service for using FairMate and participating in USDC stake chess matches.",
  keywords: ["FairMate terms", "USDC chess terms", "skill-based chess platform policy"],
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service — FairMate",
    description: "Legal terms for using FairMate.",
    url: "/terms",
    images: [{ url: "/images/FairMate%20Logo.jpg?v=3", alt: "FairMate logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — FairMate",
    description: "Legal terms for using FairMate.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
};

export default function TermsPage() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-10 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-12 md:min-h-[calc(100vh-6rem)] md:px-10 md:py-14"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-3xl min-w-0">
        <Link
          href="/"
          className="text-sm font-medium text-stone-400 transition hover:text-white"
        >
          ← Back to home
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Last updated: January 31, 2026
        </p>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-stone-300">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white">1. About the service</h2>
            <p className="mt-3">
              FairMate is an online chess platform where users can play 1v1 matches with USDC stakes.
              The platform facilitates matchmaking, game hosting, and settlement of stakes between players.
              FairMate is not a gambling service — outcomes are determined entirely by player skill.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white">2. Eligibility</h2>
            <p className="mt-3">
              You must be at least 18 years old (or the legal age in your jurisdiction) to use FairMate.
              By creating an account, you confirm that you meet the age requirement and that using the
              service is legal in your jurisdiction. FairMate may restrict access from certain regions
              where staked skill-based gaming is not permitted.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white">3. Accounts</h2>
            <p className="mt-3">
              You are responsible for maintaining the security of your account credentials. Do not
              share your password. FairMate is not liable for any loss resulting from unauthorized
              access to your account. Each person may only create one account.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white">4. Deposits and balances</h2>
            <p className="mt-3">
              Deposits are made by sending USDC to your unique deposit address on a supported blockchain
              network. Funds are credited to your account balance after on-chain confirmation. FairMate
              is not responsible for funds sent to incorrect addresses or on unsupported networks.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white">5. Stakes and gameplay</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Both players agree to a stake amount before the match begins.</li>
              <li>The stake is deducted from each player&apos;s balance when the game starts.</li>
              <li>The winner receives their own stake plus 98% of the opponent&apos;s stake.</li>
              <li>A platform fee of 5% is applied to the losing player&apos;s stake.</li>
              <li>In the event of a draw, both stakes are refunded in full.</li>
              <li>Games are subject to time controls. Running out of time results in a loss.</li>
              <li>Disconnection for an extended period may result in a forfeit.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white">6. Withdrawals</h2>
            <p className="mt-3">
              You may withdraw your balance to your deposit wallet address at any time, subject to
              minimum withdrawal amounts and network availability. Withdrawals are processed on-chain
              and may take a few minutes depending on network conditions. Gas fees are covered by the
              platform where applicable.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white">7. Fair play and prohibited conduct</h2>
            <p className="mt-3">
              The following are strictly prohibited:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Using chess engines, bots, or any external assistance during a game.</li>
              <li>Intentionally losing games (sandbagging) to manipulate ratings.</li>
              <li>Creating multiple accounts.</li>
              <li>Colluding with other players.</li>
              <li>Exploiting bugs or vulnerabilities in the platform.</li>
            </ul>
            <p className="mt-3">
              Violations may result in account suspension, forfeiture of funds, and permanent ban.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white">8. Disputes</h2>
            <p className="mt-3">
              If you believe a game result is incorrect, you can file a report through the platform.
              Reports are reviewed by our team. Decisions made after review are final. FairMate
              reserves the right to reverse, adjust, or void game results if foul play is detected.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white">9. Limitation of liability</h2>
            <p className="mt-3">
              FairMate is provided &quot;as is&quot; without warranties of any kind. We are not liable for any
              losses arising from the use of the platform, including but not limited to: lost funds
              due to blockchain issues, service downtime, bugs, or unauthorized account access. Your
              use of FairMate is at your own risk.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white">10. Changes to these terms</h2>
            <p className="mt-3">
              We may update these terms from time to time. Continued use of the platform after changes
              constitutes acceptance of the updated terms. We will notify users of significant changes
              via the platform.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-white">11. Contact</h2>
            <p className="mt-3">
              If you have any questions about these terms, please contact us through the{" "}
              <Link href="/support" className="text-white underline underline-offset-2 hover:no-underline">
                support page
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
