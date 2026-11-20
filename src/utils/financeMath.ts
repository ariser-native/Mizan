import type {
  BackupPayload,
  BudgetNotification,
  CategoryBreakdownItem,
  CategoryBudgetMap,
  CategoryId,
  CurrencyCode,
  DailySeriesPoint,
  ExchangeRates,
  Expense,
  MonthlySeriesPoint,
  PaymentMethod,
} from '../types/finance';
import {
  CURRENCY_CODES,
  DEFAULT_EXCHANGE_RATES,
  convertAmount,
  isValidCurrencyCode,
  sumExpensesInBase,
} from './currency';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food', label: 'Food & Dining', color: '#0F766E' },
  { id: 'housing', label: 'Housing & Rent', color: '#1D4ED8' },
  { id: 'transport', label: 'Transport & Fuel', color: '#D97706' },
  { id: 'utilities', label: 'Bills & Utilities', color: '#0284C7' },
  { id: 'health', label: 'Healthcare', color: '#DC2626' },
  { id: 'shopping', label: 'Shopping', color: '#7C3AED' },
  { id: 'entertainment', label: 'Leisure & Media', color: '#DB2777' },
  { id: 'education', label: 'Education & Books', color: '#059669' },
  { id: 'other', label: 'Other Expenses', color: '#64748B' },
];

export const CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Debit / Credit Card' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'wallet', label: 'Mobile Wallet' },
];

export const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTES_LENGTH = 400;

export function getCategoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${names[monthIdx]} ${String(year).slice(-2)}`;
}

export function formatLongMonth(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${names[monthIdx]} ${year}`;
}

