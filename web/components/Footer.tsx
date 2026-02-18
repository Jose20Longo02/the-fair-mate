import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto py-6">
      <p className="text-center text-sm text-stone-500">
        © 2026 FairMate{" "}
        <span className="mx-1">|</span>{" "}
        <Link href="/terms" className="hover:text-stone-400">Terms</Link>{" "}
        <span className="mx-1">|</span>{" "}
        <Link href="/privacy" className="hover:text-stone-400">Privacy</Link>
      </p>
    </footer>
  );
}
