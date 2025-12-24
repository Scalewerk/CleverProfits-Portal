/**
 * Executive Insights Component
 * Numbered insights with Big 4 styling
 */

interface ExecutiveInsightsProps {
  insights: string[];
}

export function ExecutiveInsights({ insights }: ExecutiveInsightsProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="executive-insights">
      <div className="executive-insights-header">Top Executive Insights</div>

      <div className="space-y-1">
        {insights.map((insight, index) => (
          <div key={index} className="insight-item">
            <span className="insight-number">{index + 1}</span>
            <p className="insight-text">
              <InsightText text={insight} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper to style metrics within insight text
 * Bolds the first part before comma or em-dash for emphasis
 */
function InsightText({ text }: { text: string }) {
  // Pattern: "Revenue $87.0K in Nov-25, down $23.0K (-20.9%) MoM"
  // Bold text before first comma or em-dash

  // Check if starts with a number (like "1. Revenue...")
  const cleanText = text.replace(/^\d+\.\s*/, '');

  const splitIndex = cleanText.search(/[,—–]/);

  if (splitIndex > 0 && splitIndex < 80) {
    const firstPart = cleanText.slice(0, splitIndex + 1);
    const rest = cleanText.slice(splitIndex + 1);

    return (
      <>
        <strong>{firstPart}</strong>
        <span>{rest}</span>
      </>
    );
  }

  return <span>{cleanText}</span>;
}
