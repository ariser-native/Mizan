import type { CurrencyCode, ExchangeRates, Expense } from '../types/finance';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs ', decimals: 0 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED ', decimals: 2 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR ', decimals: 2 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 0 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
};

export const CURRENCY_CODES: CurrencyCode[] = [
  'PKR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SAR',
  'INR',
  'CAD',
];

// Units per 1 USD
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  PKR: 278.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  INR: 84.4,
  CAD: 1.39,
};

export function isValidCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCY_CODES.includes(value as CurrencyCode);
}

/**
 * Converts an amount from `from` currency into `to` currency using USD-pegged rates.
 */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const fromRate = rates[from] && rates[from] > 0 ? rates[from] : DEFAULT_EXCHANGE_RATES[from];
  const toRate = rates[to] && rates[to] > 0 ? rates[to] : DEFAULT_EXCHANGE_RATES[to];
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

export function sumExpensesInBase(
  expenses: Expense[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  return expenses.reduce((total, exp) => {
    return total + convertAmount(exp.amount, exp.currency, baseCurrency, rates);
  }, 0);
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  compact = false
): string {
  const meta = CURRENCIES[currency] || CURRENCIES.USD;
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);

  if (compact) {
    if (abs >= 1_000_000) {
      return `${sign}${meta.symbol}${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 10_000) {
      return `${sign}${meta.symbol}${(abs / 1_000).toFixed(1)}K`;
    }
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(abs);

  return `${sign}${meta.symbol}${formatted}`;
}
