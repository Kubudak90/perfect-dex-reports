import { formatUnits, parseUnits } from 'viem';

/**
 * Format a number with commas and specified decimals
 */
export function formatNumber(
  value: number | string,
  decimals: number = 2,
  compact: boolean = false
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0';

  if (compact) {
    return formatCompactNumber(num, decimals);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format number in compact notation (1.2K, 3.4M, etc.)
 */
export function formatCompactNumber(
  value: number,
  decimals: number = 2
): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

/**
 * Format USD currency
 */
export function formatCurrency(
  value: number | string,
  compact: boolean = false
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '$0.00';

  if (compact && num >= 1000) {
    return `$${formatCompactNumber(num, 2)}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format token amount from raw value (wei)
 */
export function formatTokenAmount(
  value: bigint,
  decimals: number,
  displayDecimals?: number
): string {
  const formatted = formatUnits(value, decimals);
  const num = parseFloat(formatted);

  if (num === 0) return '0';

  // Auto-adjust decimals based on value
  if (displayDecimals === undefined) {
    if (num >= 1000) displayDecimals = 2;
    else if (num >= 1) displayDecimals = 4;
    else if (num >= 0.0001) displayDecimals = 6;
    else displayDecimals = 8;
  }

  return formatNumber(formatted, displayDecimals);
}

/**
 * Parse token amount to raw value (wei)
 */
export function parseTokenAmount(value: string, decimals: number): bigint {
  try {
    // Remove commas and extra spaces
    const cleaned = value.replace(/,/g, '').trim();

    // Handle empty or invalid input
    if (!cleaned || cleaned === '.' || isNaN(parseFloat(cleaned))) {
      return 0n;
    }

    return parseUnits(cleaned, decimals);
  } catch (error) {
    return 0n;
  }
}

/**
 * Format percentage
 */
export function formatPercent(
  value: number,
  decimals: number = 2,
  includeSign: boolean = false
): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format address (0x1234...5678)
 */
export function formatAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length < startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Format time ago (5m, 2h, 3d)
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
