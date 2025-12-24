import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings, FileText, Users, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/db";
import { formatDate, formatPeriodLabel } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: PageProps) {
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
    notFound();
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-orange-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/admin/companies">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Companies
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground">
            Created {formatDate(company.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/companies/${id}/users`}>
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/companies/${id}/config`}>
              <Settings className="w-4 h-4 mr-2" />
              Configure Metrics
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/generate?company=${id}`}>
              <FileText className="w-4 h-4 mr-2" />
              Generate Report
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Users</CardTitle>
            </div>
            <CardDescription>
              {company.users.length} user(s) have access to this company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {company.users.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No users assigned yet. Users are created through Clerk webhooks.
              </p>
            ) : (
              <div className="space-y-2">
                {company.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.lastLoginAt
                          ? `Last login: ${formatDate(user.lastLoginAt)}`
                          : "Never logged in"}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <CardTitle>Report Configuration</CardTitle>
            </div>
            <CardDescription>
              Preset: {company.metricConfig?.preset || "standard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { key: "includeExecutiveSnapshot", label: "Executive Snapshot" },
                { key: "includeRevenuePerformance", label: "Revenue Performance" },
                { key: "includeCogsGrossMargin", label: "COGS & Gross Margin" },
                { key: "includeOperatingExpenses", label: "Operating Expenses" },
                { key: "includeProfitabilityBridges", label: "Profitability & Bridges" },
                { key: "includeVariancePerformance", label: "Variance & Performance" },
                { key: "includeCashFlowLiquidity", label: "Cash Flow & Liquidity" },
                { key: "includeBalanceSheetHealth", label: "Balance Sheet Health" },
                { key: "includeRiskControls", label: "Risk & Controls" },
              ].map(({ key, label }) => {
                const config = company.metricConfig as Record<string, boolean> | null;
                const enabled = config?.[key] ?? false;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className={enabled ? "" : "text-muted-foreground"}>
                      {label}
                    </span>
                    {enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle>Reports</CardTitle>
          </div>
          <CardDescription>
            {company.reports.length} report(s) generated for this company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {company.reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No reports generated yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Period</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Published</th>
                    <th className="text-left py-2 px-3 font-medium">Generated</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {company.reports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {report.periodLabel || formatPeriodLabel(report.periodEnd)}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          {statusIcon(report.status)}
                          <span className="capitalize">{report.status}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {report.published ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {report.status === "complete" && (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/reports/${report.id}`}>View</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
