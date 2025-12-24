import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/admin/users/unlinked
// Returns users who have signed up but aren't linked to any company
export async function GET() {
  const { userId } = await auth();

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

  // Get unlinked users (companyId is null)
  const unlinkedUsers = await prisma.user.findMany({
    where: {
      companyId: { equals: null },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(unlinkedUsers);
}
