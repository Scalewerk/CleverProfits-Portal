import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/db";
import { formatDate, formatPeriodLabel } from "@/lib/utils";
import { ReportViewer } from "@/components/report-viewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user and company
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    redirect("/dashboard");
  }

  // User must be linked to a company to view reports
  if (!user.companyId) {
    redirect("/dashboard");
  }

  // Get report with sections (user can only see their company's reports)
  const report = await prisma.report.findFirst({
    where: {
      id,
      companyId: user.companyId,
      published: true,
    },
    include: {
      company: true,
      sections: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!report) {
    notFound();
  }

  // Log access
  await prisma.accessLog.create({
    data: {
      userId: user.id,
      reportId: report.id,
      action: "viewed",
    },
  });

  const isAdmin = user.role === "admin";

  return (
    <DashboardLayout isAdmin={isAdmin} fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {report.periodLabel || formatPeriodLabel(report.periodEnd)}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Generated {formatDate(report.createdAt)}
              </span>
              <span>{report.company.name}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {report.sourceFileUrl && (
              <Button variant="outline" asChild>
                <a href={`/api/reports/${report.id}/download/excel`} target="_blank" rel="noopener noreferrer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Download Excel
                </a>
              </Button>
            )}
            {report.pdfFileUrl && (
              <Button asChild>
                <a href={`/api/reports/${report.id}/download/pdf`} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Report Content */}
        {report.sections.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Report Content</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This report has no sections available.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ReportViewer
            sections={report.sections.map((s) => ({
              id: s.id,
              sectionKey: s.sectionKey,
              sectionName: s.sectionName,
              sortOrder: s.sortOrder,
              content: s.content as { raw_markdown?: string; tables?: unknown[]; insights?: string[]; questions?: string[] },
            }))}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
