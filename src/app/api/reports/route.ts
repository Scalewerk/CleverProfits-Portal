import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import type { ApiResponse, ReportListItem } from "@/types";

// GET /api/reports - List published reports for user's company
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find user and their company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "User not found in database" },
        { status: 404 }
      );
    }

    // User must be linked to a company
    if (!user.companyId) {
      return NextResponse.json<ApiResponse<ReportListItem[]>>({
        success: true,
        data: [], // Return empty list if user has no company
      });
    }

    // Get published reports for user's company
    const reports = await prisma.report.findMany({
      where: {
        companyId: user.companyId,
        published: true,
        status: "complete",
      },
      orderBy: { periodEnd: "desc" },
      take: 24, // Last 2 years
    });

    const reportList: ReportListItem[] = reports.map((report) => ({
      id: report.id,
      periodEnd: report.periodEnd.toISOString(),
      periodLabel: report.periodLabel,
      status: report.status as "processing" | "complete" | "failed",
      createdAt: report.createdAt.toISOString(),
      hasSourceFile: !!report.sourceFileUrl,
      hasPdf: !!report.pdfFileUrl,
    }));

    return NextResponse.json<ApiResponse<ReportListItem[]>>({
      success: true,
      data: reportList,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