export function getDaysInMonth(monthKey: string): number {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

export function getRecentMonthKeys(anchorMonth: string, count = 12): string[] {
  const [yStr, mStr] = anchorMonth.split('-');
  let year = Number(yStr);
  let month = Number(mStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

export function filterExpensesByMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter((e) => getMonthKey(e.date) === monthKey);
}

export function buildMonthlySeries(
  expenses: Expense[],
  anchorMonth: string,
  monthCount: number,
  monthlyBudget: number,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): MonthlySeriesPoint[] {
  const months = getRecentMonthKeys(anchorMonth, monthCount);
  const grouped = new Map<string, { spent: number; count: number }>();

  for (const m of months) {
    grouped.set(m, { spent: 0, count: 0 });
  }

  for (const exp of expenses) {
    const mKey = getMonthKey(exp.date);
    const bucket = grouped.get(mKey);
    if (bucket) {
      bucket.spent += convertAmount(exp.amount, exp.currency, baseCurrency, rates);
      bucket.count += 1;
    }
  }

  return months.map((m) => {
    const bucket = grouped.get(m)!;
    return {
      month: m,
      label: formatMonthLabel(m),
      spent: Math.round(bucket.spent * 100) / 100,
      budget: monthlyBudget,
      count: bucket.count,
    };
  });
}

export function buildDailySeries(
  monthExpenses: Expense[],
  monthKey: string,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): DailySeriesPoint[] {
  const totalDays = getDaysInMonth(monthKey);
  const byDay = new Array<number>(totalDays + 1).fill(0);

  for (const exp of monthExpenses) {
    if (getMonthKey(exp.date) !== monthKey) continue;
    const day = Number(exp.date.slice(8, 10));
    if (day >= 1 && day <= totalDays) {
      byDay[day] += convertAmount(exp.amount, exp.currency, baseCurrency, rates);
    }
  }

  let running = 0;
  const points: DailySeriesPoint[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const spent = Math.round(byDay[day] * 100) / 100;
    running = Math.round((running + spent) * 100) / 100;
    points.push({
      day,
      date: `${monthKey}-${String(day).padStart(2, '0')}`,
      spent,
      cumulative: running,
    });
  }
  return points;
}

export function buildCategoryBreakdown(
  monthExpenses: Expense[],
  categoryBudgets: CategoryBudgetMap,
  alertThresholdPct: number,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): CategoryBreakdownItem[] {
  const spentByCategory = new Map<CategoryId, { spent: number; count: number }>();
  for (const cat of CATEGORIES) {
    spentByCategory.set(cat.id, { spent: 0, count: 0 });
  }

  let grandTotal = 0;
  for (const exp of monthExpenses) {
    const converted = convertAmount(exp.amount, exp.currency, baseCurrency, rates);
    const entry = spentByCategory.get(exp.category) ?? spentByCategory.get('other')!;
    entry.spent += converted;
    entry.count += 1;
    grandTotal += converted;
  }

  return CATEGORIES.map((cat) => {
    const entry = spentByCategory.get(cat.id)!;
    const spent = Math.round(entry.spent * 100) / 100;
    const budgetLimit = categoryBudgets[cat.id] ?? 0;
    const utilizationPct = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 1000) / 10 : 0;
    const sharePct = grandTotal > 0 ? Math.round((spent / grandTotal) * 1000) / 10 : 0;

    let status: 'nominal' | 'warning' | 'exceeded' = 'nominal';
    if (budgetLimit > 0) {
      if (spent > budgetLimit) {
        status = 'exceeded';
      } else if (utilizationPct >= alertThresholdPct) {
        status = 'warning';
      }
    }

    return {
      category: cat.id,
      label: cat.label,
      color: cat.color,
      spent,
      budgetLimit,
      utilizationPct,
      sharePct,
      count: entry.count,
      status,
    };
  }).sort((a, b) => b.spent - a.spent);
}

export function evaluateBudgetAlerts(
  monthExpenses: Expense[],
  monthKey: string,
  monthlyBudget: number,
  categoryBudgets: CategoryBudgetMap,
  alertThresholdPct: number,
  baseCurrency: CurrencyCode,
  rates: ExchangeRates,
  existingReadIds: Set<string> = new Set()
): BudgetNotification[] {
  const notifications: BudgetNotification[] = [];
  const totalSpent = sumExpensesInBase(monthExpenses, baseCurrency, rates);

  if (monthlyBudget > 0) {
    const overallPct = Math.round((totalSpent / monthlyBudget) * 100);
    if (totalSpent > monthlyBudget) {
      const id = `overall-exceeded-${monthKey}`;
      notifications.push({
        id,
        scope: 'overall',
        title: 'Monthly budget exceeded',
        message: `Your ${formatLongMonth(monthKey)} spending reached ${overallPct}% of your monthly limit.`,
        severity: 'exceeded',
        utilizationPct: overallPct,
        month: monthKey,
        createdAt: new Date().toISOString(),
        read: existingReadIds.has(id),
      });
    } else if (overallPct >= alertThresholdPct) {
      const id = `overall-warning-${monthKey}`;
      notifications.push({
        id,
        scope: 'overall',
        title: 'Approaching monthly budget limit',
        message: `You have used ${overallPct}% of your ${formatLongMonth(monthKey)} budget.`,
        severity: 'warning',
        utilizationPct: overallPct,
        month: monthKey,
        createdAt: new Date().toISOString(),
        read: existingReadIds.has(id),
      });
    }
  }

  const breakdown = buildCategoryBreakdown(
    monthExpenses,
    categoryBudgets,
    alertThresholdPct,
    baseCurrency,
    rates
  );

  for (const item of breakdown) {
    if (item.budgetLimit <= 0) continue;
    if (item.status === 'exceeded') {
      const id = `cat-${item.category}-exceeded-${monthKey}`;
      notifications.push({
        id,
        scope: item.category,
        title: `${item.label} budget exceeded`,
        message: `${item.label} spending is at ${Math.round(item.utilizationPct)}% of its monthly cap.`,
        severity: 'exceeded',
        utilizationPct: Math.round(item.utilizationPct),
        month: monthKey,
        createdAt: new Date().toISOString(),
        read: existingReadIds.has(id),
      });
    } else if (item.status === 'warning') {
      const id = `cat-${item.category}-warning-${monthKey}`;
      notifications.push({
        id,
        scope: item.category,
        title: `${item.label} near limit`,
        message: `${item.label} reached ${Math.round(item.utilizationPct)}% of its monthly budget.`,
        severity: 'warning',
        utilizationPct: Math.round(item.utilizationPct),
        month: monthKey,
        createdAt: new Date().toISOString(),
        read: existingReadIds.has(id),
      });
    }
  }

  return notifications.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'exceeded' ? -1 : 1;
    return b.utilizationPct - a.utilizationPct;
  });
}

