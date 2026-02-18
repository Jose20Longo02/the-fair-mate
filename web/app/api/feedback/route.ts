import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { apiError, unauthorized } from "@/lib/api-response";

const LIMIT = 6;
const WINDOW_MS = 10 * 60_000; // 6 submissions per 10 minutes

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const clientKey = getClientKey(request);
  const rate = await checkRateLimit(`feedback:${session.userId}:${clientKey}`, LIMIT, WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 10) {
    return apiError("Feedback is too short (minimum 10 characters).", 400);
  }
  if (message.length > 2000) {
    return apiError("Feedback is too long (maximum 2000 characters).", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) return apiError("User not found", 404);

  const feedback = await prisma.feedback.create({
    data: {
      userId: session.userId,
      emailSnapshot: user.email,
      message,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
