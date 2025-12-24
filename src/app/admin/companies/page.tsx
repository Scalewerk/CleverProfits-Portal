import Link from "next/link";
import { Plus, Building2, Users, FileText, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function CompaniesPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Manage client companies and their report configurations.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/companies/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Companies Yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Add your first client company to start generating financial reports.
            </p>
            <Button asChild>
              <Link href="/admin/companies/new">
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{company.name}</CardTitle>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {company.metricConfig?.preset || "standard"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {formatDate(company.createdAt)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{company._count.users} users</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>{company._count.reports} reports</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/admin/companies/${company.id}`}>
                      View Details
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="icon">
                    <Link href={`/admin/companies/${company.id}/config`}>
                      <Settings className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
