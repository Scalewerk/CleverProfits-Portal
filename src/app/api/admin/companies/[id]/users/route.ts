import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/companies/[id]/users
// Returns all users for a company
export async function GET(request: Request, context: RouteContext) {
  const { userId } = await auth();
  const { id: companyId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { email: "asc" },
  });

  return NextResponse.json(users);
}

// POST /api/admin/companies/[id]/users
// Link a user to this company
export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  const { id: companyId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const body = await request.json();
  const { userId: targetUserId, role = "viewer" } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update user to link to company
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      companyId,
      role: role === "admin" ? "admin" : "viewer",
    },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
    },
  });

  return NextResponse.json(updatedUser);
}
