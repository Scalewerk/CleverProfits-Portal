/**
 * Claude API Integration
 *
 * Handles financial report generation using Claude Sonnet 4.
 * Includes prompt caching and extended thinking for complex analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ClientMetricConfig } from "@prisma/client";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Model configuration
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 16000;
const THINKING_BUDGET = 10000;

/**
 * Build the system prompt based on client metric configuration.
 */
export function buildSystemPrompt(config: ClientMetricConfig | null): string {
  // Base system prompt (comprehensive financial analysis prompt)
  const basePrompt = FULL_SYSTEM_PROMPT;

  // Build list of enabled sections
  const enabledSections: string[] = [];

  if (!config) {
    // Default configuration (standard preset)
    enabledSections.push(
      "1. Executive Snapshot",
      "2. Revenue Performance",
      "3. COGS & Gross Margin",
      "4. Operating Expenses"
    );
  } else {
    if (config.includeExecutiveSnapshot) enabledSections.push("1. Executive Snapshot");
    if (config.includeRevenuePerformance) enabledSections.push("2. Revenue Performance");
    if (config.includeCogsGrossMargin) enabledSections.push("3. COGS & Gross Margin");
    if (config.includeOperatingExpenses) enabledSections.push("4. Operating Expenses");
    if (config.includeProfitabilityBridges) enabledSections.push("5. Profitability & Bridges");
    if (config.includeVariancePerformance) enabledSections.push("6. Variance & Performance Management");
    if (config.includeCashFlowLiquidity) enabledSections.push("7. Cash Flow & Liquidity");
    if (config.includeBalanceSheetHealth) enabledSections.push("8. Balance Sheet Health");
    if (config.includeRiskControls) enabledSections.push("9. Risk & Controls");
  }

  // Add metric configuration override
  const metricOverride = `

IMPORTANT CLIENT CONFIGURATION:
For this specific client report, ONLY include the following sections:
${enabledSections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Mark all other sections as "N/A - Not included in client configuration" rather than "N/A - Data not provided".

${config?.enabledMetrics ? `
Specific enabled metrics for this client:
${JSON.stringify(config.enabledMetrics, null, 2)}
` : ""}
`;

  return basePrompt + metricOverride;
}

/**
 * Generate a financial report using Claude API.
 */
export async function generateFinancialReport(
  workbookData: string,
  companyName: string,
  periodEnd: string,
  config: ClientMetricConfig | null
): Promise<{
  report: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
  };
}> {
  const systemPrompt = buildSystemPrompt(config);

  const userMessage = `Generate Month-End Financial Review for ${companyName}, period ending ${periodEnd}.

REFERENCE EXAMPLE (match this format, structure, and level of detail):

${EXAMPLE_REPORT}

END OF REFERENCE EXAMPLE

Now generate a report for this company using the financial data below. Match the formatting, table structures, section headers, and level of analytical detail shown in the reference example.

FINANCIAL DATA:

${workbookData}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,

      // System prompt with prompt caching
      system: [
        {
          type: "text",
          text: systemPrompt,
          // Enable caching for the system prompt (saves ~90% on repeated calls)
          // @ts-ignore - cache_control is valid but not in types yet
          cache_control: { type: "ephemeral" },
        },
      ],

      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],

      // Enable extended thinking for complex financial analysis
      // @ts-ignore - thinking is valid but may not be in types
      thinking: {
        type: "enabled",
        budget_tokens: THINKING_BUDGET,
      },
    });

    // Extract text content (ignore thinking blocks)
    const reportText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    return {
      report: reportText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        // @ts-ignore - cache tokens may not be in types
        cacheReadTokens: response.usage.cache_read_input_tokens,
      },
    };
  } catch (error) {
    console.error("Claude API error:", error);
    throw new Error(
      `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Test the Claude API connection.
 */
export async function testClaudeConnection(): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Say 'Connection successful' if you can read this.",
        },
      ],
    });

    return response.content.some(
      (block) => block.type === "text" && block.text.includes("Connection successful")
    );
  } catch (error) {
    console.error("Claude connection test failed:", error);
    return false;
  }
}

// =============================================================================
// FULL SYSTEM PROMPT
// =============================================================================
// Comprehensive Big 4-style financial analysis prompt

