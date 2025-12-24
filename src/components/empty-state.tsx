import { FileText, Building2, BarChart3, Clock, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  variant?: "default" | "card" | "minimal";
}

export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-150" />
        <div className="relative w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-foreground">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        action.href ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );

  if (variant === "card") {
    return <Card><CardContent className="p-0">{content}</CardContent></Card>;
  }

  if (variant === "minimal") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 px-4">
        <Icon className="w-10 h-10 text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
    );
  }

  return content;
}

// Preset empty states for common use cases
export function NoReportsEmptyState() {
  return (
    <EmptyState
      icon={FileText}
      title="No Reports Available"
      description="Your financial review reports will appear here once they're ready. Check back soon or contact your CleverProfits administrator."
      variant="card"
    />
  );
}

export function NoCompaniesEmptyState() {
  return (
    <EmptyState
      icon={Building2}
      title="No Companies Yet"
      description="Get started by adding your first client company. Each company can have multiple users and reports."
      action={{
        label: "Add Company",
        href: "/admin/companies/new",
      }}
      variant="card"
    />
  );
}

export function PendingSetupEmptyState() {
  return (
    <EmptyState
      icon={Clock}
      title="Account Setup in Progress"
      description="Your account is being configured. Please contact your CleverProfits administrator to complete the onboarding process."
      variant="default"
    />
  );
}

export function NoDataEmptyState({ title = "No Data" }: { title?: string }) {
  return (
    <EmptyState
      icon={BarChart3}
      title={title}
      description="There's no data to display at the moment."
      variant="minimal"
    />
  );
}
