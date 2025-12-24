/**
 * Type definitions for CleverProfits Portal
 */

// Report section structure (stored as JSON in database)
export interface ReportSectionContent {
  // Structured data for dynamic rendering
  tables?: ReportTable[];
  insights?: string[];
  questions?: string[];
  
  // Raw markdown fallback
  raw_markdown?: string;
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: ReportTableRow[];
}

export interface ReportTableRow {
  cells: ReportTableCell[];
  isHighlighted?: boolean;
}

export interface ReportTableCell {
  value: string;
  type: "text" | "currency" | "percent" | "number";
  isPositive?: boolean;
  isNegative?: boolean;
}

// Report status
export type ReportStatus = "processing" | "complete" | "failed";

// Metric configuration
export interface MetricConfig {
  sections: {
    executiveSnapshot: boolean;
    revenuePerformance: boolean;
    cogsGrossMargin: boolean;
    operatingExpenses: boolean;
    profitabilityBridges: boolean;
    variancePerformance: boolean;
    cashFlowLiquidity: boolean;
    balanceSheetHealth: boolean;
    riskControls: boolean;
  };
  enabledMetrics: Record<string, string[]>;
  preset: "basic" | "standard" | "advanced" | "custom";
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ReportListItem {
  id: string;
  periodEnd: string;
  periodLabel: string | null;
  status: ReportStatus;
  createdAt: string;
  hasSourceFile: boolean;
  hasPdf: boolean;
}

export interface ReportDetail {
  id: string;
  companyId: string;
  periodEnd: string;
  periodLabel: string | null;
  status: ReportStatus;
  sections: {
    id: string;
    sectionKey: string;
    sectionName: string;
    sortOrder: number;
    content: ReportSectionContent;
  }[];
  files: {
    sourceFileUrl?: string;
    pdfFileUrl?: string;
  };
  createdAt: string;
}

// Excel processing types
export interface ExcelExtractionResult {
  sheets: {
    name: string;
    csv: string;
    estimatedTokens: number;
  }[];
  totalTokens: number;
  missingRequiredSheets: string[];
  allSheetNames: string[];
}

// Form types
export interface GenerateReportForm {
  companyId: string;
  periodEnd: string;
  file: File;
}
