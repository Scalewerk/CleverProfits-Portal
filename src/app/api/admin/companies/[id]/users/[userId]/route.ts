import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

// PATCH /api/admin/companies/[id]/users/[userId]
// Update user role
export async function PATCH(request: Request, context: RouteContext) {
  const { userId: clerkUserId } = await auth();
  const { id: companyId, userId: targetUserId } = await context.params;

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify target user exists and belongs to company
  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      companyId,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found in this company" }, { status: 404 });
  }

  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'viewer'" }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return NextResponse.json(updatedUser);
}

// DELETE /api/admin/companies/[id]/users/[userId]
// Remove user from company (unlink, don't delete)
export async function DELETE(request: Request, context: RouteContext) {
  const { userId: clerkUserId } = await auth();
  const { id: companyId, userId: targetUserId } = await context.params;

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify target user exists and belongs to company
  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      companyId,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found in this company" }, { status: 404 });
  }

  // Prevent removing yourself
  if (targetUser.clerkUserId === clerkUserId) {
    return NextResponse.json({ error: "Cannot remove yourself from the company" }, { status: 400 });
  }

  // Unlink user from company (set companyId to null)
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      companyId: null,
      role: "viewer", // Reset to viewer when unlinked
    },
  });

  return NextResponse.json({ success: true });
}
