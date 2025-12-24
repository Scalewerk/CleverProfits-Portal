import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import type { ApiResponse, ReportDetail, ReportSectionContent } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/reports/[id] - Get single report with sections
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find user and their company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // User must be linked to a company
    if (!user.companyId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "User not linked to a company" },
        { status: 403 }
      );
    }

    // Get report with sections
    const report = await prisma.report.findFirst({
      where: {
        id,
        companyId: user.companyId,
        published: true,
      },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    // Log access
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        reportId: report.id,
        action: "viewed",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    const reportDetail: ReportDetail = {
      id: report.id,
      companyId: report.companyId,
      periodEnd: report.periodEnd.toISOString(),
      periodLabel: report.periodLabel,
      status: report.status as "processing" | "complete" | "failed",
      sections: report.sections.map((section) => ({
        id: section.id,
        sectionKey: section.sectionKey,
        sectionName: section.sectionName,
        sortOrder: section.sortOrder,
        content: section.content as ReportSectionContent,
      })),
      files: {
        sourceFileUrl: report.sourceFileUrl || undefined,
        pdfFileUrl: report.pdfFileUrl || undefined,
      },
      createdAt: report.createdAt.toISOString(),
    };

    return NextResponse.json<ApiResponse<ReportDetail>>({
      success: true,
      data: reportDetail,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
