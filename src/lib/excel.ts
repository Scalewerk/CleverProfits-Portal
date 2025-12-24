/**
 * Excel Processing Module
 * 
 * Extracts core financial sheets from Excel workbooks and converts to
 * CSV format for Claude API consumption.
 * 
 * Based on validated analysis:
 * - Full workbooks: 989K-2.9M tokens (TOO LARGE)
 * - Core sheets only: 18-35K tokens (FITS in Claude's 200K context)
 */

import * as XLSX from "xlsx";

// Core sheets required for financial reporting (in priority order)
export const CORE_SHEETS = [
  // Primary financial statements (ALWAYS required)
  "PL - RAW",           // Income statement (raw data)
  "Dynamic PL",         // Formatted income statement
  "BS - RAW",           // Balance sheet (raw data)
  
  // Supporting data (high priority)
  "Weekly Financial Review",  // Summary dashboard
  "Monthly Comparative",       // Month-over-month trends
  
  // Additional context (if available)
  "Revenue Chart Data",  // Revenue breakdown by line/product
  "COA - RAW",          // Chart of accounts
  
  // Budget/forecast (if available)
  "Budget",
  "Forecast",
  "Annual P&L",
];

// Alternative sheet name patterns (some clients use different naming)
export const SHEET_NAME_ALIASES: Record<string, string[]> = {
  "PL - RAW": ["P&L - RAW", "PL-RAW", "P&L RAW", "Income Statement", "PL Raw"],
  "Dynamic PL": ["Dynamic P&L", "DynamicPL", "Formatted PL", "P&L"],
  "BS - RAW": ["BS-RAW", "BS RAW", "Balance Sheet", "BS Raw"],
  "Weekly Financial Review": ["Weekly Review", "Financial Review", "Dashboard"],
  "Monthly Comparative": ["Monthly Comparison", "MoM Comparative", "Comparative"],
};

export interface ExtractedSheet {
  name: string;
  csv: string;
  estimatedTokens: number;
}

export interface ExtractionResult {
  sheets: ExtractedSheet[];
  totalTokens: number;
  missingRequiredSheets: string[];
  allSheetNames: string[];
}

/**
 * Find a sheet by name, checking aliases and case-insensitive matches.
 */
function findSheetByName(workbook: XLSX.WorkBook, targetName: string): string | null {
  // Direct match (case-insensitive)
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase() === targetName.toLowerCase()) {
      return sheetName;
    }
  }

  // Check aliases
  const aliases = SHEET_NAME_ALIASES[targetName];
  if (aliases) {
    for (const alias of aliases) {
      for (const sheetName of workbook.SheetNames) {
        if (sheetName.toLowerCase() === alias.toLowerCase()) {
          return sheetName;
        }
      }
    }
  }

  return null;
}

/**
 * Convert an Excel sheet to CSV format.
 */
function sheetToCsv(sheet: XLSX.WorkSheet): string {
  return XLSX.utils.sheet_to_csv(sheet, {
    blankrows: false, // Skip empty rows
    strip: true,      // Trim whitespace
  });
}

/**
 * Estimate token count from text.
 * Rule of thumb: 1 token ≈ 4 characters
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract core financial sheets from an Excel workbook.
 * 
 * @param buffer - Excel file as Buffer or ArrayBuffer
 * @param maxTokens - Maximum tokens to include (default 150K for Claude headroom)
 * @returns Extracted sheets and metadata
 */
export function extractCoreSheets(
  buffer: Buffer | ArrayBuffer,
  maxTokens: number = 150000
): ExtractionResult {
  // Read workbook
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,   // Parse dates properly
    cellNF: true,      // Include number formats
    cellStyles: false, // Skip styles (not needed)
  });

  const result: ExtractionResult = {
    sheets: [],
    totalTokens: 0,
    missingRequiredSheets: [],
    allSheetNames: workbook.SheetNames,
  };

  // Extract each core sheet
  for (const targetName of CORE_SHEETS) {
    const actualName = findSheetByName(workbook, targetName);

    if (actualName) {
      const sheet = workbook.Sheets[actualName];
      const csv = sheetToCsv(sheet);
      const tokens = estimateTokens(csv);

      // Check if adding this sheet would exceed limit
      if (result.totalTokens + tokens > maxTokens) {
        console.warn(
          `Skipping '${actualName}' (${tokens.toLocaleString()} tokens) - would exceed limit`
        );
        continue;
      }

      result.sheets.push({
        name: actualName,
        csv,
        estimatedTokens: tokens,
      });
      result.totalTokens += tokens;
    }
  }

  // Check for required sheets
  const requiredSheets = ["PL - RAW", "BS - RAW"];
  for (const required of requiredSheets) {
    const found = result.sheets.some(
      (s) => s.name.toLowerCase().includes("pl") || s.name.toLowerCase().includes("bs")
    );
    if (!found) {
      result.missingRequiredSheets.push(required);
    }
  }

  return result;
}

/**
 * Format extracted sheets for Claude API.
 */
export function formatForClaude(
  result: ExtractionResult,
  companyName: string,
  periodEnd: string
): string {
  let output = `COMPANY: ${companyName}\n`;
  output += `REPORTING PERIOD ENDING: ${periodEnd}\n`;
  output += `\n${"=".repeat(80)}\n`;
  output += `FINANCIAL DATA (${result.sheets.length} SHEETS EXTRACTED)\n`;
  output += `${"=".repeat(80)}\n`;

  for (const sheet of result.sheets) {
    output += `\n### SHEET: ${sheet.name}\n`;
    output += `${"-".repeat(80)}\n`;
    output += sheet.csv;
    output += "\n";
  }

  return output;
}

/**
 * Validate that an Excel file is suitable for processing.
 */
export function validateExcelFile(
  buffer: Buffer | ArrayBuffer
): { valid: boolean; error?: string; sheetCount?: number } {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    if (workbook.SheetNames.length === 0) {
      return { valid: false, error: "Excel file has no sheets" };
    }

    // Check for at least one financial sheet
    const hasFinancialSheet = CORE_SHEETS.some((name) =>
      findSheetByName(workbook, name) !== null
    );

    if (!hasFinancialSheet) {
      return {
        valid: false,
        error: `No financial sheets found. Expected at least one of: ${CORE_SHEETS.slice(0, 3).join(", ")}. Found: ${workbook.SheetNames.slice(0, 5).join(", ")}${workbook.SheetNames.length > 5 ? "..." : ""}`,
      };
    }

    return { valid: true, sheetCount: workbook.SheetNames.length };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get a preview of what sheets would be extracted (without actually extracting).
 */
export function previewExtraction(buffer: Buffer | ArrayBuffer): {
  foundSheets: string[];
  missingSheets: string[];
  allSheets: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const foundSheets: string[] = [];
  const missingSheets: string[] = [];

  for (const targetName of CORE_SHEETS) {
    const actualName = findSheetByName(workbook, targetName);
    if (actualName) {
      foundSheets.push(actualName);
    } else {
      missingSheets.push(targetName);
    }
  }

  return {
    foundSheets,
    missingSheets,
    allSheets: workbook.SheetNames,
  };
}
