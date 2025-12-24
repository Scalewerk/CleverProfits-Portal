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

// GET /api/admin/companies/[id] - Get company details
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
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        reports: {
          orderBy: { periodEnd: "desc" },
          take: 12,
          select: {
            id: true,
            periodEnd: true,
            periodLabel: true,
            status: true,
            published: true,
            createdAt: true,
          },
        },
        metricConfig: true,
      },
    });

    if (!company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/companies/[id] - Update company
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
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company name is required" },
        { status: 400 }
      );
    }

    // Check company exists
    const existing = await prisma.company.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Check for duplicate name
    const duplicate = await prisma.company.findFirst({
      where: {
        name: name.trim(),
        id: { not: id },
      },
    });

    if (duplicate) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "A company with this name already exists" },
        { status: 400 }
      );
    }

    const company = await prisma.company.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        updatedAt: company.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to update company" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/companies/[id] - Delete company
export async function DELETE(request: Request, { params }: RouteParams) {
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
    });

    if (!company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Delete company (cascades to users, reports, config)
    await prisma.company.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to delete company" },
      { status: 500 }
    );
  }
}
