"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportSection } from "@/components/report-section";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  sectionKey: string;
  sectionName: string;
  sortOrder: number;
  content: {
    raw_markdown?: string;
    tables?: unknown[];
    insights?: string[];
    questions?: string[];
  };
}

interface ReportViewerProps {
  sections: Section[];
}

// Full section names for sidebar
const SECTION_DISPLAY_NAMES: Record<string, string> = {
  executive_snapshot: "Executive Snapshot",
  revenue_performance: "Revenue Performance",
  cogs_gross_margin: "COGS & Gross Margin",
  operating_expenses: "Operating Expenses",
  profitability_bridges: "Profitability & Bridges",
  variance_performance: "Variance & Performance",
  cash_flow_liquidity: "Cash Flow & Liquidity",
  balance_sheet_health: "Balance Sheet",
  risk_controls: "Risk & Controls",
};

export function ReportViewer({ sections }: ReportViewerProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.sectionKey || "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentSection = sections.find((s) => s.sectionKey === activeSection);
  const currentIndex = sections.findIndex((s) => s.sectionKey === activeSection);
  const currentSectionName = currentSection
    ? SECTION_DISPLAY_NAMES[currentSection.sectionKey] || currentSection.sectionName
    : "";

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Mobile dropdown */}
      <div className="md:hidden sticky top-16 z-40 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-lg text-sm font-medium shadow-sm"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground text-xs">{currentIndex + 1}/{sections.length}</span>
            <span className="truncate">{currentSectionName}</span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200 flex-shrink-0",
              mobileMenuOpen && "rotate-180"
            )}
          />
        </button>
        {mobileMenuOpen && (
          <div className="absolute left-4 right-4 mt-2 bg-background border rounded-lg shadow-lg overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.sectionKey);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3.5 text-sm transition-colors",
                  "hover:bg-muted active:bg-muted/80",
                  activeSection === section.sectionKey &&
                    "bg-primary/10 text-primary font-medium"
                )}
              >
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {SECTION_DISPLAY_NAMES[section.sectionKey] || section.sectionName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <nav className="hidden md:block w-60 flex-shrink-0">
        <div className="sticky top-20 space-y-1">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.sectionKey)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg text-sm transition-all duration-200",
                "hover:bg-muted",
                activeSection === section.sectionKey
                  ? "bg-primary/10 text-primary font-medium border-l-4 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mr-2 text-xs opacity-60">{index + 1}.</span>
              {SECTION_DISPLAY_NAMES[section.sectionKey] || section.sectionName}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content - takes remaining space */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        {currentSection && (
          <Card className="transition-all duration-200">
            <CardHeader className="pb-4 px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl">{currentSection.sectionName}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 overflow-x-auto">
              <ReportSection content={currentSection.content} sectionName={currentSection.sectionName} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
