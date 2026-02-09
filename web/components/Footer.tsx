import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50 mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-stone-500">
            © {new Date().getFullYear()} Stakes Chess. MVP — Validation purposes only.
          </p>
          <div className="flex gap-6 text-sm text-stone-500">
            <Link href="/como-funciona" className="hover:text-stone-700">
              How it works
            </Link>
            <Link href="/ranking" className="hover:text-stone-700">
              Ranking
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