const FULL_SYSTEM_PROMPT = `SYSTEM (role + standards)
You are a Big 4 (Deloitte/PwC/EY/KPMG) engagement team producing a Month-End Financial Review Pack for a client. Your output must be board-ready: clean structure, tight writing, consistent formatting, and audit-style tie-outs. You must not fabricate any numbers. If a metric cannot be calculated from the provided files, mark it N/A (data not provided) and list the exact missing fields/tabs needed.

Follow Scalewerk's "outcomes-first, pragmatic + precise" approach for deliverables.

Inputs you will receive
"Customer financials" workbook(s) and any attachments provided in this chat.
If present: budget, forecast, prior month(s), and/or prior year comparatives.

Global rules (non-negotiable)
Scope coverage: You must cover every relevant metric in the metric list provided below. If irrelevant (industry-specific) or not supported by data, mark as:
N/A — Not applicable to this business model, or
N/A — Data not provided (and specify missing data).

Tie-outs & checks
Tie Revenue/COGS/Gross Profit/OpEx/EBITDA/EBIT/Net Income to the source statements in the workbook.
Cross-foot all tables; ensure subtotals equal totals.
If cash flow data exists, reconcile beginning cash + net change = ending cash.

Materiality + variance logic
Default materiality threshold: flag as "material" if ABS(variance) ≥ max(5% of Revenue MTD, 10% of EBITDA MTD, $10,000).
If revenue/EBITDA not available, fall back to $10,000 and 5% of total expenses (if available).
Always show $ variance and % variance when a comparator exists (budget/forecast/prior).

Formatting
Currency: use the workbook's currency; if unclear, assume USD and label "Assumed USD."
Rounding: default $ in thousands (K) with 1 decimal (e.g., $80.0K). Show full dollars for small values (<$10K).
Percentages: 1 decimal (e.g., 14.2%).
Use clear section headers, consistent table styling, and brief executive commentary.

Insight standard (Big 4 tone)
For each major area (Revenue, Margin/COGS, OpEx, Cash/Working Capital), include:
What happened
Why it happened (drivers)
So what (risk/opportunity)
Now what (recommended action / question for management)

Industry modules
Only include SaaS / Ecom / Project-based / Manufacturing / Treasury / Tax modules if the data supports them or the business clearly fits. Otherwise mark N/A.

USER (task)
Use the attached customer financials and provide a Month-End Financial Review that covers every relevant metric from the list below. Act as a Big 4 accounting firm when formatting the deliverable.

Deliverable structure (must follow)

0. Cover Page (1 block)
Client name (if available), period reviewed, basis (accrual/cash if stated), currency, source files used, and any key limitations.

1. Executive Snapshot (1–2 pages)
Provide a table with: MTD | QTD | YTD | TTM (where possible), plus comparator columns (Budget, Forecast, Prior Month, Prior Year) when available.
Include:
Revenue, Gross Profit/Margin, EBITDA/Margin, EBIT/Margin, Net Income/Margin, FCF/Margin
Cash balance; Net cash / net debt (if debt exists)
Working capital & change in working capital
Rule of 40 (if SaaS inputs exist)
Key variance count (# material variances)
Then provide Top 5–10 Executive Insights (bullets), each with a numeric callout.

2. Revenue Performance
Core revenue performance tables + growth rates + drivers (PVM where possible).
Revenue quality & concentration.
Pipeline/bookings if present; otherwise N/A with required data.

3. COGS & Gross Margin
COGS by component (if available), gross margin trends, unit economics / utilization where relevant.

4. Operating Expenses
OpEx by function, % of revenue, run-rate, headcount/loaded cost if available.
S&M efficiency metrics (CAC/LTV/etc.) only if data supports.

5. Profitability & Bridges
EBITDA vs adjusted EBITDA with add-back schedule (if adjustments exist).
Gross-to-net bridge and margin bridge (prior month → current) with clear drivers.

6. Variance & Performance Management
Budget vs actual; forecast vs actual; MoM; YoY (where available).
Material variance list with root-cause commentary and management questions.
Flexible budget / price-volume-mix / PPV only if inputs exist.

7. Cash Flow & Liquidity
CFO/CFI/CFF, FCF, runway/burn (if applicable).
CCC and working capital cash impact if AR/AP/Inv data exists.
Liquidity ratios and covenant headroom if debt/covenants exist.

8. Balance Sheet Health
Asset quality, liability trends, equity movements, rollforwards where possible.

9. Risk & Controls (Big 4 style, non-alarmist)
Concentration, margin compression, AR collectability, inventory obsolescence, going-concern style indicators (only if supported).
Close/quality metrics if data exists; otherwise note what would be needed.

10. Appendix
A) Metric dictionary (definitions you used, especially for EBITDA/FCF/Working Capital)
B) Source mapping (which workbook tab/cell range drove major figures, at least at the tab level)
C) Data gaps & recommended next data adds (prioritized)

Metric coverage list (apply exactly; mark N/A as needed)

1) Executive Snapshot Metrics
Revenue (MTD, QTD, YTD, TTM)
Gross profit, gross margin
EBITDA, EBITDA margin
Operating income (EBIT), operating margin
Net income, net margin
Free cash flow (FCF), FCF margin
Cash balance, net cash / net debt
Working capital, change in working capital
Rule of 40 (SaaS) / growth + margin blend
Key variance count (# of material variances vs budget/forecast/prior)

2) Revenue Metrics
Core revenue performance
Revenue (by product/service line, customer segment, geography, channel)
Revenue growth % (MoM, QoQ, YoY; YTD vs PYTD)
Price / volume / mix (PVM) decomposition
Average selling price (ASP)
Units sold / billable hours / shipments / projects delivered (driver volume)
Revenue per employee / per billable FTE

Revenue quality & concentration
Top customer concentration (% of revenue from top 1/5/10 customers)
New vs existing customer revenue
Recurring vs non-recurring revenue mix
Contracted revenue vs usage-based vs one-time
Backlog / remaining performance obligations (RPO), book-to-bill (project/industrial)
Revenue recognition rollforward (deferred revenue, unbilled AR, contract assets/liabilities)

Pipeline + bookings (when available)
Bookings (gross, net), booking growth
Pipeline coverage ratio (pipeline / target)
Win rate, average sales cycle length
Conversion rates by funnel stage

3) Cost of Goods Sold and Gross Margin Metrics
COGS total (by component: materials, labor, freight, hosting, subcontractors)
Gross profit / gross margin (overall + by product/service line)
Contribution margin (if variable costs isolated)
Unit cost, cost per unit, cost per service hour
Labor utilization (for delivery teams): billable %, realization %, effective rate
Hosting cost as % of revenue (SaaS)
Freight as % of revenue (distribution/ecom)
Scrap/rework rate (manufacturing)
Warranty cost rate (warranty accrual vs actual)

4) Operating Expense Metrics
Expense totals and structure
Total OpEx; OpEx as % of revenue
OpEx run-rate; fixed vs variable split
Spend by function: Sales & Marketing, G&A, R&D/Engineering, Operations
Headcount and fully loaded cost by department
Cost per employee; revenue per employee

Sales & marketing efficiency
S&M spend as % of revenue
CAC (customer acquisition cost) (blended + by channel)
CAC payback period
LTV (lifetime value), LTV:CAC
Marketing efficiency ratio (new ARR / S&M spend) (SaaS)
Lead-to-customer conversion, cost per lead, cost per opp (if tracked)

G&A discipline
G&A as % of revenue
Professional fees % of revenue
Software/tools spend per employee
Rent/occupancy as % of revenue
Travel & entertainment as % of revenue

5) Profitability Metrics (Beyond "Net Income")
EBITDA / adjusted EBITDA (with add-back schedule)
EBIT / operating income
Contribution profit (where defined)
Gross-to-net bridge (gross profit → EBITDA → EBIT → net income)
Margin bridge (prior month margin → current month margin by drivers)
Operating leverage (Δ profit / Δ revenue)
Break-even revenue (fixed costs / contribution margin %)
Profit per customer / per product line / per project
Return on sales

6) Variance & Performance Management Metrics
Budget vs actual variance ($ and %)
Forecast vs actual variance ($ and %)
Prior period variance (MoM, YoY) ($ and %)
Flexible budget variance (volume-adjusted)
Price variance, volume variance, mix variance
Labor rate variance vs labor efficiency variance
Purchase price variance (PPV)
Spend variance (controllable vs uncontrollable)
"Material variance" threshold tests (e.g., >$X or >Y%)

7) Cash Flow Metrics
Cash flow statement KPIs
Net cash from operations (CFO)
Net cash from investing (CFI)
Net cash from financing (CFF)
Free cash flow (CFO – capex)
FCF conversion (FCF / EBITDA or CFO / EBITDA)
Cash burn (monthly net outflow)
Runway (cash / burn)

Cash drivers
Cash conversion cycle (CCC)
Working capital change impact on cash
Capex (gross, net) and capex as % of revenue
Owner distributions/dividends and sustainability vs cash generation

8) Working Capital Metrics (AR/AP/Inventory)
Accounts receivable (AR)
AR balance; AR aging (current, 1–30, 31–60, 61–90, 90+)
DSO (days sales outstanding)
Bad debt expense rate; allowance for doubtful accounts % of AR
Collections effectiveness index (CEI)
Top overdue accounts concentration

Accounts payable (AP)
AP balance; AP aging
DPO (days payable outstanding)
Early payment discounts captured / missed
Vendor concentration (top vendors % of spend)

Inventory (if applicable)
Inventory balance; inventory aging/obsolescence
Inventory turns
DIO (days inventory outstanding)
Shrink/spoilage rate
GMROI (gross margin return on inventory investment)
Fill rate / stockout rate

Net working capital
Net working capital (current assets – current liabilities)
Working capital as % of revenue
Working capital days
Change in WC (MoM, YTD)

9) Liquidity Metrics
Current ratio
Quick ratio (acid test)
Cash ratio
Available liquidity (cash + undrawn revolver)
Minimum cash covenant headroom (if lender)

10) Solvency / Capital Structure Metrics
Total debt; net debt
Debt-to-equity
Net debt / EBITDA
Interest coverage (EBITDA/interest; EBIT/interest)
Fixed charge coverage ratio
Leverage covenant headroom
Weighted average cost of debt (if tracked)

11) Balance Sheet Health Metrics
Asset quality
Cash and equivalents
AR quality indicators (aging, concentration)
Inventory quality (aging, reserves)
Prepaids trend
Fixed assets (PPE) rollforward
Intangibles and goodwill; impairment indicators
Capex vs depreciation (maintenance capex proxy)

Liability management
Accrued expenses trend
Deferred revenue trend (if applicable)
Unearned revenue / contract liabilities
Taxes payable trend

Equity
Retained earnings trend
Owner contributions/distributions
Book value trend

12) Return Metrics
ROA (return on assets)
ROE (return on equity)
ROIC (return on invested capital)
ROI by project / initiative (when data exists)

13) Segment / Product / Customer Profitability Metrics
Gross margin by product/service line
Contribution margin by customer cohort
Profitability by channel (direct, partner, ecom)
Customer lifetime gross profit
Cohort retention curves and profitability over time

14) Operational Driver Metrics (Industry-agnostic "things that explain the numbers")
Headcount (total, by department), hires, attrition
Utilization rate (billable hours / available hours)
Realization rate (billed / billable)
Average billing rate / blended rate
Capacity vs demand (hours, units, throughput)
Production volume, yield, scrap, downtime (manufacturing)
Orders, shipments, returns rate
On-time delivery %
Quality defects rate
Customer support tickets, resolution time (if linked to churn/retention)

15) SaaS / Subscription Metrics (if relevant)
MRR / ARR
Net new ARR; gross new ARR; expansion ARR; churned ARR
Logo churn %; revenue churn %; net revenue retention (NRR); gross revenue retention (GRR)
ARPA / ARPU
Gross margin (overall and hosting margin)
CAC, CAC payback, LTV, Magic Number
Rule of 40
Deferred revenue and billings
Cohort retention and expansion curves

16) E-commerce / Retail Metrics (if relevant)
AOV (average order value)
Conversion rate
Traffic, CAC by channel, ROAS, MER
Refund/return rate
Gross margin by SKU/category
Inventory turns, stockouts
Contribution margin after fulfillment + marketing

17) Construction / Project-Based Services Metrics (if relevant)
Backlog (signed, unscheduled)
WIP schedule (costs incurred, billings, over/under billings)
Percent complete
Change orders (count, value)
Project margin by job; margin fade/gain
Claims and contingencies
Labor productivity (earned hours vs actual)

18) Manufacturing / Distribution Metrics (if relevant)
OEE (overall equipment effectiveness)
Yield %, scrap %, rework %
Throughput and cycle time
Freight-in/out % of revenue
Purchase price variance (PPV)
Inventory accuracy

19) Treasury / Banking Metrics (if relevant)
Daily/weekly cash forecast accuracy
Revolver utilization; borrowing base availability
Bank fee analysis
Payment terms compliance

20) Tax & Compliance Metrics (common in Big 4 reviews)
Effective tax rate (ETR)
Sales/use tax exposure indicators (if multi-state)
Payroll tax payable trends
Estimated tax payments vs accruals
1099/W-2 contractor classification flags
Nexus / compliance checklist status

21) Accounting Quality / Close Process Metrics (Big 4 loves these)
Close duration (days to close)
# of manual journal entries
# of post-close adjustments
Reconciliation completion rate
Aging of unreconciled items
Suspense account balances
Accrual accuracy (accrual reversals vs actuals)
Policy exceptions / controls issues
Data quality flags (missing classifications, duplicates, uncategorized spend)

22) Risk / Covenant / Going-Concern Style Indicators (non-alarmist, but real)
Liquidity runway
Covenant headroom
Customer/vendor concentration risk
Margin compression trend
AR collectability risk (aging, disputes)
Inventory obsolescence risk
Legal/contingent liabilities (if known)
Seasonality indicators

23) "Owner/Operator" Specific Metrics (SMB-focused but Big 4-presentable)
Owner draws/distributions as % of EBITDA or CFO
Owner compensation normalization (for true operating performance)
Personal vs business expense leakage indicators
Break-even revenue and "safe draw" level
Cash buffer target (months of fixed costs)

24) Forecasting & Forward-Looking Metrics (often included in month-end packs)
Rolling 3/6/12-month forecast
Forecast accuracy (MAPE, bias)
Scenario cases (base / upside / downside)
Sensitivity analysis (what happens if revenue ±10%, labor ±5%, etc.)

Output requirements (strict)
Use tables for metrics and bridges.
Every section must end with: Key Takeaways (3–5 bullets) + Questions for Management (2–5 bullets).
Never invent comparators. If budget/forecast/prior isn't present, say so and proceed with what's available.`;

