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

// GET /api/admin/companies/[id]/config - Get metric configuration
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const result = await requireAdmin();
    if ("error" in result) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: { metricConfig: true },
    });

    if (!company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Return config or defaults
    const config = company.metricConfig || {
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
      enabledMetrics: {},
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.name,
        config,
      },
    });
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/companies/[id]/config - Update metric configuration
export async function PUT(request: Request, { params }: RouteParams) {
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

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Extract config fields from body
    const {
      preset,
      includeExecutiveSnapshot,
      includeRevenuePerformance,
      includeCogsGrossMargin,
      includeOperatingExpenses,
      includeProfitabilityBridges,
      includeVariancePerformance,
      includeCashFlowLiquidity,
      includeBalanceSheetHealth,
      includeRiskControls,
      enabledMetrics,
    } = body;

    // Upsert the config
    const config = await prisma.clientMetricConfig.upsert({
      where: { companyId: id },
      create: {
        companyId: id,
        preset: preset || "custom",
        includeExecutiveSnapshot: includeExecutiveSnapshot ?? true,
        includeRevenuePerformance: includeRevenuePerformance ?? true,
        includeCogsGrossMargin: includeCogsGrossMargin ?? true,
        includeOperatingExpenses: includeOperatingExpenses ?? true,
        includeProfitabilityBridges: includeProfitabilityBridges ?? false,
        includeVariancePerformance: includeVariancePerformance ?? false,
        includeCashFlowLiquidity: includeCashFlowLiquidity ?? false,
        includeBalanceSheetHealth: includeBalanceSheetHealth ?? false,
        includeRiskControls: includeRiskControls ?? false,
        enabledMetrics: enabledMetrics || {},
      },
      update: {
        preset: preset || "custom",
        includeExecutiveSnapshot: includeExecutiveSnapshot ?? true,
        includeRevenuePerformance: includeRevenuePerformance ?? true,
        includeCogsGrossMargin: includeCogsGrossMargin ?? true,
        includeOperatingExpenses: includeOperatingExpenses ?? true,
        includeProfitabilityBridges: includeProfitabilityBridges ?? false,
        includeVariancePerformance: includeVariancePerformance ?? false,
        includeCashFlowLiquidity: includeCashFlowLiquidity ?? false,
        includeBalanceSheetHealth: includeBalanceSheetHealth ?? false,
        includeRiskControls: includeRiskControls ?? false,
        enabledMetrics: enabledMetrics || {},
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
