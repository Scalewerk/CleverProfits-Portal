/**
 * Section Header Components
 * Big 4 / Investment Banking style section headers
 */

interface SectionHeaderProps {
  number: number | string;
  title: string;
}

export function SectionHeader({ number, title }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <span className="section-number">{number}</span>
      <h2 className="section-title">{title}</h2>
    </div>
  );
}

export function SubsectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <h3 className="subsection-header">
      {number} {title}
    </h3>
  );
}
