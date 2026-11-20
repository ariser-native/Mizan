import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  CategoryBreakdownItem,
  CurrencyCode,
  DailySeriesPoint,
  ExchangeRates,
  Expense,
  MonthlySeriesPoint,
} from '../types/finance';
import { convertAmount, formatMoney } from '../utils/currency';
import {
  PAYMENT_METHODS,
  expensesToCsv,
  formatLongMonth,
} from '../utils/financeMath';
import {
  CategoryDonutChart,
  DailyCashflowChart,
  MonthlyGraphChart,
} from './Charts';

interface ReportsViewProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRates;
  monthExpenses: Expense[];
  monthlySeries12: MonthlySeriesPoint[];
  dailySeries: DailySeriesPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  totalSpent: number;
  monthlyBudget: number;
  user?: User | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  availableMonths,
  onSelectMonth,
  baseCurrency,
  exchangeRates,
  monthExpenses,
  monthlySeries12,
  dailySeries,
  categoryBreakdown,
  totalSpent,
  monthlyBudget,
}) => {
  const prevMonthStats = useMemo(() => {
    const idx = monthlySeries12.findIndex((m) => m.month === selectedMonth);
    if (idx <= 0) return null;
    const prev = monthlySeries12[idx - 1];
    const diff = totalSpent - prev.spent;
    const pct = prev.spent > 0 ? Math.round((diff / prev.spent) * 100) : null;
    return { prevLabel: prev.label, prevSpent: prev.spent, diff, pct };
  }, [monthlySeries12, selectedMonth, totalSpent]);

  const peakDay = useMemo(() => {
    let best = { date: '—', spent: 0 };
    for (const d of dailySeries) {
      if (d.spent > best.spent) {
        best = { date: d.date, spent: d.spent };
      }
    }
    return best;
  }, [dailySeries]);

  const avgTransaction =
    monthExpenses.length > 0 ? totalSpent / monthExpenses.length : 0;

  const paymentSummary = useMemo(() => {
    return PAYMENT_METHODS.map((pm) => {
      const items = monthExpenses.filter((e) => e.paymentMethod === pm.id);
      const sum = items.reduce(
        (acc, e) => acc + convertAmount(e.amount, e.currency, baseCurrency, exchangeRates),
        0
      );
      return {
        ...pm,
        count: items.length,
        spent: sum,
        share: totalSpent > 0 ? (sum / totalSpent) * 100 : 0,
      };
    });
  }, [monthExpenses, baseCurrency, exchangeRates, totalSpent]);

  const handleExportMonthCsv = () => {
    const csv = expensesToCsv(monthExpenses, baseCurrency, exchangeRates);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mizan-report-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Detailed Financial Reports
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            12-month trend analysis and itemized breakdown for {formatLongMonth(selectedMonth)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <label htmlFor="report-month-select" className="sr-only">
            Report month
          </label>
          <select
            id="report-month-select"
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
          <button
            type="button"
            onClick={handleExportMonthCsv}
            disabled={monthExpenses.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Selected Month Total
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatMoney(totalSpent, baseCurrency)}
          </div>
          <div className="mt-1.5 text-xs font-mono-num text-slate-600 dark:text-slate-400">
            Budget Variance: {formatMoney(monthlyBudget - totalSpent, baseCurrency)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Month-over-Month Change
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {prevMonthStats
              ? `${prevMonthStats.diff >= 0 ? '+' : ''}${formatMoney(prevMonthStats.diff, baseCurrency)}`
              : '—'}
          </div>
          <div className="mt-1.5 text-xs font-mono-num text-slate-600 dark:text-slate-400">
            {prevMonthStats && prevMonthStats.pct !== null
              ? `${prevMonthStats.pct >= 0 ? '+' : ''}${prevMonthStats.pct}% vs ${prevMonthStats.prevLabel}`
              : 'No prior month data'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Peak Spending Day
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {peakDay.spent > 0 ? formatMoney(peakDay.spent, baseCurrency) : '—'}
          </div>
          <div className="mt-1.5 text-xs font-mono-num text-slate-600 dark:text-slate-400">
            {peakDay.spent > 0 ? peakDay.date : 'No transactions'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Average Expense Size
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatMoney(avgTransaction, baseCurrency)}
          </div>
          <div className="mt-1.5 text-xs font-mono-num text-slate-600 dark:text-slate-400">
            Across {monthExpenses.length} transactions
          </div>
        </div>
      </div>

      {/* 12-Month Full Graph */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            12-Month Spending & Budget Comparison
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Full-year monthly trajectory compared against your monthly budget target
          </p>
        </div>
        <MonthlyGraphChart
          data={monthlySeries12}
          selectedMonth={selectedMonth}
          onSelectMonth={onSelectMonth}
          currency={baseCurrency}
        />
      </section>

      {/* Daily Trend & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Daily Cashflow Curve ({formatLongMonth(selectedMonth)})
          </h2>
          <DailyCashflowChart data={dailySeries} currency={baseCurrency} />
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Category Share
          </h2>
          <CategoryDonutChart items={categoryBreakdown} currency={baseCurrency} />
        </section>
      </div>

      {/* Detailed Category & Payment Method Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Category Performance Statement
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Items</th>
                  <th className="py-3 px-4 text-right">Spent</th>
                  <th className="py-3 px-4 text-right">Budget</th>
                  <th className="py-3 px-4 text-right">Utilization</th>
                  <th className="py-3 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {categoryBreakdown.map((item) => (
                  <tr key={item.category}>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-400">
                      {item.count}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(item.spent, baseCurrency)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-400">
                      {formatMoney(item.budgetLimit, baseCurrency)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-num font-medium ${
                        item.status === 'exceeded'
                          ? 'text-red-600 dark:text-red-400'
                          : item.status === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {item.budgetLimit > 0 ? `${item.utilizationPct.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-400">
                      {item.sharePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Payment Channels
          </h2>
          <div className="space-y-3">
            {paymentSummary.map((pm) => (
              <div key={pm.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {pm.label} · {pm.count}
                  </span>
                  <span className="font-mono-num text-slate-900 dark:text-slate-100">
                    {formatMoney(pm.spent, baseCurrency)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 dark:bg-teal-500 rounded-full"
                    style={{ width: `${Math.min(100, pm.share)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
