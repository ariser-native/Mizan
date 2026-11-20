export type CurrencyCode =
  | 'PKR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SAR'
  | 'INR'
  | 'CAD';

export type CategoryId =
  | 'food'
  | 'housing'
  | 'transport'
  | 'utilities'
  | 'health'
  | 'shopping'
  | 'entertainment'
  | 'education'
  | 'other';

export type PaymentMethod = 'cash' | 'card' | 'bank' | 'wallet';

export type ExchangeRates = Record<CurrencyCode, number>;

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  category: CategoryId;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CategoryBudgetMap = Record<CategoryId, number>;

export interface PrivacyLockConfig {
  enabled: boolean;
  biometricCredentialId: string | null;
  pinHash: string | null;
  lockOnLoad: boolean;
}

export interface AppPreferences {
  baseCurrency: CurrencyCode;
  monthlyBudget: number;
  alertThresholdPct: number; // 50..95
  darkMode: boolean;
  browserNotifications: boolean;
  exchangeRates: ExchangeRates;
  privacyLock: PrivacyLockConfig;
}

export interface BudgetNotification {
  id: string;
  scope: 'overall' | CategoryId;
  title: string;
  message: string;
  severity: 'warning' | 'exceeded';
  utilizationPct: number;
  month: string; // YYYY-MM
  createdAt: string;
  read: boolean;
}

export interface MonthlySeriesPoint {
  month: string; // YYYY-MM
  label: string; // e.g. Nov 26
  spent: number;
  budget: number;
  count: number;
}

export interface DailySeriesPoint {
  day: number;
  date: string;
  spent: number;
  cumulative: number;
}

export interface CategoryBreakdownItem {
  category: CategoryId;
  label: string;
  color: string;
  spent: number;
  budgetLimit: number;
  utilizationPct: number;
  sharePct: number;
  count: number;
  status: 'nominal' | 'warning' | 'exceeded';
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  appName: 'Mizan';
  expenses: Expense[];
  categoryBudgets: CategoryBudgetMap;
  preferences: Omit<AppPreferences, 'privacyLock'>;
}

export type NavTab = 'overview' | 'expenses' | 'budgets' | 'reports' | 'settings';