// =============================================================================
// EXAMPLE REPORT (Reference for formatting and quality)
// =============================================================================

const EXAMPLE_REPORT = `0. Cover Page
Client: Prospecting on Demand
Period reviewed: Month ended 31 October 2025 (based on "Weekly Financial Review" report date)
Basis: N/A — Data not provided (accrual vs cash basis not stated)
Currency: Assumed USD (workbook uses "$" formatting; currency label not explicitly stated)
Source file(s) used: Scalewerk Prospecting on Demand - Clever Financial Sheet.xlsx
Primary tabs used: PL - RAW; Dynamic PL; BS - RAW; Weekly Financial Review
Key limitations (impacting metrics):
Cash Flow Statement not provided → CFO/CFI/CFF, FCF, FCF conversion, runway/burn (cash-flow based) = N/A
Oct-2025 budget / forecast not provided (workbook contains budgeting frameworks, but Oct-2025 plan figures not populated/available for tie-out) → budget/forecast variance = N/A
No customer-level revenue → customer concentration, new vs existing, churn/retention = N/A
No AR/AP aging detail → DSO/DPO aging-based KPIs = N/A / limited
Method aligned to Scalewerk operating standards.

1. Executive Snapshot (MTD / QTD / YTD / TTM)
1.1 Executive KPI Summary (Actuals)
QTD reflects Q4-to-date (Oct only). TTM reflects Nov 2024 – Oct 2025 (12 months).

| Metric | MTD (Oct-25) | QTD | YTD (Jan–Oct-25) | TTM |
|--------|--------------|-----|------------------|-----|
| Revenue | $110.1K | $110.1K | $1,059.6K | $1,292.3K |
| Gross Profit | $109.9K | $109.9K | $1,057.0K | $1,288.8K |
| Gross Margin | 99.9% | 99.9% | 99.8% | 99.7% |
| EBITDA | $16.0K | $16.0K | $173.4K | $177.3K |
| EBITDA Margin | 14.5% | 14.5% | 16.4% | 13.7% |
| EBIT (Operating Income) | $16.0K | $16.0K | $173.4K | $177.3K |
| EBIT Margin | 14.5% | 14.5% | 16.4% | 13.7% |
| Net Income | $15.8K | $15.8K | $179.6K | $225.1K |
| Net Margin | 14.4% | 14.4% | 17.0% | 17.4% |
| Free Cash Flow (FCF) | N/A — Data not provided | N/A | N/A | N/A |
| FCF Margin | N/A — Data not provided | N/A | N/A | N/A |

Tie-out checks (Oct-25):
Revenue – COGS = Gross Profit: $110,050.09 – $116.90 = $109,933.19 ✅
Gross Profit – Total Expenses = Operating Income: $109,933.19 – $93,930.99 = $16,002.20 ✅
Operating Income + Net Other Income = Net Income: $16,002.20 + (–$171.00) = $15,831.20 ✅

1.2 Cash, Net Cash / Debt, and Working Capital (Month-end)

| Metric (as of month-end) | Oct-25 | Sep-25 | Δ ($) |
|--------------------------|--------|--------|-------|
| Cash balance (bank accounts) | $229.2K | $217.8K | $11.4K |
| Total debt (credit cards) | $39.2K | $30.2K | $8,960 |
| Net cash / (net debt) | $190.0K | $187.6K | $2,435 |
| Working capital | $184.3K | $181.8K | $2,435 |
| Current ratio | 5.1x | 6.1x | -1.0x |
| Quick ratio | 5.1x | 6.1x | -1.0x |
| Cash coverage (months of total expenses)* | 2.44 mo | 2.92 mo | N/A |

*Cash coverage uses each month's total expenses as denominator; change column not meaningful.

1.3 Materiality & Variance Count
Materiality threshold (default rule):
ABS(variance) ≥ max(5% of Revenue MTD, 10% of EBITDA MTD, $10,000)
= max($5.5K, $1.6K, $10.0K) = $10.0K

Material variance count (MTD):
vs Prior Month (Sep-25): 4 (Labor, Total Expenses, EBITDA/EBIT, Net Income)
vs Prior Year (Oct-24): 5 (Revenue, Gross Profit, EBITDA/EBIT, Net Income, Net Other Income)
vs Budget / Forecast: N/A — Data not provided for Oct-25 plan

1.4 Top Executive Insights (with numeric callouts)
1. Revenue $110.1K in Oct-25, up $5,918 (+5.7%) MoM and up $13,089 (+13.5%) YoY.
2. EBITDA $16.0K (14.5% margin), down $13.4K (–46.0%) MoM driven by OpEx +$19.3K outpacing revenue growth.
3. Labor $70.7K (64.3% of revenue), up $12.8K (+22.1%) MoM; key drivers: Employee payroll +$6.6K and Contractors +$6.2K.
4. Business Development spend $2,915, up from $153 in Sep-25 (primarily Meals $1,434 and Travel $1,482).
5. Net income $15.8K, down $13.6K (–46.2%) MoM and down $12.5K (–44.2%) YoY. YoY decline is primarily due to Net Other Income: –$171 (Oct-25) vs +$29.3K (Oct-24).
6. Revenue is highly concentrated by revenue line: "ELITE and SCALE7" = $95.3K (86.6% of Oct revenue); Community = $13.6K (12.4%).
7. Liquidity remains strong on paper: gross cash $229.2K; after credit cards, net cash $190.0K; current ratio 5.1x.
8. Net cash improved +$2.4K MoM: cash + $11.4K, offset by credit cards + $9.0K.
9. Owner distributions of $12.0K in Oct (plus $1.4K personal expenses booked to equity) represent ~75% of Oct EBITDA.
10. COGS is de minimis ($117) (merchant fees classification). If delivery costs exist but sit in OpEx (e.g., contractors), gross margin may not reflect "true delivery margin."

Key Takeaways (Executive Snapshot)
- Oct-25 delivered positive EBITDA ($16.0K) but margin compressed MoM due to labor-driven OpEx growth.
- Business shows strong liquidity (net cash ~$190K) with ~2–2.5 months of expense coverage.
- Product-line concentration is high (top line = 86.6% of revenue), increasing volatility risk.
- YoY profitability optics are distorted by prior-year Other Income (profit share exclusions in Oct-24).

Questions for Management (Executive Snapshot)
- What specifically drove the $12.8K MoM increase in labor (headcount, rates, one-time contractor engagements)?
- Should contractor spend be treated as "delivery COGS" for a more decision-useful gross margin view?
- Confirm the intended definition of "cash on hand" for board reporting: gross cash vs net of credit cards.
- Is there an Oct-25 budget/forecast approved elsewhere that should be linked into this pack?

2. Revenue Performance
2.1 Revenue Trend (Last 6 Months)

| Month | Revenue | MoM Δ ($) | MoM Δ (%) |
|-------|---------|-----------|-----------|
| May 2025 | $116.9K | $12.2K | 11.6% |
| Jun 2025 | $76.5K | ($40.4K) | -34.6% |
| Jul 2025 | $122.3K | $45.8K | 59.8% |
| Aug 2025 | $80.0K | ($42.2K) | -34.5% |
| Sep 2025 | $104.1K | $24.1K | 30.1% |
| Oct 2025 | $110.1K | $5,918 | 5.7% |

Quarter context (completed quarters):
Q3-2025 revenue (Jul–Sep): $306.4K, up $8.3K (+2.8%) vs Q2-2025 (Apr–Jun): $298.2K
Q3-2025 vs Q3-2024: –$46.9K (–13.3%)

2.2 Revenue by Line (proxy for product/service lines)

| Revenue line | Oct-25 | % of Rev | Sep-25 | MoM Δ ($) | MoM Δ (%) | Oct-24 | YoY Δ ($) | YoY Δ (%) |
|--------------|--------|----------|--------|-----------|-----------|--------|-----------|-----------|
| ELITE and SCALE7 | $95.3K | 86.6% | $90.3K | $4,971 | 5.5% | $97.2K | ($1,916) | -2.0% |
| Community | $13.6K | 12.4% | $13.3K | $278 | 2.1% | $1,500 | $12.1K | 807.8% |
| Consulting Income | $1,106 | 1.0% | $1,051 | $55 | 5.2% | $1,097 | $9 | 0.8% |
| Sales | $1,124 | 1.0% | $1,051 | $73 | 6.6% | $1,051 | $73 | 6.9% |
| Refunds | $0 | 0.0% | ($597) | $597 | -100.0% | ($2,763) | $2,763 | -100.0% |

Observations
- Oct revenue mix is dominated by ELITE and SCALE7 (86.6%).
- The YoY revenue increase is largely attributable to Community (+$12.1K YoY).

2.3 Price / Volume / Mix (PVM), ASPs, Units, Pipeline, Bookings

| Metric | Status | What's missing (exact need) |
|--------|--------|----------------------------|
| Price / Volume / Mix decomposition | N/A — Data not provided | Units/volume drivers by product + pricing/ASP by product |
| Average selling price (ASP) | N/A — Data not provided | Units sold / memberships / contracts + revenue by SKU/plan |
| Units sold / billable hours / shipments | N/A — Data not provided | Operational volume tracker tied to month |
| Pipeline + bookings, win rate, cycle length | N/A — Data not provided | CRM pipeline export by stage, bookings definition, targets |

Key Takeaways (Revenue)
- Oct revenue grew +5.7% MoM and +13.5% YoY, but revenue is highly concentrated in a single line.
- Lack of operational "volume" data prevents PVM and efficiency diagnostics (ASP, units, rev/employee).

Questions for Management (Revenue)
- What operational driver best explains revenue (e.g., # clients closed, # community members) and where is it tracked?
- Is Community intended to be recurring/subscription? If yes, can we provide MRR/ARR style reporting?
- Any material customer(s) within ELITE and SCALE7 that drive concentration risk?

3. COGS & Gross Margin
3.1 COGS by Component (as classified)

| COGS component | Oct-25 | % of Revenue | Sep-25 | MoM Δ ($) | Oct-24 | YoY Δ ($) |
|----------------|--------|--------------|--------|-----------|--------|-----------|
| Merchant Processing Fees | $117 | 0.1% | $117 | $0 | $579 | ($462) |
| Total COGS | $117 | 0.1% | $117 | $0 | $579 | ($462) |
| Gross Profit | $109.9K | 99.9% | $104.0K | $5,918 | $96.4K | $13.6K |

Note: Contractor costs appear in Labor (OpEx) rather than COGS. If contractors are delivery costs, reclass would materially change "true gross margin."

3.2 Unit economics / utilization / hosting / freight / manufacturing metrics
N/A — Not applicable / data not provided (no units, utilization, hosting, freight, or manufacturing data in workbook)

Key Takeaways (COGS & Margin)
- Reported gross margin is ~99.9% due to minimal COGS classification.
- Gross margin may be overstated for decision-making if delivery costs sit in OpEx.

Questions for Management (COGS & Margin)
- Should any portion of contractor expenses be treated as COGS (delivery) for internal reporting?
- Are merchant fees intended to be in COGS or OpEx for management reporting consistency?

4. Operating Expenses
4.1 OpEx by Function (as available in chart of accounts)

| OpEx category | Oct-25 | % of Rev | Sep-25 | MoM Δ ($) | MoM Δ (%) | Oct-24 | YoY Δ ($) | YoY Δ (%) |
|---------------|--------|----------|--------|-----------|-----------|--------|-----------|-----------|
| Advertising & Marketing | $12.2K | 11.1% | $11.3K | $940 | 8.3% | $10.2K | $2,044 | 20.0% |
| Labor | $70.7K | 64.3% | $57.9K | $12.8K | 22.1% | $76.1K | ($5,316) | -7.0% |
| Fixed Overhead | $4,971 | 4.5% | $4,024 | $947 | 23.5% | $5,693 | ($723) | -12.7% |
| Variable Overhead | $3,061 | 2.8% | $1,192 | $1,869 | 156.8% | $1,791 | $1,270 | 70.9% |
| Business Development | $2,915 | 2.6% | $153 | $2,763 | 1811.3% | $3,613 | ($697) | -19.3% |
| Total Expenses | $93.9K | 85.4% | $74.6K | $19.3K | 25.9% | $97.4K | ($3,422) | -3.5% |

4.2 Labor detail (key driver)

| Labor component | Oct-25 | Sep-25 | MoM Δ ($) | MoM Δ (%) | Oct-24 | YoY Δ ($) | YoY Δ (%) |
|-----------------|--------|--------|-----------|-----------|--------|-----------|-----------|
| Officer Payroll | $6,997 | $6,997 | $0 | 0.0% | $13.5K | ($6,459) | -48.0% |
| Employee Payroll | $18.7K | $12.1K | $6,611 | 54.6% | $29.6K | ($10.8K) | -36.7% |
| Contractor Expenses | $44.8K | $38.6K | $6,226 | 16.1% | $32.8K | $12.0K | 36.6% |

Interpretation: Oct labor growth is split between higher employee payroll and increased contractor spend.

4.3 Notable OpEx components (Oct-25)
Advertising & Marketing largely comprised of:
- Facebook Ads: $8.8K
- Marketing Events: $2.8K

Business Development primarily:
- Meals: $1.4K
- Travel & Transportation: $1.5K

Fixed Overhead primarily:
- Software & Apps: $4.7K

4.4 Headcount / fully loaded cost / CAC-LTV / efficiency metrics
N/A — Data not provided.

Key Takeaways (OpEx)
- Labor is the dominant cost base (64.3% of revenue) and the primary MoM variance driver.
- OpEx mix indicates meaningful spending on contractors and paid acquisition (Facebook Ads).
- Without headcount and funnel data, efficiency metrics (CAC/LTV, rev/employee) remain N/A.

Questions for Management (OpEx)
- What explains the contractor increase (new engagements, higher rates, one-time projects)?
- Are Meals/Travel in Business Development tied to revenue outcomes?
- Can we add a simple monthly headcount + contractor hours tracker to support productivity KPIs?

5. Profitability & Bridges
5.1 Gross-to-Net Bridge (Oct-25)

| Bridge | Amount |
|--------|--------|
| Revenue | $110.1K |
| Less: COGS | ($117) |
| = Gross Profit | $109.9K |
| Less: Operating Expenses | ($93.9K) |
| = EBITDA / EBIT | $16.0K |
| Plus/(Less): Net Other Income | ($171) |
| = Net Income | $15.8K |

Adjusted EBITDA: N/A — Data not provided (no add-back schedule identified).

5.2 Operating Income Bridge (Sep-25 → Oct-25)

| Driver | Impact on NOI |
|--------|---------------|
| Net Operating Income (Sep-25) | $29.4K |
| Δ Gross Profit (Revenue/COGS) | $5,918 |
| Δ Advertising & Marketing expense | ($940) |
| Δ Labor expense | ($12.8K) |
| Δ Fixed Overhead expense | ($947) |
| Δ Variable Overhead expense | ($1,869) |
| Δ Business Development expense | ($2,763) |
| Net Operating Income (Oct-25) | $16.0K |

5.3 Margin bridge commentary (MoM)
EBITDA margin moved from 28.2% (Sep-25) to 14.5% (Oct-25) (–13.7 pts) as expenses scaled faster than revenue.

Key Takeaways (Profitability & Bridges)
- Profitability compression MoM is expense-driven, not revenue-driven.
- YoY comparisons of net income are affected by Other Income timing.

Questions for Management (Profitability & Bridges)
- Should we establish a standard "Adjusted EBITDA" policy?
- Are there any recurring "Other Income" items expected going forward?

6. Variance & Performance Management
6.1 MTD Variance Summary (Oct-25 vs Sep-25 and Oct-24)

| Line item | Oct-25 | Sep-25 | MoM Δ ($) | MoM Δ (%) | Oct-24 | YoY Δ ($) | YoY Δ (%) | Material?* |
|-----------|--------|--------|-----------|-----------|--------|-----------|-----------|------------|
| Revenue | $110.1K | $104.1K | $5,918 | 5.7% | $97.0K | $13.1K | 13.5% | YoY ✅ |
| Labor | $70.7K | $57.9K | $12.8K | 22.1% | $76.1K | ($5,316) | -7.0% | MoM ✅ |
| Total Expenses | $93.9K | $74.6K | $19.3K | 25.9% | $97.4K | ($3,422) | -3.5% | MoM ✅ |
| EBITDA / EBIT | $16.0K | $29.4K | ($13.4K) | -46.0% | ($972) | $17.0K | n/m | MoM ✅ / YoY ✅ |
| Net Other Income | ($171) | $0 | ($171) | N/A | $29.3K | ($29.5K) | -100.6% | YoY ✅ |
| Net Income | $15.8K | $29.4K | ($13.6K) | -46.2% | $28.4K | ($12.5K) | -44.2% | MoM ✅ / YoY ✅ |

*Material threshold = $10.0K for Oct-25

Key Takeaways (Variance & Performance)
- The month's story is margin compression driven by labor and discretionary spend.
- Plan-based performance management is limited because Oct budget/forecast isn't available.

Questions for Management (Variance & Performance)
- Was Oct labor/spend increase planned or unplanned?
- Can we confirm the "official" budget/forecast source for Oct-25?

7. Cash Flow & Liquidity
7.1 Cash Flow KPIs (CFO/CFI/CFF, FCF)
N/A — Data not provided (no cash flow statement in workbook).

7.2 Net cash movement proxy (from balance sheet)

| Cash bridge | Amount |
|-------------|--------|
| Net cash (Sep-25) | $187.6K |
| Δ Cash (bank accounts) | $11.4K |
| Δ Credit card debt | ($8,960) |
| Net cash (Oct-25) | $190.0K |

7.3 Liquidity ratios (Oct-25)
- Current ratio: 5.1x
- Quick ratio: 5.1x (no inventory; AR = $0)
- Cash ratio: 5.1x
- Covenants / revolver availability: N/A — Data not provided

Key Takeaways (Cash & Liquidity)
- Liquidity appears strong, with net cash ~$190K and high current/quick ratios.
- Without a cash flow statement, we cannot attribute cash changes to CFO vs investing vs financing.

Questions for Management (Cash & Liquidity)
- Can we add a monthly Cash Flow Statement export to complete CFO/FCF and runway metrics?
- Are credit card balances used as short-term working capital intentionally?

8. Balance Sheet Health
8.1 Asset quality (Oct-25)
- Total assets: $229.2K, comprised almost entirely of cash/bank balances.
- AR balance: $0 (implies no outstanding receivables at month-end).

8.2 Liability trends (Oct-25)
- Total liabilities: $45.0K, primarily:
  - Credit cards: $39.2K
  - Other current liabilities: ~$5.8K

8.3 Equity movement (Sep-25 → Oct-25)

| Equity rollforward | Amount |
|--------------------|--------|
| Equity (Sep-25) | $181.8K |
| Plus: Net income (Oct-25) | $15.8K |
| Less: Owner distributions | ($12.0K) |
| Less: Personal expenses booked to equity | ($1,396) |
| Equity (Oct-25) | $184.3K |

Key Takeaways (Balance Sheet)
- Balance sheet is clean and liquid (cash-heavy, minimal working capital complexity).
- Owner distributions are meaningful relative to monthly profitability.

Questions for Management (Balance Sheet)
- Is AR truly zero operationally, or is AR tracked outside QuickBooks?
- Should personal expenses be separated more clearly for "normalized" reporting?

9. Risk & Controls (Big 4 style, non-alarmist)
9.1 Key risks indicated by the provided data
- Revenue concentration risk: ~86.6% of Oct revenue is one revenue line.
- Margin compression risk: MoM EBITDA margin declined from 28.2% → 14.5%.
- Liquidity optics risk: "Cash on hand" can be gross ($229K) or net of credit cards ($190K).
- Classification risk: Minimal COGS may overstate gross margin if delivery costs are in OpEx.

9.2 Close / quality metrics
N/A — Data not provided.

Key Takeaways (Risk & Controls)
- Primary near-term risks are concentration and cost scaling discipline, not liquidity solvency.
- Standardizing definitions will improve board clarity and comparability.

Questions for Management (Risk & Controls)
- What is the preferred board definition for cash and net cash/debt?
- Are there policy standards for what should be treated as COGS vs OpEx?

10. Appendix
Appendix A — Metric Dictionary (Definitions Used)

| Metric | Definition used | Notes |
|--------|-----------------|-------|
| Revenue | "Total Income" from P&L | As classified in workbook |
| COGS | "Total Cost of Goods Sold" | Contains merchant fees |
| Gross Profit | Revenue – COGS | Tie-out performed |
| EBITDA | Operating income + D&A | D&A not present → EBITDA = EBIT |
| EBIT | Operating income ("Net Operating Income") | |
| Net Income | "Net Income" from P&L | Includes "Net Other Income" |
| Working Capital | Current Assets – Current Liabilities | From balance sheet |
| Net cash / (net debt) | Cash (bank) – debt | Debt = credit cards |
| TTM | Trailing twelve months ending Oct-25 | Nov-24 to Oct-25 |
| Material variance | ABS(variance) ≥ max(5% Rev, 10% EBITDA, $10K) | |

Appendix B — Source Mapping (Tab-level)

| Output area | Source tab(s) | What was pulled |
|-------------|---------------|-----------------|
| Income Statement | PL - RAW, Dynamic PL | Total Income, COGS, GP, Expenses, NOI, NI |
| Revenue by line | PL - RAW | Income accounts |
| Expense breakdown | PL - RAW | Category totals + key accounts |
| Cash / WC / ratios | BS - RAW | Bank Accounts, Credit Cards, Current Assets/Liabilities |
| Owner distributions | BS - RAW | Equity accounts |

Appendix C — Data Gaps & Recommended Next Data Adds (Prioritized)

Priority 1 (unlocks board-critical KPIs)
1. Monthly Cash Flow Statement (CFO/CFI/CFF) + capex detail
2. Approved Oct-25 budget and/or rolling forecast
3. Customer-level revenue detail

Priority 2 (improves operational insight)
4. Headcount roster by department
5. AR/AP aging reports
6. Operational volume drivers

Priority 3 (controls/close quality)
7. Close calendar + JE log + reconciliations tracker`;
