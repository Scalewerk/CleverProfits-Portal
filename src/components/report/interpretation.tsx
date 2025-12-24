/**
 * Interpretation Block Component
 * Styled callout for interpretive commentary
 */

interface InterpretationProps {
  children: React.ReactNode;
}

export function Interpretation({ children }: InterpretationProps) {
  return (
    <div className="interpretation">
      <span className="label">Interpretation: </span>
      {children}
    </div>
  );
}
