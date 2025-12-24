/**
 * Financial Number Formatting Utility
 *
 * Formats numbers in Big 4 / Investment Banking style:
 * - Negatives in parentheses and red
 * - Zeros as em-dash
 * - N/A values styled appropriately
 * - Tabular nums for alignment
 */

export interface FormattedNumber {
  text: string;
  isNegative: boolean;
  isPositive: boolean;
  isZero: boolean;
  isNA: boolean;
}

export function formatFinancialNumber(
  value: string | number | null | undefined,
  options?: {
    showSign?: boolean;
    type?: 'currency' | 'percent' | 'number';
  }
): FormattedNumber {
  // Handle N/A cases
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    String(value).toLowerCase().includes('n/a') ||
    String(value).toLowerCase().includes('data not provided') ||
    String(value).toLowerCase() === 'n/m' ||
    String(value).toLowerCase() === 'nm'
  ) {
    return { text: 'N/A', isNegative: false, isPositive: false, isZero: false, isNA: true };
  }

  const strValue = String(value).trim();

  // Check if it's just a dash or em-dash (already formatted as zero)
  if (strValue === '-' || strValue === '—' || strValue === '–') {
    return { text: '—', isNegative: false, isPositive: false, isZero: true, isNA: false };
  }

  // Check if negative (handles -, ($), (X%), etc.)
  const isNegative =
    (strValue.startsWith('-') && /\d/.test(strValue)) ||
    (strValue.startsWith('(') && strValue.endsWith(')')) ||
    strValue.includes('($') ||
    strValue.includes('-(');

  // Check if positive (has + sign)
  const isPositive = strValue.startsWith('+') && /\d/.test(strValue);

  // Parse the numeric value to check for zero
  const numericStr = strValue.replace(/[^0-9.-]/g, '');
  const numericValue = parseFloat(numericStr);
  const isZero = !isNaN(numericValue) && Math.abs(numericValue) < 0.01;

  // Format output
  let text = strValue;

  // Show em-dash for zero values (unless it's a percentage that should show 0.0%)
  if (isZero && !strValue.includes('%')) {
    text = '—';
    return { text, isNegative: false, isPositive: false, isZero: true, isNA: false };
  }

  // Convert negative formats to parentheses if not already
  if (isNegative && strValue.startsWith('-') && !strValue.startsWith('(')) {
    // Handle -$5.8K -> ($5.8K)
    if (strValue.includes('$')) {
      text = text.replace('-$', '($') + ')';
    }
    // Handle -47.3% -> (47.3%)
    else if (strValue.includes('%')) {
      text = '(' + text.replace('-', '') + ')';
    }
    // Handle plain numbers -5.8 -> (5.8)
    else {
      text = '(' + text.replace('-', '') + ')';
    }
  }

  return { text, isNegative, isPositive, isZero, isNA: false };
}

/**
 * Detect if a table cell contains a variance that should be highlighted
 */
export function isVarianceColumn(headerText: string): boolean {
  const header = headerText.toLowerCase();
  return (
    header.includes('var') ||
    header.includes('δ') ||
    header.includes('delta') ||
    header.includes('change') ||
    header.includes('mom') ||
    header.includes('yoy') ||
    header.includes('qtd') ||
    header.includes('ytd')
  );
}

/**
 * Check if a row is a total/subtotal row based on label
 */
export function isRowTotal(label: string): boolean {
  const lower = label.toLowerCase().trim();
  return (
    lower.startsWith('total') ||
    lower.startsWith('= ') ||
    lower.includes('net income') ||
    lower.includes('gross profit') ||
    lower.includes('ebitda') ||
    lower.includes('ebit') ||
    lower === 'net cash'
  );
}

/**
 * Check if a row is a subtotal row
 */
export function isRowSubtotal(label: string): boolean {
  const lower = label.toLowerCase().trim();
  return lower.startsWith('subtotal') || lower.startsWith('sub-total');
}

/**
 * Check if a row should be indented (sub-item)
 */
export function isSubItem(label: string): boolean {
  // Items that start with specific prefixes or are clearly sub-items
  return label.startsWith('  ') || label.startsWith('\t');
}
