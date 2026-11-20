import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXCHANGE_RATES,
  convertAmount,
  formatMoney,
  sumExpensesInBase,
} from './currency';
import {
  buildCategoryBreakdown,
  buildDailySeries,
  buildMonthlySeries,
  calculateSafeDailySpend,
  evaluateBudgetAlerts,
  expensesToCsv,
  sanitizeExpenseInput,
  validateBackupPayload,
} from './financeMath';
import { DEFAULT_CATEGORY_BUDGETS } from './seedData';
import type { Expense } from '../types/finance';

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'e1',
    title: 'Groceries',
    amount: 20000,
    currency: 'PKR',
    category: 'food',
    date: '2026-11-05',
    paymentMethod: 'card',
  },
  {
    id: 'e2',
    title: 'Cloud Plan',
    amount: 10,
    currency: 'USD',
    category: 'other',
    date: '2026-11-10',
    paymentMethod: 'card',
    notes: 'Monthly, recurring',
  },
  {
    id: 'e3',
    title: 'Rent',
    amount: 50000,
    currency: 'PKR',
    category: 'housing',
    date: '2026-10-01',
    paymentMethod: 'bank',
  },
];

test('convertAmount converts accurately across currencies', () => {
  assert.equal(convertAmount(100, 'USD', 'USD', DEFAULT_EXCHANGE_RATES), 100);
  const pkr = convertAmount(10, 'USD', 'PKR', DEFAULT_EXCHANGE_RATES);
  assert.equal(pkr, 2785);
  const backToUsd = convertAmount(pkr, 'PKR', 'USD', DEFAULT_EXCHANGE_RATES);
  assert.equal(Math.round(backToUsd * 100) / 100, 10);
});

test('sumExpensesInBase sums mixed currency expenses', () => {
  const novExpenses = SAMPLE_EXPENSES.filter((e) => e.date.startsWith('2026-11'));
  const total = sumExpensesInBase(novExpenses, 'PKR', DEFAULT_EXCHANGE_RATES);
  assert.equal(total, 22785);
});

test('formatMoney formats PKR and USD cleanly', () => {
  assert.equal(formatMoney(15000, 'PKR'), 'Rs 15,000');
  assert.equal(formatMoney(42.5, 'USD'), '$42.50');
  assert.equal(formatMoney(15000, 'PKR', true), 'Rs 15.0K');
});

test('buildMonthlySeries returns correct month buckets and totals', () => {
  const series = buildMonthlySeries(
    SAMPLE_EXPENSES,
    '2026-11',
    3,
    100000,
    'PKR',
    DEFAULT_EXCHANGE_RATES
  );
  assert.equal(series.length, 3);
  assert.equal(series[0].month, '2026-09');
  assert.equal(series[0].spent, 0);
  assert.equal(series[1].month, '2026-10');
  assert.equal(series[1].spent, 50000);
  assert.equal(series[2].month, '2026-11');
  assert.equal(series[2].spent, 22785);
});

test('buildDailySeries computes daily and cumulative totals', () => {
  const novExpenses = SAMPLE_EXPENSES.filter((e) => e.date.startsWith('2026-11'));
  const daily = buildDailySeries(novExpenses, '2026-11', 'PKR', DEFAULT_EXCHANGE_RATES);
  assert.equal(daily.length, 30);
  assert.equal(daily[4].spent, 20000);
  assert.equal(daily[9].spent, 2785);
  assert.equal(daily[9].cumulative, 22785);
});

test('evaluateBudgetAlerts fires warning and exceeded notifications accurately', () => {
  const heavyNov: Expense[] = [
    {
      id: 'h1',
      title: 'Big Dining',
      amount: 36000,
      currency: 'PKR',
      category: 'food',
      date: '2026-11-04',
      paymentMethod: 'card',
    },
    {
      id: 'h2',
      title: 'Utilities',
      amount: 55000,
      currency: 'PKR',
      category: 'utilities',
      date: '2026-11-05',
      paymentMethod: 'bank',
    },
  ];
  const alerts = evaluateBudgetAlerts(
    heavyNov,
    '2026-11',
    100000,
    DEFAULT_CATEGORY_BUDGETS,
    80,
    'PKR',
    DEFAULT_EXCHANGE_RATES
  );
  assert.ok(alerts.some((a) => a.scope === 'overall' && a.severity === 'warning'));
  assert.ok(alerts.some((a) => a.scope === 'food' && a.severity === 'exceeded'));
  assert.ok(alerts.some((a) => a.scope === 'utilities' && a.severity === 'exceeded'));
});

test('buildCategoryBreakdown calculates status and share percentages', () => {
  const novExpenses = SAMPLE_EXPENSES.filter((e) => e.date.startsWith('2026-11'));
  const breakdown = buildCategoryBreakdown(
    novExpenses,
    DEFAULT_CATEGORY_BUDGETS,
    80,
    'PKR',
    DEFAULT_EXCHANGE_RATES
  );
  const food = breakdown.find((b) => b.category === 'food')!;
  assert.equal(food.spent, 20000);
  assert.equal(food.status, 'nominal');
});

test('calculateSafeDailySpend returns remaining and daily allowance', () => {
  const res = calculateSafeDailySpend(100000, 40000, '2026-11', new Date(2026, 10, 21));
  assert.equal(res.remaining, 60000);
  assert.equal(res.daysRemaining, 10);
  assert.equal(res.dailySafe, 6000);
});

test('expensesToCsv properly escapes commas in notes', () => {
  const csv = expensesToCsv(SAMPLE_EXPENSES, 'PKR', DEFAULT_EXCHANGE_RATES);
  assert.ok(csv.includes('"Monthly, recurring"'));
  assert.ok(csv.startsWith('Date,Title,Category,Amount,Currency'));
});

test('sanitizeExpenseInput rejects invalid inputs and accepts valid ones', () => {
  const bad = sanitizeExpenseInput({
    title: '   ',
    amount: 500,
    currency: 'PKR',
    category: 'food',
    date: '2026-11-20',
    paymentMethod: 'cash',
  });
  assert.equal(bad.valid, false);

  const good = sanitizeExpenseInput({
    title: 'Tea & Snacks',
    amount: 450,
    currency: 'PKR',
    category: 'food',
    date: '2026-11-20',
    paymentMethod: 'cash',
  });
  assert.equal(good.valid, true);
});

test('validateBackupPayload validates and recovers clean backup data', () => {
  const res = validateBackupPayload({
    version: 1,
    exportedAt: '2026-11-20T00:00:00Z',
    expenses: SAMPLE_EXPENSES,
    categoryBudgets: DEFAULT_CATEGORY_BUDGETS,
    preferences: {
      baseCurrency: 'USD',
      monthlyBudget: 2000,
      alertThresholdPct: 85,
      darkMode: true,
    },
  });
  assert.equal(res.valid, true);
  if (res.valid) {
    assert.equal(res.payload.expenses.length, 3);
    assert.equal(res.payload.preferences.baseCurrency, 'USD');
    assert.equal(res.payload.preferences.darkMode, true);
  }
});
