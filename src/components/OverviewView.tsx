import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pencil,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  CategoryBreakdownItem,
  CurrencyCode,
  DailySeriesPoint,
  ExchangeRates,
  Expense,
  MonthlySeriesPoint,
} from '../types/finance';
import { convertAmount, formatMoney } from '../utils/currency';
import { formatLongMonth, getCategoryMeta } from '../utils/financeMath';
import {
  CategoryDonutChart,
  DailyCashflowChart,
  MonthlyGraphChart,
} from './Charts';

interface OverviewViewProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRates;
  monthlyBudget: number;
  alertThresholdPct: number;
  monthExpenses: Expense[];
  totalSpent: number;
  remaining: number;
  dailySafe: number;
  daysRemaining: number;
  monthlySeries6: MonthlySeriesPoint[];
  monthlySeries12: MonthlySeriesPoint[];
  dailySeries: DailySeriesPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onViewAllExpenses: () => void;
  onViewReports: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  selectedMonth,
  availableMonths,
  onSelectMonth,
  baseCurrency,
  exchangeRates,
  monthlyBudget,
  alertThresholdPct,
  monthExpenses,
  totalSpent,
  remaining,
  dailySafe,
  daysRemaining,
  monthlySeries6,
  monthlySeries12,
  dailySeries,
  categoryBreakdown,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onViewAllExpenses,
  onViewReports,
}) => {
  const [graphSpan, setGraphSpan] = useState<'6m' | '12m'>('6m');

  const utilizationPct =
    monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0;

  const isExceeded = monthlyBudget > 0 && totalSpent > monthlyBudget;
  const isWarning = !isExceeded && monthlyBudget > 0 && utilizationPct >= alertThresholdPct;

  const topCategory = categoryBreakdown.find((c) => c.spent > 0) ?? null;
  const recentExpenses = [...monthExpenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Financial Overview
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Daily spending pace and monthly budget health for {formatLongMonth(selectedMonth)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label htmlFor="overview-month-select" className="sr-only">
            Select active month
          </label>
          <select
            id="overview-month-select"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatLongMonth(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Spent ({formatLongMonth(selectedMonth)})
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatMoney(totalSpent, baseCurrency)}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono-num">
            {monthExpenses.length} expense{monthExpenses.length === 1 ? '' : 's'} logged
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Budget
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                isExceeded
                  ? 'text-red-600 dark:text-red-400'
                  : isWarning
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isExceeded ? (
                <ShieldAlert className="w-3.5 h-3.5" />
              ) : isWarning ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {isExceeded ? 'Exceeded' : isWarning ? 'Near Limit' : 'On Track'}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatMoney(monthlyBudget, baseCurrency)}
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                isExceeded
                  ? 'bg-red-600 dark:bg-red-500'
                  : isWarning
                  ? 'bg-amber-500'
                  : 'bg-teal-600 dark:bg-teal-500'
              }`}
              style={{ width: `${Math.min(100, utilizationPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Remaining & Daily Safe Spend
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatMoney(remaining, baseCurrency)}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono-num">
            {formatMoney(dailySafe, baseCurrency)}/day over {daysRemaining}d left
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Top Spending Category
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {topCategory ? topCategory.label : 'No activity yet'}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono-num">
            {topCategory
              ? `${formatMoney(topCategory.spent, baseCurrency)} · ${topCategory.sharePct.toFixed(0)}% of month`
              : 'Log an expense to analyze'}
          </div>
        </div>
      </div>

      {/* Primary Graph Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Monthly Graph View
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any month bar to inspect its ledger and breakdown
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setGraphSpan('6m')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  graphSpan === '6m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                6 Months
              </button>
              <button
                type="button"
                onClick={() => setGraphSpan('12m')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  graphSpan === '12m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                12 Months
              </button>
            </div>
          </div>

          <MonthlyGraphChart
            data={graphSpan === '6m' ? monthlySeries6 : monthlySeries12}
            selectedMonth={selectedMonth}
            onSelectMonth={onSelectMonth}
            currency={baseCurrency}
          />
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Category Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share of spending in {formatLongMonth(selectedMonth)}
              </p>
            </div>
            <button
              type="button"
              onClick={onViewReports}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              Full Report
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <CategoryDonutChart items={categoryBreakdown} currency={baseCurrency} />
        </section>
      </div>

      {/* Daily Trend + Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Daily Expense Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Day-by-day totals for {formatLongMonth(selectedMonth)}
            </p>
          </div>
          <DailyCashflowChart data={dailySeries} currency={baseCurrency} />
        </section>

        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Recent Expenses
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest entries for {formatLongMonth(selectedMonth)}
              </p>
            </div>
            <button
              type="button"
              onClick={onViewAllExpenses}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              View Ledger
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No expenses logged in {formatLongMonth(selectedMonth)}.
              </p>
              <button
                type="button"
                onClick={onAddExpense}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors"
              >
                Log First Expense
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentExpenses.map((exp) => {
                const cat = getCategoryMeta(exp.category);
                const converted = convertAmount(
                  exp.amount,
                  exp.currency,
                  baseCurrency,
                  exchangeRates
                );
                return (
                  <div
                    key={exp.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {exp.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{cat.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{exp.date}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{exp.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-semibold font-mono-num text-slate-900 dark:text-slate-100">
                          {formatMoney(converted, baseCurrency)}
                        </div>
                        {exp.currency !== baseCurrency && (
                          <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                            {formatMoney(exp.amount, exp.currency)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditExpense(exp)}
                        aria-label={`Edit ${exp.title}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp)}
                        aria-label={`Delete ${exp.title}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
