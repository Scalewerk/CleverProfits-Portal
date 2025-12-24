"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ConfigData {
  preset: string;
  includeExecutiveSnapshot: boolean;
  includeRevenuePerformance: boolean;
  includeCogsGrossMargin: boolean;
  includeOperatingExpenses: boolean;
  includeProfitabilityBridges: boolean;
  includeVariancePerformance: boolean;
  includeCashFlowLiquidity: boolean;
  includeBalanceSheetHealth: boolean;
  includeRiskControls: boolean;
}

const PRESETS: Record<string, Partial<ConfigData>> = {
  basic: {
    includeExecutiveSnapshot: true,
    includeRevenuePerformance: true,
    includeCogsGrossMargin: false,
    includeOperatingExpenses: false,
    includeProfitabilityBridges: false,
    includeVariancePerformance: false,
    includeCashFlowLiquidity: false,
    includeBalanceSheetHealth: false,
    includeRiskControls: false,
  },
  standard: {
    includeExecutiveSnapshot: true,
    includeRevenuePerformance: true,
    includeCogsGrossMargin: true,
    includeOperatingExpenses: true,
    includeProfitabilityBridges: false,
    includeVariancePerformance: false,
    includeCashFlowLiquidity: false,
    includeBalanceSheetHealth: false,
    includeRiskControls: false,
  },
  advanced: {
    includeExecutiveSnapshot: true,
    includeRevenuePerformance: true,
    includeCogsGrossMargin: true,
    includeOperatingExpenses: true,
    includeProfitabilityBridges: true,
    includeVariancePerformance: true,
    includeCashFlowLiquidity: true,
    includeBalanceSheetHealth: true,
    includeRiskControls: true,
  },
};

const SECTIONS = [
  { key: "includeExecutiveSnapshot", label: "1. Executive Snapshot", description: "MTD/QTD/YTD/TTM metrics, top insights" },
  { key: "includeRevenuePerformance", label: "2. Revenue Performance", description: "Trends, growth rates, revenue by line" },
  { key: "includeCogsGrossMargin", label: "3. COGS & Gross Margin", description: "Components, trends, unit economics" },
  { key: "includeOperatingExpenses", label: "4. Operating Expenses", description: "By function, % of revenue, labor detail" },
  { key: "includeProfitabilityBridges", label: "5. Profitability & Bridges", description: "Gross-to-net bridge, margin analysis" },
  { key: "includeVariancePerformance", label: "6. Variance & Performance", description: "MTD variance summary, budget vs actual" },
  { key: "includeCashFlowLiquidity", label: "7. Cash Flow & Liquidity", description: "Cash KPIs, liquidity ratios" },
  { key: "includeBalanceSheetHealth", label: "8. Balance Sheet Health", description: "Asset quality, liability trends" },
  { key: "includeRiskControls", label: "9. Risk & Controls", description: "Key risks, close metrics" },
];

export default function ConfigPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [config, setConfig] = useState<ConfigData>({
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
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`/api/admin/companies/${id}/config`);
        const data = await response.json();

        if (data.success) {
          setCompanyName(data.data.companyName);
          setConfig({
            preset: data.data.config.preset || "standard",
            includeExecutiveSnapshot: data.data.config.includeExecutiveSnapshot ?? true,
            includeRevenuePerformance: data.data.config.includeRevenuePerformance ?? true,
            includeCogsGrossMargin: data.data.config.includeCogsGrossMargin ?? true,
            includeOperatingExpenses: data.data.config.includeOperatingExpenses ?? true,
            includeProfitabilityBridges: data.data.config.includeProfitabilityBridges ?? false,
            includeVariancePerformance: data.data.config.includeVariancePerformance ?? false,
            includeCashFlowLiquidity: data.data.config.includeCashFlowLiquidity ?? false,
            includeBalanceSheetHealth: data.data.config.includeBalanceSheetHealth ?? false,
            includeRiskControls: data.data.config.includeRiskControls ?? false,
          });
        }
      } catch {
        setError("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [id]);

  const handlePresetChange = (preset: string) => {
    const presetConfig = PRESETS[preset];
    if (presetConfig) {
      setConfig((prev) => ({
        ...prev,
        ...presetConfig,
        preset,
      }));
    }
  };

  const handleToggle = (key: keyof ConfigData) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
      preset: "custom",
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/companies/${id}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to save configuration");
        return;
      }

      router.push(`/admin/companies/${id}`);
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/admin/companies/${id}`}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to {companyName}
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Report Configuration</h1>
        <p className="text-muted-foreground">
          Configure which sections to include in financial reports for {companyName}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Report Sections</CardTitle>
              <CardDescription>
                Select which sections to include in generated reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SECTIONS.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={key}
                    checked={config[key as keyof ConfigData] as boolean}
                    onCheckedChange={() => handleToggle(key as keyof ConfigData)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor={key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preset</CardTitle>
              <CardDescription>
                Quick selection of common configurations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={config.preset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (2 sections)</SelectItem>
                  <SelectItem value="standard">Standard (4 sections)</SelectItem>
                  <SelectItem value="advanced">Advanced (9 sections)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
