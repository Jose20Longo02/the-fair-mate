import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_BG = "#252525";
const BUTTON_BLUE = "#1e40af";

const STATUS_LABELS: Record<string, { label: string; description: string; className: string }> = {
  pending: {
    label: "Under review",
    description: "We've received your report and will look into it.",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  },
  in_review: {
    label: "Being reviewed",
    description: "We're currently reviewing your report.",
    className: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  },
  resolved: {
    label: "Resolved",
    description: "We've completed our review and taken action.",
    className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  },
  dismissed: {
    label: "Closed",
    description: "We've reviewed and closed this report.",
    className: "bg-stone-600/60 text-stone-400 border border-stone-500/60",
  },
};

export default async function MisReportesPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/cuenta/reportes");

  const reports = await prisma.gameReport.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      game: {
        select: {
          id: true,
          status: true,
          winner: true,
          stake: true,
          createdAt: true,
          white: { select: { id: true, name: true, email: true } },
          black: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              My reports
            </h1>
            <p className="mt-4 text-base text-stone-400 sm:mt-5 sm:text-base">
              Track your result reports and see our response. We take every report seriously to keep the platform fair.
            </p>
          </div>
          <Link href="/cuenta" className="shrink-0 py-2 text-base font-medium text-stone-400 transition hover:text-white touch-manipulation">
            ← Back to My account
          </Link>
        </div>

        <div className="mt-5 rounded-xl border border-stone-600/80 bg-stone-800/90 p-4 text-stone-400 sm:mt-8 sm:p-5">
          <p className="text-base font-medium text-stone-300">What the statuses mean:</p>
          <ul className="mt-2 list-disc list-inside space-y-1.5 text-sm sm:text-base">
            <li><strong className="text-stone-200">Under review</strong> — We received your report and will look into it.</li>
            <li><strong className="text-stone-200">Being reviewed</strong> — We are currently reviewing your report.</li>
            <li><strong className="text-stone-200">Resolved</strong> — We completed our review and took action (e.g. agreed with you, refund, correction).</li>
            <li><strong className="text-stone-200">Closed</strong> — We reviewed and closed without a change (e.g. result was correct). Our response below explains why.</li>
          </ul>
        </div>

        {reports.length === 0 ? (
          <div className="mt-5 rounded-xl border border-stone-600/80 bg-stone-800/90 p-6 text-center sm:mt-8 sm:p-8">
            <p className="text-lg font-medium text-stone-300 sm:text-xl">You haven&apos;t submitted any reports yet.</p>
            <p className="mt-2 text-base text-stone-500 sm:text-lg">
              You can request a review or report an issue at the end of any finished game, from the result screen.
            </p>
            <Link
              href="/cuenta"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 touch-manipulation"
              style={{ backgroundColor: BUTTON_BLUE }}
            >
              Go to My account
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
            {reports.map((report) => {
              const statusInfo = STATUS_LABELS[report.status] ?? {
                label: report.status,
                description: "",
                className: "bg-stone-600/60 text-stone-400 border border-stone-500/60",
              };
              const game = report.game;
              const opponent =
                game.white.id === session.userId ? game.black : game.white;
              const opponentName = opponent.name || opponent.email;

              return (
                <article
                  key={report.id}
                  className="min-w-0 rounded-xl border border-stone-600/80 bg-stone-800/90 p-5 text-white shadow-xl sm:p-6"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/partida/${game.id}`}
                        className="text-lg font-medium text-blue-300 hover:text-blue-200 sm:text-xl"
                      >
                        Game {game.id.slice(0, 8)}…
                      </Link>
                      <p className="mt-0.5 truncate text-base text-stone-500 sm:text-lg">
                        vs {opponentName} · {formatCents(game.stake)} ·{" "}
                        {new Date(game.createdAt).toLocaleDateString("en")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm font-medium sm:px-3 sm:py-1 ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium uppercase tracking-wider text-stone-500">Your message</p>
                    <p className="mt-1 break-words text-base text-stone-300 whitespace-pre-wrap sm:text-lg">
                      {report.message}
                    </p>
                    <p className="mt-2 text-sm text-stone-500 sm:text-base">
                      Reported on {formatDate(report.createdAt)}
                    </p>
                  </div>

                  {statusInfo.description && (
                    <p className="mt-3 text-base text-stone-500 sm:text-lg">
                      {statusInfo.description}
                    </p>
                  )}

                  {report.adminNotes && (
                    <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-4 sm:p-5">
                      <p className="text-sm font-medium uppercase tracking-wider text-emerald-400">
                        Our response
                      </p>
                      <p className="mt-1 break-words text-base text-emerald-200/90 whitespace-pre-wrap sm:text-lg">
                        {report.adminNotes}
                      </p>
                      {report.updatedAt !== report.createdAt && (
                        <p className="mt-2 text-sm text-emerald-500/80 sm:text-base">
                          Updated {formatDate(report.updatedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {report.status === "pending" && !report.adminNotes && (
                    <p className="mt-3 text-sm text-stone-500 sm:text-base">
                      We&apos;ll review your report and add a response here. You can check back anytime.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
