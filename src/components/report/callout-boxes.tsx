/**
 * Callout Box Components
 * Key Takeaways and Questions for Management
 */

interface CalloutBoxProps {
  items: string[];
}

export function KeyTakeaways({ items }: CalloutBoxProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="callout-takeaways">
      <div className="callout-header">Key Takeaways</div>
      <ul className="callout-list">
        {items.map((item, index) => (
          <li key={index}>
            <span className="callout-bullet">&#8226;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuestionsForManagement({ items }: CalloutBoxProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="callout-questions">
      <div className="callout-header">Questions for Management</div>
      <ul className="callout-list">
        {items.map((item, index) => (
          <li key={index}>
            <span className="callout-bullet">?</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
