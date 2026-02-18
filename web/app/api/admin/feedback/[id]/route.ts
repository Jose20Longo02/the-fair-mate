import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

const ALLOWED_STATUSES = ["new", "in_review", "planned", "closed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; adminNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status)
      ? body.status
      : undefined;
  const adminNotes =
    typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;

  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
    },
  });

  return NextResponse.json({ feedback: updated });
}
