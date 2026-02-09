"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const HEADER_BG = "#212121";
const BUTTON_BLUE = "#1e40af";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/games", label: "Partidas" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/reports", label: "Reportes" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  if (pathname === "/admin/login") return null;

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

  return (
    <nav
      className="sticky top-0 z-40 border-b border-stone-600/80 font-sans"
      style={{ backgroundColor: HEADER_BG }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-stone-700 focus:outline-none md:hidden"
            aria-label="Menú"
            aria-expanded={menuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div
            className={`absolute left-0 right-0 top-full mt-0 flex flex-col gap-0 border-b border-stone-600/80 py-2 md:static md:mt-0 md:flex md:flex-row md:items-center md:gap-4 md:border-0 md:py-0 ${
              menuOpen ? "flex" : "hidden"
            }`}
            style={{ backgroundColor: HEADER_BG }}
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-4 py-2.5 text-sm font-medium transition md:px-3 ${
                  isActive(href)
                    ? "bg-white/10 text-white"
                    : "text-stone-400 hover:bg-stone-700/50 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-stone-400 transition hover:bg-stone-700/50 hover:text-white"
          >
            Sitio
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
            className="rounded-md px-3 py-2 text-sm font-medium text-stone-300 transition hover:bg-stone-700 hover:text-white"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
