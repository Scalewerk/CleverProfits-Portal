"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenerationProgress, type GenerationStatus } from "@/components/generation-progress";

interface Company {
  id: string;
  name: string;
}

export default function GenerateReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCompany = searchParams.get("company");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(preselectedCompany || "");
  const [periodEnd, setPeriodEnd] = useState(() => {
    // Default to last day of previous month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return lastMonth.toISOString().split("T")[0];
  });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reportId: string; sectionsGenerated: number } | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/admin/companies");
        const data = await response.json();
        if (data.success) {
          setCompanies(data.data);
        }
      } catch {
        console.error("Failed to fetch companies");
      }
    };
    fetchCompanies();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: status !== "idle",
  });

  const handleGenerate = async () => {
    if (!selectedCompanyId || !periodEnd || !file) {
      setError("Please fill in all fields and upload a file");
      return;
    }

    setStatus("uploading");
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("companyId", selectedCompanyId);
      formData.append("periodEnd", periodEnd);
      formData.append("file", file);

      // Simulate brief upload step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStatus("extracting");

      // Simulate brief extraction step
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatus("generating");

      const response = await fetch("/api/admin/reports/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        setStatus("error");
        setError(data.error || "Failed to generate report");
        return;
      }

      setStatus("saving");
      // Brief save animation
      await new Promise((resolve) => setTimeout(resolve, 500));

      setStatus("complete");
      setResult({
        reportId: data.data.reportId,
        sectionsGenerated: data.data.sectionsGenerated,
      });
    } catch {
      setStatus("error");
      setError("An error occurred. Please try again.");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setFile(null);
    setResult(null);
    setError("");
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const isProcessing = !["idle", "complete", "error"].includes(status);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/admin">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Admin
          </Link>
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Generate Report</h1>
        <p className="text-muted-foreground">
          Upload an Excel file to generate a financial review report.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
            <CardDescription>
              Select the company and reporting period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End Date</Label>
              <input
                type="date"
                id="periodEnd"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={isProcessing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label>Excel File</Label>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25"}
                  ${file ? "border-emerald-500 bg-emerald-500/5" : ""}
                  ${isProcessing ? "pointer-events-none opacity-50" : "hover:border-primary/50 hover:bg-muted/30"}
                `}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {!isProcessing && (
                      <p className="text-xs text-muted-foreground">Click or drag to replace</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">
                      {isDragActive ? "Drop the file here" : "Drag & drop Excel file"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (.xlsx, .xls)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && status === "idle" && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!selectedCompanyId || !periodEnd || !file || isProcessing}
              className="w-full h-11"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Status / Result */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Status</CardTitle>
            <CardDescription>
              Monitor the report generation progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerationProgress
              status={status}
              error={error}
              result={result ?? undefined}
              companyName={selectedCompany?.name}
              onReset={handleReset}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
