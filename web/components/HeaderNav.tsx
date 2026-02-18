"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { avatarUrl } from "@/lib/avatars";
import DepositButton from "./DepositButton";
import NotificationBell from "./NotificationBell";
import LogoutButton from "./LogoutButton";

const HEADER_BG = "#212121";
const BUTTON_BLUE = "#1e40af";
const BALANCE_POLL_MS = 5000;

type Session = { userId: string; email: string } | null;

export default function HeaderNav({
  session,
  balanceCents,
  avatar,
}: {
  session: Session;
  balanceCents: number | null;
  avatar: string | null;
}) {
  const formatBalance = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [liveBalanceCents, setLiveBalanceCents] = useState<number | null>(balanceCents);
  const [hasPendingDeposit, setHasPendingDeposit] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setLiveBalanceCents(balanceCents);
  }, [balanceCents]);

  const refreshBalance = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/account/balance", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { balance?: number; hasPendingDeposit?: boolean };
      if (typeof data.balance === "number") {
        setLiveBalanceCents(data.balance);
      }
      setHasPendingDeposit(Boolean(data.hasPendingDeposit));
    } catch {
      // ignore transient UI refresh failures
    }
  }, [session]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (hamburgerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [hamburgerOpen]);

  // Keep header balance fresh without manual reload:
  // - immediate refresh on route changes (e.g. entering /game/*)
  // - short polling while user is logged in
  useEffect(() => {
    if (!session) return;
    void refreshBalance();
    const id = setInterval(() => {
      void refreshBalance();
    }, BALANCE_POLL_MS);
    return () => clearInterval(id);
  }, [session, pathname, refreshBalance]);

  const closeHamburger = () => setHamburgerOpen(false);

  const navLinks = (
    <>
      {!session && (
        <>
          <Link
            href="/how-it-works"
            className="block py-3 text-base font-medium text-white transition hover:opacity-90"
            onClick={closeHamburger}
          >
            How it works
          </Link>
          <Link
            href="/fair-play"
            className="block py-3 text-base font-medium text-white transition hover:opacity-90"
            onClick={closeHamburger}
          >
            Fair Play
          </Link>
        </>
      )}
      <Link
        href="/ranking"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        Ranking
      </Link>
      <Link
        href="/support"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        Support
      </Link>
      {session && (
        <Link
          href="/feedback"
          className="inline-flex min-h-[40px] w-fit items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          onClick={closeHamburger}
        >
          Give us your feedback
        </Link>
      )}
    </>
  );

  const accountLinks = session ? (
    <>
      <Link
        href="/account"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        My account
      </Link>
      <Link
        href="/account"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        Withdraw
      </Link>
      <Link
        href="/account/notifications"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        Notifications
      </Link>
      <Link
        href="/account/reports"
        className="block py-3 text-base font-medium text-white transition hover:opacity-90"
        onClick={closeHamburger}
      >
        My reports
      </Link>
      <div className="border-t border-stone-600 pt-6">
        <LogoutButton
          className="text-base font-medium text-stone-300 hover:text-white"
          label="Log out"
          onClick={closeHamburger}
        />
      </div>
    </>
  ) : null;

  return (
    <>
<nav
      className="flex w-full items-center justify-between gap-4 font-sans"
      style={{ backgroundColor: HEADER_BG }}
    >
        {/* Left: logo on mobile; logo + links on desktop */}
        <div className="flex items-center gap-14 sm:gap-16 md:gap-20">
          <Link
            href="/"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md transition hover:opacity-90 sm:h-10 sm:w-10"
            aria-label="Home"
          >
            <Image
              src="/images/FairMate Logo.jpg"
              alt="FairMate"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </Link>
          <div className="hidden md:flex md:items-center md:gap-14 md:gap-16 lg:gap-20">
            {!session && (
              <>
                <Link href="/how-it-works" className="text-sm font-medium text-white transition hover:opacity-90">
                  How it works
                </Link>
                <Link href="/fair-play" className="text-sm font-medium text-white transition hover:opacity-90">
                  Fair Play
                </Link>
              </>
            )}
            <Link href="/ranking" className="text-sm font-medium text-white transition hover:opacity-90">
              Ranking
            </Link>
            <Link href="/support" className="text-sm font-medium text-white transition hover:opacity-90">
              Support
            </Link>
            {session && (
              <Link
                href="/feedback"
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Give us your feedback
              </Link>
            )}
          </div>
        </div>

        {/* Right: on mobile only bell, balance, button; on desktop full right */}
        <div className="flex items-center gap-7 sm:gap-4 md:gap-5 lg:gap-6 xl:gap-7">
          {session ? (
            <>
              <NotificationBell userId={session.userId} />
              {liveBalanceCents !== null && (
                <div className="flex flex-col items-center text-center">
                  <span
                    className="font-sans text-xs font-normal tracking-wider"
                    style={{ color: "#3794ff" }}
                  >
                    Balance
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-white sm:text-base">
                    {formatBalance(liveBalanceCents)}
                  </span>
                  {hasPendingDeposit && (
                    <span className="text-xs font-medium text-amber-300">
                      Acreditando...
                    </span>
                  )}
                </div>
              )}
              <DepositButton variant="header" />

              <span className="h-8 w-px shrink-0 bg-stone-600 md:hidden" aria-hidden />

              {/* Hamburger - mobile only, far right */}
              <button
                type="button"
                onClick={() => setHamburgerOpen((o) => !o)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white transition hover:bg-stone-700 focus:outline-none md:hidden"
                aria-expanded={hamburgerOpen}
                aria-label="Open menu"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Separator + Avatar dropdown - desktop only */}
              <span className="hidden h-8 w-px shrink-0 bg-stone-600 md:inline" aria-hidden />
              <div className="relative hidden items-center gap-1 md:flex" ref={avatarMenuRef}>
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-full focus:outline-none"
                  aria-expanded={avatarMenuOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-600 bg-stone-700 transition hover:opacity-90 sm:h-10 sm:w-10">
                    {avatar ? (
                      <Image
                        src={avatarUrl(avatar)}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-stone-400">
                        {session.email.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform sm:h-5 sm:w-5 ${avatarMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {avatarMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 min-w-[10rem] rounded-lg border border-stone-600 bg-stone-800 py-1 shadow-xl"
                    role="menu"
                  >
                    <Link
                      href="/account"
                      className="block px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      My account
                    </Link>
                    <Link
                      href="/account"
                      className="block px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      Withdraw
                    </Link>
                    <Link
                      href="/account/notifications"
                      className="block px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      Notifications
                    </Link>
                    <Link
                      href="/account/reports"
                      className="block px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      My reports
                    </Link>
                    <div className="border-t border-stone-600 px-2 py-1.5" role="none">
                      <LogoutButton
                        className="w-full rounded px-2 py-1.5 text-left text-sm font-medium text-stone-300 hover:bg-stone-700 hover:text-white"
                        label="Log out"
                        onClick={() => setAvatarMenuOpen(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-stone-400 transition hover:text-white md:text-white md:hover:opacity-90"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:min-h-[44px] sm:px-5 sm:py-2.5"
                style={{ backgroundColor: BUTTON_BLUE }}
              >
                Sign up
              </Link>
              <span className="h-8 w-px shrink-0 bg-stone-600 md:hidden" aria-hidden />
              <button
                type="button"
                onClick={() => setHamburgerOpen((o) => !o)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white transition hover:bg-stone-700 focus:outline-none md:hidden"
                aria-expanded={hamburgerOpen}
                aria-label="Open menu"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hamburger overlay - mobile only */}
      {hamburgerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          aria-hidden
          onClick={closeHamburger}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-[min(100vw,20rem)] font-sans shadow-xl transition-transform duration-200 ease-out md:hidden ${
          hamburgerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: HEADER_BG }}
      >
        <div className="flex flex-col px-5 pt-6 pb-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md transition hover:opacity-90"
              aria-label="Home"
              onClick={closeHamburger}
            >
              <Image
                src="/images/FairMate Logo.jpg"
                alt="FairMate"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={closeHamburger}
              className="flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-stone-700 focus:outline-none"
              aria-label="Close menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="mt-8 flex flex-col gap-5">
            {navLinks}
            {accountLinks}
          </nav>
        </div>
      </div>
    </>
  );
}
