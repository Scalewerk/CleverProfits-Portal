"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatFinancialNumber } from "@/lib/format-financial";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  content: {
    raw_markdown?: string;
    tables?: unknown[];
    insights?: string[];
    questions?: string[];
  };
  sectionName?: string; // Used to strip redundant title from markdown
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract text content from React children (handles nested elements)
function extractTextContent(children: React.ReactNode): string {
  if (children === null || children === undefined) {
    return '';
  }
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }
  if (React.isValidElement(children)) {
    // Extract text from element's children prop
    const props = children.props as { children?: React.ReactNode };
    return extractTextContent(props.children);
  }
  // Fallback for other objects - avoid [object Object]
  if (typeof children === 'object') {
    return '';
  }
  return String(children);
}

// Remove redundant title from markdown if it matches the section name
function removeRedundantTitle(content: string, sectionName?: string): string {
  if (!sectionName) return content;

  const escapedName = escapeRegex(sectionName);
  const patterns = [
    // Match ## 4. Section Name or # 4. Section Name
    new RegExp(`^#+\\s*\\d+\\.?\\s*${escapedName}\\s*\\n+`, 'i'),
    // Match ## Section Name or # Section Name (without number)
    new RegExp(`^#+\\s*${escapedName}\\s*\\n+`, 'i'),
    // Match **4. Section Name** or **Section Name**
    new RegExp(`^\\*\\*\\d*\\.?\\s*${escapedName}\\*\\*\\s*\\n+`, 'i'),
  ];

  let result = content;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

// Check if text is a checkmark or material indicator
function formatMaterialIndicator(value: string): { text: string; className: string } | null {
  const trimmed = value.trim();
  if (trimmed === '✓' || trimmed === '✅' || trimmed.toLowerCase() === 'yes') {
    return { text: trimmed, className: 'text-emerald-600 dark:text-emerald-400 font-medium' };
  }
  if (trimmed === '✗' || trimmed === '❌' || trimmed.toLowerCase() === 'no') {
    return { text: trimmed, className: 'text-red-600 dark:text-red-400' };
  }
  if (trimmed.toLowerCase() === 'n/a' || trimmed === '-' || trimmed === '—' || trimmed.toLowerCase() === 'n/m') {
    return { text: trimmed, className: 'financial-na' };
  }
  return null;
}

// Check if row label indicates a total row
function isTotalRow(label: string): boolean {
  const lower = label.toLowerCase().trim();
  return (
    lower.startsWith('total') ||
    lower.startsWith('= ') ||
    lower.includes('net income') ||
    lower.includes('gross profit') ||
    lower === 'ebitda' ||
    lower === 'ebit' ||
    lower === 'net cash'
  );
}

export function ReportSection({ content, sectionName }: ReportSectionProps) {
  // If we have raw markdown, render it
  if (content.raw_markdown) {
    return <MarkdownContent markdown={content.raw_markdown} sectionName={sectionName} />;
  }

  // Otherwise render structured content
  return (
    <div className="space-y-8">
      {/* Tables */}
      {content.tables && content.tables.length > 0 && (
        <div className="space-y-4">
          {content.tables.map((table, index) => (
            <TableRenderer key={index} table={table} />
          ))}
        </div>
      )}

      {/* Key Takeaways */}
      {content.insights && content.insights.length > 0 && (
        <KeyTakeawaysBox items={content.insights} />
      )}

      {/* Questions for Management */}
      {content.questions && content.questions.length > 0 && (
        <QuestionsBox items={content.questions} />
      )}

      {/* Empty state */}
      {!content.raw_markdown &&
        (!content.tables || content.tables.length === 0) &&
        (!content.insights || content.insights.length === 0) &&
        (!content.questions || content.questions.length === 0) && (
          <p className="text-muted-foreground italic">
            No content available for this section.
          </p>
        )}
    </div>
  );
}

// Big 4 styled Key Takeaways box
function KeyTakeawaysBox({ items }: { items: string[] }) {
  return (
    <div className="callout-takeaways">
      <div className="callout-header">Key Takeaways</div>
      <ul className="callout-list">
        {items.map((item, i) => (
          <li key={i}>
            <span className="callout-bullet">&#8226;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Big 4 styled Questions for Management box
function QuestionsBox({ items }: { items: string[] }) {
  return (
    <div className="callout-questions">
      <div className="callout-header">Questions for Management</div>
      <ul className="callout-list">
        {items.map((item, i) => (
          <li key={i}>
            <span className="callout-bullet">?</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Executive Insights box (for numbered insights) - renders markdown in each item
function ExecutiveInsightsBox({ items }: { items: string[] }) {
  return (
    <div className="executive-insights">
      <div className="executive-insights-header">Top Executive Insights</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="insight-item">
            <span className="insight-number">{i + 1}</span>
            <div className="insight-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <span>{children}</span>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic">{children}</em>
                  ),
                  // Prevent nested lists/blocks
                  ul: ({ children }) => <span>{children}</span>,
                  ol: ({ children }) => <span>{children}</span>,
                  li: ({ children }) => <span>{children}</span>,
                }}
              >
                {item}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple table renderer for structured data
function TableRenderer({ table }: { table: unknown }) {
  const t = table as {
    title?: string;
    headers?: string[];
    rows?: { cells?: { value: string; isPositive?: boolean; isNegative?: boolean }[] }[];
  };

  if (!t.headers || !t.rows) {
    return null;
  }

  return (
    <div className="space-y-2">
      {t.title && <h4 className="subsection-header">{t.title}</h4>}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="financial-table">
          <thead>
            <tr>
              {t.headers.map((header, i) => (
                <th key={i}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row, rowIndex) => {
              const firstCellValue = row.cells?.[0]?.value || '';
              const isTotal = isTotalRow(firstCellValue);

              return (
                <tr key={rowIndex} className={isTotal ? 'row-total' : ''}>
                  {row.cells?.map((cell, cellIndex) => {
                    // First column is label
                    if (cellIndex === 0) {
                      return <td key={cellIndex}>{cell.value}</td>;
                    }

                    // Format financial numbers
                    const formatted = formatFinancialNumber(cell.value);

                    return (
                      <td
                        key={cellIndex}
                        className={cn(
                          cell.isPositive && 'financial-positive',
                          cell.isNegative && 'financial-negative',
                          formatted.isNegative && !cell.isPositive && 'financial-negative',
                          formatted.isZero && 'financial-zero',
                          formatted.isNA && 'financial-na'
                        )}
                      >
                        {formatted.text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Check if a line is an Executive Insights header (should be filtered out)
function isExecutiveInsightsHeader(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('executive insight') ||
    lower.includes('top insight') ||
    lower.includes('numeric callout') ||
    lower.includes('with callout')
  );
}

// Extract Executive Insights section and return remaining content
function extractExecutiveInsights(content: string): {
  insights: string[];
  remainingContent: string;
} {
  // Pattern to match the Executive Insights section header and the following list
  // Handles: "### 1.4 Top Executive Insights (with numeric callouts)"
  // Or: "**Top Executive Insights:**"
  // Followed by numbered list (1. item) or bullet list (- item)
  const sectionPattern = /(?:#{1,4}\s*)?(?:\*\*)?(?:\d+\.?\d*\s+)?(?:Top\s+)?Executive\s+(?:Insights?|Summary)(?:\*\*)?[:\s]*(?:\([^)]*\))?\s*\n((?:(?:\d+\.|[-•*])\s+.+(?:\n|$))+)/gi;

  const match = sectionPattern.exec(content);

  if (!match) {
    return { insights: [], remainingContent: content };
  }

  // Extract individual insights from the matched block
  const insightsBlock = match[1] || '';
  const insights = insightsBlock
    .split(/\n/)
    .map(line => {
      // Remove leading number/bullet and clean up
      return line
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-•*]\s*/, '')
        .trim();
    })
    .filter(line => {
      // Filter out headers, empty lines, and invalid entries
      return (
        line.length > 0 &&
        !isExecutiveInsightsHeader(line)
      );
    });

  // Remove the entire matched section from content
  const remainingContent = content.replace(match[0], '\n');

  return { insights, remainingContent };
}

// Parse markdown and extract special sections
function parseSpecialSections(markdown: string): {
  content: string;
  keyTakeaways: string[];
  questions: string[];
  executiveInsights: string[];
} {
  let content = markdown;
  const keyTakeaways: string[] = [];
  const questions: string[] = [];

  // Extract Executive Insights first (most specific pattern)
  const { insights: executiveInsights, remainingContent: afterInsights } = extractExecutiveInsights(content);
  content = afterInsights;

  // Pattern to match Key Takeaways section
  const takeawaysPattern = /(?:#{1,4}\s*)?(?:\*\*)?Key\s+Takeaways(?:\*\*)?[:\s]*(?:\([^)]+\))?\s*\n((?:[-*•]\s*.+(?:\n|$))+)/gi;
  const takeawaysMatch = content.match(takeawaysPattern);
  if (takeawaysMatch) {
    takeawaysMatch.forEach(match => {
      const items = match.match(/[-*•]\s*(.+)/g);
      if (items) {
        items.forEach(item => {
          const text = item.replace(/^[-*•]\s*/, '').trim();
          if (text) keyTakeaways.push(text);
        });
      }
    });
    content = content.replace(takeawaysPattern, '\n');
  }

  // Pattern to match Questions for Management section
  const questionsPattern = /(?:#{1,4}\s*)?(?:\*\*)?Questions?\s+(?:for\s+)?Management(?:\*\*)?[:\s]*(?:\([^)]+\))?\s*\n((?:[-*•?]\s*.+(?:\n|$))+)/gi;
  const questionsMatch = content.match(questionsPattern);
  if (questionsMatch) {
    questionsMatch.forEach(match => {
      const items = match.match(/[-*•?]\s*(.+)/g);
      if (items) {
        items.forEach(item => {
          const text = item.replace(/^[-*•?]+\s*/, '').trim();
          if (text) questions.push(text);
        });
      }
    });
    content = content.replace(questionsPattern, '\n');
  }

  return { content: content.trim(), keyTakeaways, questions, executiveInsights };
}

// Markdown content renderer using react-markdown
function MarkdownContent({ markdown, sectionName }: { markdown: string; sectionName?: string }) {
  const { content: parsedContent, keyTakeaways, questions, executiveInsights } = parseSpecialSections(markdown);
  // Remove redundant title that matches the section header
  const content = removeRedundantTitle(parsedContent, sectionName);

  return (
    <div className="report-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Section headers (h1, h2 with numbers)
          h1: ({ children }) => {
            const text = String(children);
            const match = text.match(/^(\d+)\.\s*(.+)$/);
            if (match) {
              return (
                <div className="section-header">
                  <span className="section-number">{match[1]}</span>
                  <h2 className="section-title">{match[2]}</h2>
                </div>
              );
            }
            return (
              <h1 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100">
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const text = String(children);
            const match = text.match(/^(\d+)\.\s*(.+)$/);
            if (match) {
              return (
                <div className="section-header">
                  <span className="section-number">{match[1]}</span>
                  <h2 className="section-title">{match[2]}</h2>
                </div>
              );
            }
            return (
              <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const text = String(children);
            const lower = text.toLowerCase();
            // Suppress executive insights headers - they're rendered in the dedicated box
            if (lower.includes('executive insight') || lower.includes('top insight')) {
              return null;
            }
            // Check if this is a Key Takeaways or Questions header that wasn't caught
            if (lower.includes('key takeaways')) {
              return <div className="callout-header">Key Takeaways</div>;
            }
            if (lower.includes('questions') && lower.includes('management')) {
              return <div className="callout-header">Questions for Management</div>;
            }
            return <h3 className="subsection-header">{children}</h3>;
          },
          h4: ({ children }) => {
            const text = String(children).toLowerCase();
            // Suppress executive insights headers
            if (text.includes('executive insight') || text.includes('top insight')) {
              return null;
            }
            if (text.includes('key takeaway')) {
              return <div className="callout-header">Key Takeaways</div>;
            }
            if (text.includes('question')) {
              return <div className="callout-header">Questions for Management</div>;
            }
            return (
              <h4 className="text-sm font-semibold mt-4 mb-2 text-slate-700 dark:text-slate-300">
                {children}
              </h4>
            );
          },

          // Paragraphs - check for interpretation blocks
          p: ({ children }) => {
            const text = String(children);
            if (text.toLowerCase().startsWith('interpretation:')) {
              return (
                <div className="interpretation">
                  <span className="label">Interpretation:</span> {text.replace(/^interpretation:\s*/i, '')}
                </div>
              );
            }
            if (text.toLowerCase().startsWith('note:')) {
              return (
                <div className="interpretation">
                  <span className="label">Note:</span> {text.replace(/^note:\s*/i, '')}
                </div>
              );
            }
            if (text.toLowerCase().startsWith('observations')) {
              return (
                <div className="interpretation">
                  <span className="label">Observations:</span> {text.replace(/^observations:?\s*/i, '')}
                </div>
              );
            }
            return (
              <p className="text-slate-600 dark:text-slate-400 my-3 leading-relaxed">
                {children}
              </p>
            );
          },

          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="callout-list my-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="callout-list my-4">{children}</ol>
          ),
          li: ({ children }) => {
            // Separate text content from nested lists to fix spacing issues
            const childArray = React.Children.toArray(children);
            const textContent: React.ReactNode[] = [];
            const nestedLists: React.ReactNode[] = [];

            childArray.forEach(child => {
              if (React.isValidElement(child)) {
                const type = child.type;
                // Check if it's a nested list (ul or ol element)
                if (type === 'ul' || type === 'ol' ||
                    (typeof type === 'function' && (type.name === 'ul' || type.name === 'ol'))) {
                  nestedLists.push(child);
                } else {
                  textContent.push(child);
                }
              } else {
                textContent.push(child);
              }
            });

            return (
              <li>
                <span className="callout-bullet text-blue-700 dark:text-blue-400">&#8226;</span>
                <div className="flex-1 min-w-0">
                  <span>{textContent}</span>
                  {nestedLists.length > 0 && nestedLists}
                </div>
              </li>
            );
          },

          // Code blocks
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-slate-900 dark:text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm my-4">
              {children}
            </pre>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <div className="interpretation">{children}</div>
          ),

          // Tables - Big 4 styled
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="financial-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => {
            // Check if this is a total row by examining first cell
            const firstChild = React.Children.toArray(children)[0];
            let isTotal = false;
            if (React.isValidElement<{ children?: React.ReactNode }>(firstChild)) {
              const cellContent = extractTextContent(firstChild.props.children);
              isTotal = isTotalRow(cellContent);
            }
            return <tr className={isTotal ? 'row-total' : ''}>{children}</tr>;
          },
          th: ({ children }) => <th>{extractTextContent(children)}</th>,
          td: ({ children }) => {
            const text = extractTextContent(children);

            // Skip cells that are invalid objects
            if (text === '[object Object]' || text === '') {
              return <td className="financial-na">—</td>;
            }

            // Check for material indicators first (checkmarks, yes/no)
            const materialFormat = formatMaterialIndicator(text);
            if (materialFormat) {
              return <td className={materialFormat.className}>{materialFormat.text}</td>;
            }

            // Format financial numbers
            const formatted = formatFinancialNumber(text);

            return (
              <td className={cn(
                formatted.isNegative && 'financial-negative',
                formatted.isZero && 'financial-zero',
                formatted.isNA && 'financial-na'
              )}>
                {formatted.text}
              </td>
            );
          },

          hr: () => <hr className="my-8 border-slate-200 dark:border-slate-700" />,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Render Executive Insights if found */}
      {executiveInsights.length > 0 && <ExecutiveInsightsBox items={executiveInsights} />}

      {/* Render Key Takeaways if found */}
      {keyTakeaways.length > 0 && <KeyTakeawaysBox items={keyTakeaways} />}

      {/* Render Questions if found */}
      {questions.length > 0 && <QuestionsBox items={questions} />}
    </div>
  );
}
