import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUsernameFormat } from "@/lib/username";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const raw = typeof name === "string" ? name : "";
  const format = validateUsernameFormat(raw);

  if (!format.ok) {
    return NextResponse.json({ available: false, reason: format.reason });
  }

  const users = await prisma.user.findMany({
    where: { name: { not: null } },
    select: { name: true },
  });
  const taken = users.some((u) => u.name!.toLowerCase() === format.normalized.toLowerCase());

  return NextResponse.json({ available: !taken });
}
