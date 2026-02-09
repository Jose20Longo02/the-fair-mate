import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChessBoard from "@/components/ChessBoard";

const PAGE_BG = "#252525";

export default async function PartidaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?from=/partida");

  const { id } = await params;

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-5 sm:py-5 sm:pb-[max(2rem,env(safe-area-inset-bottom))] md:min-h-[calc(100vh-6rem)] md:px-6 md:py-6"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <ChessBoard gameId={id} userId={session.userId} />
      </div>
    </main>
  );
}
