import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HeaderNav from "./HeaderNav";

const HEADER_BG = "#212121";

export default async function Header() {
  const session = await getSession();
  const serializableSession = session ? { userId: session.userId, email: session.email } : null;

  let balanceCents: number | null = null;
  let avatar: string | null = null;
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balance: true, avatar: true },
    });
    balanceCents = user?.balance ?? null;
    avatar = user?.avatar ?? null;
  }

  return (
    <header
      className="flex min-h-24 w-full shrink-0 items-center font-sans px-8 pt-[env(safe-area-inset-top)] sm:px-6 md:px-10 lg:px-12"
      style={{ backgroundColor: HEADER_BG }}
    >
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <HeaderNav session={serializableSession} balanceCents={balanceCents} avatar={avatar} />
      </div>
    </header>
  );
}
