"use client";

import { CheckCircle, Loader2, Circle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type GenerationStep =
  | "uploading"
  | "extracting"
  | "generating"
  | "saving";

export type GenerationStatus = "idle" | "uploading" | "extracting" | "generating" | "saving" | "complete" | "error";

interface GenerationProgressProps {
  status: GenerationStatus;
  error?: string;
  result?: {
    reportId: string;
    sectionsGenerated: number;
  };
  companyName?: string;
  onReset: () => void;
}

const steps: { key: GenerationStep; label: string }[] = [
  { key: "uploading", label: "Uploading file..." },
  { key: "extracting", label: "Extracting financial data..." },
  { key: "generating", label: "Generating report with AI..." },
  { key: "saving", label: "Saving report..." },
];

function getStepStatus(
  stepKey: GenerationStep,
  currentStatus: GenerationStatus
): "complete" | "active" | "pending" | "error" {
  const stepOrder: GenerationStep[] = ["uploading", "extracting", "generating", "saving"];
  const currentIndex = stepOrder.indexOf(currentStatus as GenerationStep);
  const stepIndex = stepOrder.indexOf(stepKey);

  if (currentStatus === "error") {
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "error";
    return "pending";
  }

  if (currentStatus === "complete") return "complete";
  if (currentStatus === "idle") return "pending";

  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function getProgressPercentage(status: GenerationStatus): number {
  switch (status) {
    case "idle": return 0;
    case "uploading": return 15;
    case "extracting": return 35;
    case "generating": return 65;
    case "saving": return 90;
    case "complete": return 100;
    case "error": return 0;
    default: return 0;
  }
}

export function GenerationProgress({
  status,
  error,
  result,
  companyName,
  onReset,
}: GenerationProgressProps) {
  const progress = getProgressPercentage(status);
  const isProcessing = !["idle", "complete", "error"].includes(status);

  if (status === "idle") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Circle className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">Ready to Generate</p>
        <p className="text-sm mt-1">Fill in the details and upload a file to begin.</p>
      </div>
    );
  }

  if (status === "complete" && result) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
          Report Generated Successfully!
        </h3>
        <p className="text-muted-foreground mt-2">
          {result.sectionsGenerated} sections created{companyName ? ` for ${companyName}` : ""}
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Button asChild>
            <Link href={`/reports/${result.reportId}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Report
            </Link>
          </Button>
          <Button variant="outline" onClick={onReset}>
            Generate Another
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Generation Failed
        </h3>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          {error || "An unexpected error occurred. Please try again."}
        </p>
        <Button variant="outline" className="mt-6" onClick={onReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Processing state
  return (
    <div className="py-6">
      <h3 className="text-lg font-semibold text-center mb-6">
        Generating Financial Report
      </h3>

      <div className="space-y-4 mb-8">
        {steps.map((step) => {
          const stepStatus = getStepStatus(step.key, status);
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                stepStatus === "active" && "bg-blue-50 dark:bg-blue-950/30",
                stepStatus === "complete" && "bg-emerald-50/50 dark:bg-emerald-950/20",
                stepStatus === "error" && "bg-red-50 dark:bg-red-950/30"
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {stepStatus === "complete" && (
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
                {stepStatus === "active" && (
                  <div className="relative">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                )}
                {stepStatus === "pending" && (
                  <Circle className="w-5 h-5 text-muted-foreground/40" />
                )}
                {stepStatus === "error" && (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium",
                  stepStatus === "complete" && "text-emerald-700 dark:text-emerald-300",
                  stepStatus === "active" && "text-blue-700 dark:text-blue-300",
                  stepStatus === "pending" && "text-muted-foreground",
                  stepStatus === "error" && "text-red-700 dark:text-red-300"
                )}
              >
                {step.label}
              </span>

              {/* Status text */}
              <span
                className={cn(
                  "ml-auto text-xs",
                  stepStatus === "complete" && "text-emerald-600 dark:text-emerald-400",
                  stepStatus === "active" && "text-blue-600 dark:text-blue-400",
                  stepStatus === "pending" && "text-muted-foreground/60",
                  stepStatus === "error" && "text-red-600 dark:text-red-400"
                )}
              >
                {stepStatus === "complete" && "Complete"}
                {stepStatus === "active" && "In Progress"}
                {stepStatus === "pending" && "Pending"}
                {stepStatus === "error" && "Failed"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{progress}% complete</span>
          <span>
            {status === "generating" ? "This usually takes 30-60 seconds" : "Processing..."}
          </span>
        </div>
      </div>
    </div>
  );
}
