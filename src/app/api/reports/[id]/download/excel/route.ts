import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { getSignedUrl } from "@/lib/storage";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/reports/[id]/download/excel - Get signed URL for Excel download
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

    // Find user
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

    // Get report
    const report = await prisma.report.findFirst({
      where: {
        id,
        companyId: user.companyId,
        published: true,
      },
    });

    if (!report) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    if (!report.sourceFileUrl) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "No Excel file available" },
        { status: 404 }
      );
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrl = await getSignedUrl(report.sourceFileUrl, 3600);

    // Log download
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        reportId: report.id,
        action: "downloaded_excel",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json<ApiResponse<{ url: string }>>({
      success: true,
      data: { url: signedUrl },
    });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
