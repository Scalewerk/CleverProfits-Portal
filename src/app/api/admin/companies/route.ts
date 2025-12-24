import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import type { ApiResponse } from "@/types";

// Helper to check if user is admin
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

// GET /api/admin/companies - List all companies
export async function GET() {
  try {
    const result = await requireAdmin();
    if ("error" in result) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            users: true,
            reports: true,
          },
        },
        metricConfig: {
          select: {
            preset: true,
          },
        },
      },
    });

    const data = companies.map((company) => ({
      id: company.id,
      name: company.name,
      userCount: company._count.users,
      reportCount: company._count.reports,
      preset: company.metricConfig?.preset || "standard",
      createdAt: company.createdAt.toISOString(),
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

// POST /api/admin/companies - Create new company
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ("error" in result) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.company.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "A company with this name already exists" },
        { status: 400 }
      );
    }

    // Create company with default metric config
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        metricConfig: {
          create: {
            // Default to standard preset
            preset: "standard",
            includeExecutiveSnapshot: true,
            includeRevenuePerformance: true,
            includeCogsGrossMargin: true,
            includeOperatingExpenses: true,
            includeProfitabilityBridges: false,
            includeVariancePerformance: false,
            includeCashFlowLiquidity: false,
            includeBalanceSheetHealth: false,
            includeRiskControls: false,
          },
        },
      },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          id: company.id,
          name: company.name,
          createdAt: company.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to create company" },
      { status: 500 }
    );
  }
}
