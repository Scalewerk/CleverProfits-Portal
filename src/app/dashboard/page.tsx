import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, Eye, Calendar, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NoReportsEmptyState, PendingSetupEmptyState } from "@/components/empty-state";
import prisma from "@/lib/db";
import { formatDate, formatPeriodLabel } from "@/lib/utils";

// Check if report is recent (within 7 days)
function isRecentReport(createdAt: Date): boolean {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return createdAt > sevenDaysAgo;
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user and their company
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      company: true,
    },
  });

  // If user doesn't exist in our DB yet, show setup message
  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <PendingSetupEmptyState />
        </div>
      </DashboardLayout>
    );
  }

  // If user has no company assigned yet, show pending message
  if (!user.companyId || !user.company) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <PendingSetupEmptyState />
        </div>
      </DashboardLayout>
    );
  }

  // Get published reports for user's company
  const reports = await prisma.report.findMany({
    where: {
      companyId: user.companyId,
      published: true,
    },
    orderBy: {
      periodEnd: "desc",
    },
    take: 12, // Last 12 months
  });

  // Check if user is admin (for showing admin nav)
  const isAdmin = user.role === "admin";

  return (
    <DashboardLayout isAdmin={isAdmin}>
      <div className="space-y-6 page-transition">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user.company.name}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Access your monthly financial reviews below.
          </p>
        </div>

        {/* Reports Grid */}
        {reports.length === 0 ? (
          <NoReportsEmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report, index) => {
              const isRecent = isRecentReport(report.createdAt);
              const isLatest = index === 0;

              return (
                <Card
                  key={report.id}
                  className={`card-hover relative overflow-hidden ${
                    isLatest ? "ring-2 ring-primary/20" : ""
                  }`}
                >
                  {/* New badge for recent reports */}
                  {isRecent && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        <Sparkles className="w-3 h-3" />
                        New
                      </span>
                    </div>
                  )}

                  {/* Accent bar at top */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60" />

                  <CardHeader className="pb-3 pt-5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">
                        Generated {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <CardTitle className="text-lg leading-tight">
                      {report.periodLabel || formatPeriodLabel(report.periodEnd)}
                    </CardTitle>
                    <CardDescription>
                      Month-End Financial Review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button asChild className="flex-1">
                        <Link href={`/reports/${report.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Report
                        </Link>
                      </Button>
                      {report.sourceFileUrl && (
                        <Button variant="outline" size="icon" asChild title="Download Excel">
                          <Link href={`/api/reports/${report.id}/download/excel`}>
                            <Download className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Stats */}
        {reports.length > 0 && (
          <Card className="section-content">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-muted to-muted/50 rounded-lg border border-border/50">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{reports.length}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Reports Available</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-muted to-muted/50 rounded-lg border border-border/50 col-span-1 sm:col-span-1">
                  <div className="text-lg sm:text-3xl font-bold text-primary truncate">
                    {formatPeriodLabel(reports[0].periodEnd)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Latest Period</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20 col-span-2 sm:col-span-1">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">Big 4</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Quality Standard</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
