import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedAvatar } from "@/lib/avatars";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { avatar, name } = body as { avatar?: string; name?: string };

    const data: { avatar?: string; name?: string | null } = {};

    if (avatar !== undefined) {
      if (!isAllowedAvatar(avatar)) {
        return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
      }
      data.avatar = avatar;
    }

    if (name !== undefined) {
      data.name = typeof name === "string" ? name.trim() || null : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
