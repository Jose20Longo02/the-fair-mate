import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIN_USERNAME_LENGTH = 2;
const MAX_USERNAME_LENGTH = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const trimmed = typeof name === "string" ? name.trim() : "";

  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return NextResponse.json({
      available: false,
      reason: trimmed.length > 0 ? `At least ${MIN_USERNAME_LENGTH} characters` : "Enter a username",
    });
  }

  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return NextResponse.json({
      available: false,
      reason: `Maximum ${MAX_USERNAME_LENGTH} characters`,
    });
  }

  const users = await prisma.user.findMany({
    where: { name: { not: null } },
    select: { name: true },
  });
  const taken = users.some((u) => u.name!.toLowerCase() === trimmed.toLowerCase());

  return NextResponse.json({ available: !taken });
}
