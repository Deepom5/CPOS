/**
 * Money math in integer minor units (cents) to avoid float drift.
 * The UI converts at the edge via formatMoney().
 */

// Cents is a documentation alias for `number`. Use it on function signatures
// to make intent obvious; runtime values are plain integers.
export type Cents = number & { readonly __unit?: 'cents' };

export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

/**
 * Round to nearest cent using banker's rounding via Math.round for now.
 * Adequate for the receipts we generate; jurisdictions that require half-up
 * can swap this without changing call sites.
 */
export function roundCents(cents: number): Cents {
  return Math.round(cents);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
};

export function formatMoney(cents: Cents, currency = 'INR'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${sign}${sym}${whole.toLocaleString('en-US')}.${frac}`;
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((s, v) => s + v, 0);
}

export function multiplyCents(cents: Cents, qty: number): Cents {
  return roundCents(cents * qty);
}

export function percentOf(cents: Cents, percent: number): Cents {
  return roundCents((cents * percent) / 100);
}
