import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-700/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-stone-400">
          <Link href="/how-it-works" className="hover:text-white">How it works</Link>
          <span>|</span>
          <Link href="/fair-play" className="hover:text-white">Fair Play</Link>
          <span>|</span>
          <Link href="/ranking" className="hover:text-white">Ranking</Link>
          <span>|</span>
          <Link href="/support" className="hover:text-white">Support</Link>
          <span>|</span>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <span>|</span>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </div>
        <p className="text-sm text-stone-500">© 2026 FairMate</p>
      </div>
    </footer>
  );
}
