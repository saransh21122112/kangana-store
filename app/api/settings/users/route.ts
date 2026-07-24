import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { createUserSchema, updateUserSchema } from "@/lib/validations/settings";

/** Shape returned to the client — password hash is never sent back. */
function toSafeUser(user: { id: string; name: string; email: string; role: string; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * User management is entirely OWNER-only, including read access — unlike
 * the categories/thresholds GETs, there's no legitimate STAFF use case for
 * listing all users, so all four verbs use the same OWNER-only guard.
 */
export async function GET() {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ users: users.map(toSafeUser) });
}

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role,
    },
  });

  return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { userId, role, password } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent an OWNER from demoting themselves and losing access to this
  // page — the app has no re-promotion path once the last OWNER is gone.
  if (role !== undefined && role !== "OWNER" && target.id === guard.session.user.id) {
    return NextResponse.json(
      { error: "You can't change your own role away from OWNER" },
      { status: 400 }
    );
  }

  const data: { role?: "OWNER" | "STAFF" | "VIEWER"; password?: string } = {};
  if (role !== undefined) data.role = role;
  if (password !== undefined) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ user: toSafeUser(user) });
}

export async function DELETE(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  if (userId === guard.session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
