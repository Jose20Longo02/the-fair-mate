import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import NotificationsList from "./NotificationsList";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Notifications — FairMate",
  description: "Challenges, stake proposals and game status.",
};

export default async function NotificacionesPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/cuenta/notificaciones");

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Notifications
            </h1>
            <p className="mt-4 text-sm text-stone-400 sm:mt-5 sm:text-base">
              Challenges, stake proposals and game status.
            </p>
          </div>
          <Link href="/cuenta" className="shrink-0 py-2 text-sm font-medium text-stone-400 transition hover:text-white touch-manipulation">
            ← Back to My account
          </Link>
        </div>

        <NotificationsList />
      </div>
    </main>
  );
}
