import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { extractCoreSheets, formatForClaude } from "@/lib/excel";
import { generateFinancialReport } from "@/lib/claude";
import type { ApiResponse } from "@/types";

// Route segment config for large file uploads
export const maxDuration = 300; // 5 minutes for report generation
export const dynamic = 'force-dynamic';

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

// POST /api/admin/reports/generate - Generate a new report
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ("error" in result) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const companyId = formData.get("companyId") as string;
    const periodEnd = formData.get("periodEnd") as string;
    const file = formData.get("file") as File;

    // Validate inputs
    if (!companyId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company ID is required" },
        { status: 400 }
      );
    }

    if (!periodEnd) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Period end date is required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Excel file is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "File must be an Excel file (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    // Get company with metric config
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { metricConfig: true },
    });

    if (!company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Parse period end date
    const periodEndDate = new Date(periodEnd);
    if (isNaN(periodEndDate.getTime())) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid period end date" },
        { status: 400 }
      );
    }

    // Create report record (processing status)
    const report = await prisma.report.create({
      data: {
        companyId,
        periodEnd: periodEndDate,
        periodLabel: formatPeriodLabel(periodEndDate),
        status: "processing",
      },
    });

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // Try to upload file to storage (optional - continue if it fails)
      let storagePath: string | null = null;
      try {
        storagePath = `reports/${companyId}/${report.id}/source.xlsx`;
        await uploadFile(storagePath, fileBuffer, file.type);
        await prisma.report.update({
          where: { id: report.id },
          data: { sourceFileUrl: storagePath },
        });
      } catch (uploadError) {
        console.warn("File upload skipped (storage not configured):", uploadError);
        // Continue without file storage
      }

      // Extract core sheets
      const extraction = extractCoreSheets(fileBuffer);

      if (extraction.missingRequiredSheets.length > 0) {
        await prisma.report.update({
          where: { id: report.id },
          data: {
            status: "failed",
            errorMessage: `Missing required sheets: ${extraction.missingRequiredSheets.join(", ")}`,
          },
        });

        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: `Missing required sheets: ${extraction.missingRequiredSheets.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Format for Claude
      const formattedData = formatForClaude(
        extraction,
        company.name,
        periodEndDate.toISOString().split("T")[0]
      );

      // Generate report with Claude
      const { report: reportContent, usage } = await generateFinancialReport(
        formattedData,
        company.name,
        periodEndDate.toISOString().split("T")[0],
        company.metricConfig
      );

      // Parse sections from markdown
      const sections = parseReportSections(reportContent);

      // Save sections to database
      for (const section of sections) {
        await prisma.reportSection.create({
          data: {
            reportId: report.id,
            sectionKey: section.key,
            sectionName: section.name,
            sortOrder: section.order,
            content: {
              raw_markdown: section.content,
            },
          },
        });
      }

      // Update report status to complete and auto-publish
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "complete",
          published: true,
          claudeRunId: `tokens:${usage.inputTokens}/${usage.outputTokens}`,
        },
      });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          reportId: report.id,
          status: "complete",
          sectionsGenerated: sections.length,
          usage,
        },
      });
    } catch (processingError) {
      console.error("Report processing error:", processingError);

      // Update report with error
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "failed",
          errorMessage:
            processingError instanceof Error
              ? processingError.message
              : "Unknown processing error",
        },
      });

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Failed to process report",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// Helper to format period label
function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Parse markdown report into sections
function parseReportSections(markdown: string): Array<{
  key: string;
  name: string;
  order: number;
  content: string;
}> {
  const sectionDefinitions = [
    { key: "executive_snapshot", pattern: /executive\s*snapshot/i, order: 1 },
    { key: "revenue_performance", pattern: /revenue\s*performance/i, order: 2 },
    { key: "cogs_gross_margin", pattern: /cogs|gross\s*margin/i, order: 3 },
    { key: "operating_expenses", pattern: /operating\s*expenses/i, order: 4 },
    { key: "profitability_bridges", pattern: /profitability|bridges/i, order: 5 },
    { key: "variance_performance", pattern: /variance|performance/i, order: 6 },
    { key: "cash_flow_liquidity", pattern: /cash\s*flow|liquidity/i, order: 7 },
    { key: "balance_sheet_health", pattern: /balance\s*sheet/i, order: 8 },
    { key: "risk_controls", pattern: /risk|controls/i, order: 9 },
  ];

  const sections: Array<{
    key: string;
    name: string;
    order: number;
    content: string;
  }> = [];

  // Split by ## headers
  const parts = markdown.split(/^##\s+/m);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstLineEnd = part.indexOf("\n");
    const title = firstLineEnd > 0 ? part.slice(0, firstLineEnd).trim() : part.trim();
    const content = firstLineEnd > 0 ? part.slice(firstLineEnd + 1).trim() : "";

    // Match to section definition
    for (const def of sectionDefinitions) {
      if (def.pattern.test(title)) {
        sections.push({
          key: def.key,
          name: `${def.order}. ${title.replace(/^\d+\.\s*/, "")}`,
          order: def.order,
          content: `## ${title}\n\n${content}`,
        });
        break;
      }
    }
  }

  // Sort by order
  sections.sort((a, b) => a.order - b.order);

  // If no sections found, create a single section with all content
  if (sections.length === 0 && markdown.trim()) {
    sections.push({
      key: "full_report",
      name: "Financial Review",
      order: 1,
      content: markdown,
    });
  }

  return sections;
}
