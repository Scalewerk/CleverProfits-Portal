import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user || user.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }

  return { user };
}

// PATCH /api/admin/reports/[id]/publish - Publish or unpublish a report
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const result = await requireAdmin();
    if ("error" in result) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { published } = body;

    if (typeof published !== "boolean") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "published must be a boolean" },
        { status: 400 }
      );
    }

    // Get report
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    // Only complete reports can be published
    if (published && report.status !== "complete") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Only complete reports can be published" },
        { status: 400 }
      );
    }

    // Update report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: { published },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedReport.id,
        published: updatedReport.published,
      },
    });
  } catch (error) {
    console.error("Error updating report publish status:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to update report" },
      { status: 500 }
    );
  }
}
