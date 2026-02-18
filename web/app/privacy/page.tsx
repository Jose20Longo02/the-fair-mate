import Link from "next/link";
import type { Metadata } from "next";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Privacy Policy — FairMate",
  description: "Read FairMate's Privacy Policy, including what data is collected and how it is used.",
  keywords: ["FairMate privacy", "USDC chess privacy", "FairMate data policy"],
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy — FairMate",
    description: "Privacy policy for FairMate users.",
    url: "/privacy",
    images: [{ url: "/images/FairMate%20Logo.jpg?v=3", alt: "FairMate logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — FairMate",
    description: "Privacy policy for FairMate users.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Last updated: January 31, 2026
        </p>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-stone-300">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white">1. Information we collect</h2>
            <p className="mt-3">When you use FairMate, we collect the following information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-white">Account information:</strong> email address, display name, and password (stored as a secure hash).</li>
              <li><strong className="text-white">Game data:</strong> moves, results, ELO ratings, timestamps, and stakes for each game you play.</li>
              <li><strong className="text-white">Financial data:</strong> deposit and withdrawal history, balance, ledger entries, and blockchain wallet addresses associated with your account.</li>
              <li><strong className="text-white">Support data:</strong> messages you send through the support form, including your name and email.</li>
              <li><strong className="text-white">Technical data:</strong> IP address, browser type, and device information collected automatically for security and rate limiting.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white">2. How we use your information</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To operate and maintain your account.</li>
              <li>To facilitate matchmaking, gameplay, and settlement of stakes.</li>
              <li>To process deposits and withdrawals.</li>
              <li>To detect and prevent fraud, cheating, and abuse.</li>
              <li>To respond to support requests.</li>
              <li>To improve the platform and fix bugs.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white">3. Information sharing</h2>
            <p className="mt-3">
              We do not sell your personal information. We may share data in the following limited cases:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-white">Other players:</strong> your display name, avatar, and ELO rating are visible to opponents and on the public leaderboard.</li>
              <li><strong className="text-white">Blockchain:</strong> withdrawal transactions are recorded on-chain and are publicly visible by nature of the blockchain.</li>
              <li><strong className="text-white">Legal requirements:</strong> we may disclose information if required by law or to protect the rights and safety of our users.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white">4. Data storage and security</h2>
            <p className="mt-3">
              Your data is stored on secure servers. Passwords are hashed and never stored in plain text.
              Session tokens are signed with a secret key. We take reasonable measures to protect your
              data, but no system is 100% secure. You are responsible for keeping your credentials safe.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white">5. Cookies</h2>
            <p className="mt-3">
              FairMate uses essential cookies to maintain your session (login state). We do not use
              tracking cookies, advertising cookies, or third-party analytics cookies.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white">6. Your rights</h2>
            <p className="mt-3">You have the right to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-white">Access:</strong> download a copy of the data we hold about you. In <strong className="text-white">My account</strong>, use <strong className="text-white">Export my data</strong> to receive a JSON file with your profile, games, transactions, reports, and notifications.</li>
              <li><strong className="text-white">Correction:</strong> update your account information (name, avatar) at any time from My account.</li>
              <li><strong className="text-white">Deletion:</strong> delete your account and associated personal data. In <strong className="text-white">My account</strong>, use <strong className="text-white">Delete my account</strong>. We anonymize your account (email, name, avatar, password) so you can no longer sign in; game and ledger records may be kept in anonymized form for legal, financial, or integrity purposes. Withdraw any balance before deleting.</li>
            </ul>
            <p className="mt-3">
              You can also contact us via the{" "}
              <Link href="/support" className="text-white underline underline-offset-2 hover:no-underline">support page</Link>
              {" "}to exercise these rights or for any question.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white">7. Data retention</h2>
            <p className="mt-3">
              We retain your data for as long as your account is active. If you request account deletion,
              we will remove or anonymize your personal data within 30 days, except where retention is
              required by law or for legitimate business purposes (e.g., financial records, dispute resolution).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white">8. Changes to this policy</h2>
            <p className="mt-3">
              We may update this privacy policy from time to time. We will notify users of significant
              changes via the platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white">9. Contact</h2>
            <p className="mt-3">
              If you have questions about this policy or want to exercise your data rights, please
              contact us through the{" "}
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