export function calculateSafeDailySpend(
  monthlyBudget: number,
  spentThisMonth: number,
  monthKey: string,
  referenceDate: Date = new Date()
): { remaining: number; daysRemaining: number; dailySafe: number } {
  const remaining = Math.max(0, monthlyBudget - spentThisMonth);
  const totalDays = getDaysInMonth(monthKey);
  const refMonth = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;

  let daysRemaining = totalDays;
  if (refMonth === monthKey) {
    daysRemaining = Math.max(1, totalDays - referenceDate.getDate() + 1);
  } else if (monthKey < refMonth) {
    daysRemaining = 1;
  }

  const dailySafe = remaining / daysRemaining;
  return {
    remaining: Math.round(remaining * 100) / 100,
    daysRemaining,
    dailySafe: Math.round(dailySafe * 100) / 100,
  };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function expensesToCsv(
  expenses: Expense[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRates
): string {
  const header = [
    'Date',
    'Title',
    'Category',
    'Amount',
    'Currency',
    `Converted (${baseCurrency})`,
    'Payment Method',
    'Notes',
  ];

  const rows = expenses.map((e) => {
    const converted = convertAmount(e.amount, e.currency, baseCurrency, rates);
    return [
      e.date,
      e.title,
      getCategoryMeta(e.category).label,
      e.amount.toFixed(2),
      e.currency,
      converted.toFixed(2),
      e.paymentMethod,
      e.notes ?? '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

export function sanitizeExpenseInput(raw: {
  id?: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  category: CategoryId;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}): { valid: true; data: Expense } | { valid: false; error: string } {
  const title = raw.title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) {
    return { valid: false, error: 'Title is required.' };
  }
  if (!Number.isFinite(raw.amount) || raw.amount <= 0 || raw.amount > 1_000_000_000) {
    return { valid: false, error: 'Amount must be a positive number.' };
  }
  if (!isValidCurrencyCode(raw.currency)) {
    return { valid: false, error: 'Invalid currency code.' };
  }
  if (!CATEGORY_IDS.includes(raw.category)) {
    return { valid: false, error: 'Invalid category.' };
  }
  if (!DATE_REGEX.test(raw.date)) {
    return { valid: false, error: 'Date must follow YYYY-MM-DD format.' };
  }
  if (!['cash', 'card', 'bank', 'wallet'].includes(raw.paymentMethod)) {
    return { valid: false, error: 'Invalid payment method.' };
  }
  const notes = raw.notes ? raw.notes.trim().slice(0, MAX_NOTES_LENGTH) : undefined;
  const id =
    raw.id && ID_REGEX.test(raw.id) && raw.id.length <= 128
      ? raw.id
      : `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    valid: true,
    data: {
      id,
      title,
      amount: Math.round(raw.amount * 100) / 100,
      currency: raw.currency,
      category: raw.category,
      date: raw.date,
      paymentMethod: raw.paymentMethod,
      ...(notes ? { notes } : {}),
    },
  };
}

export function validateBackupPayload(input: unknown): {
  valid: true;
  payload: BackupPayload;
} | {
  valid: false;
  error: string;
} {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Backup file is not a valid JSON object.' };
  }

  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.expenses)) {
    return { valid: false, error: 'Backup file is missing an expenses array.' };
  }

  const validExpenses: Expense[] = [];
  for (const item of obj.expenses) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const sanitized = sanitizeExpenseInput({
      id: typeof raw.id === 'string' ? raw.id : undefined,
      title: typeof raw.title === 'string' ? raw.title : '',
      amount: typeof raw.amount === 'number' ? raw.amount : Number(raw.amount),
      currency: isValidCurrencyCode(raw.currency) ? raw.currency : 'PKR',
      category: CATEGORY_IDS.includes(raw.category as CategoryId)
        ? (raw.category as CategoryId)
        : 'other',
      date: typeof raw.date === 'string' ? raw.date : '',
      paymentMethod: ['cash', 'card', 'bank', 'wallet'].includes(String(raw.paymentMethod))
        ? (raw.paymentMethod as PaymentMethod)
        : 'cash',
      notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    });
    if (sanitized.valid) {
      validExpenses.push(sanitized.data);
    }
  }

  if (obj.expenses.length > 0 && validExpenses.length === 0) {
    return { valid: false, error: 'No valid expense records found in backup file.' };
  }

  const rawBudgets =
    obj.categoryBudgets && typeof obj.categoryBudgets === 'object'
      ? (obj.categoryBudgets as Record<string, unknown>)
      : {};

  const categoryBudgets = {} as CategoryBudgetMap;
  for (const cat of CATEGORY_IDS) {
    const val = Number(rawBudgets[cat]);
    categoryBudgets[cat] = Number.isFinite(val) && val >= 0 ? val : 0;
  }

  const rawPrefs =
    obj.preferences && typeof obj.preferences === 'object'
      ? (obj.preferences as Record<string, unknown>)
      : {};

  const baseCurrency: CurrencyCode = isValidCurrencyCode(rawPrefs.baseCurrency)
    ? rawPrefs.baseCurrency
    : 'PKR';

  const monthlyBudget =
    typeof rawPrefs.monthlyBudget === 'number' && rawPrefs.monthlyBudget >= 0
      ? rawPrefs.monthlyBudget
      : 150000;

  const alertThresholdPct =
    typeof rawPrefs.alertThresholdPct === 'number' &&
    rawPrefs.alertThresholdPct >= 50 &&
    rawPrefs.alertThresholdPct <= 95
      ? rawPrefs.alertThresholdPct
      : 80;

  const exchangeRates: ExchangeRates = { ...DEFAULT_EXCHANGE_RATES };
  if (rawPrefs.exchangeRates && typeof rawPrefs.exchangeRates === 'object') {
    const rawRates = rawPrefs.exchangeRates as Record<string, unknown>;
    for (const code of CURRENCY_CODES) {
      const rate = Number(rawRates[code]);
      if (Number.isFinite(rate) && rate > 0 && rate <= 100_000) {
        exchangeRates[code] = rate;
      }
    }
  }

  return {
    valid: true,
    payload: {
      version: 1,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      appName: 'Mizan',
      expenses: validExpenses,
      categoryBudgets,
      preferences: {
        baseCurrency,
        monthlyBudget,
        alertThresholdPct,
        darkMode: Boolean(rawPrefs.darkMode),
        browserNotifications: Boolean(rawPrefs.browserNotifications),
        exchangeRates,
      },
    },
  };
}
