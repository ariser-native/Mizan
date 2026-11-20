import React, { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type {
  CategoryId,
  CurrencyCode,
  ExchangeRates,
  Expense,
} from '../types/finance';
import { convertAmount, formatMoney, sumExpensesInBase } from '../utils/currency';
import {
  CATEGORIES,
  expensesToCsv,
  formatLongMonth,
  getCategoryMeta,
  getMonthKey,
} from '../utils/financeMath';

interface ExpensesViewProps {
  expenses: Expense[];
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRates;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  selectedMonth,
  availableMonths,
  onSelectMonth,
  baseCurrency,
  exchangeRates,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CategoryId>('all');
  const [monthFilter, setMonthFilter] = useState<'selected' | 'all'>('selected');
  const [sortBy, setSortBy] = useState<'date-desc' | 'amount-desc'>('date-desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((exp) => {
        if (monthFilter === 'selected' && getMonthKey(exp.date) !== selectedMonth) {
          return false;
        }
        if (categoryFilter !== 'all' && exp.category !== categoryFilter) {
          return false;
        }
        if (q) {
          const hay = `${exp.title} ${exp.notes ?? ''} ${getCategoryMeta(exp.category).label}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount-desc') {
          const ca = convertAmount(a.amount, a.currency, baseCurrency, exchangeRates);
          const cb = convertAmount(b.amount, b.currency, baseCurrency, exchangeRates);
          return cb - ca;
        }
        return b.date.localeCompare(a.date);
      });
  }, [expenses, monthFilter, selectedMonth, categoryFilter, search, sortBy, baseCurrency, exchangeRates]);

  const filteredTotal = useMemo(
    () => sumExpensesInBase(filtered, baseCurrency, exchangeRates),
    [filtered, baseCurrency, exchangeRates]
  );

  const handleExportCsv = () => {
    const csv = expensesToCsv(filtered, baseCurrency, exchangeRates);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mizan-expenses-${monthFilter === 'selected' ? selectedMonth : 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daily Expense Ledger
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Search, filter, edit, or export your recorded expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onAddExpense}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <label htmlFor="ledger-search" className="sr-only">
              Search expenses
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="ledger-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or notes..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="ledger-category-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="ledger-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | CategoryId)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="ledger-month-scope" className="sr-only">
              Month scope
            </label>
            <select
              id="ledger-month-scope"
              value={monthFilter === 'all' ? 'all' : selectedMonth}
              onChange={(e) => {
                if (e.target.value === 'all') {
                  setMonthFilter('all');
                } else {
                  setMonthFilter('selected');
                  onSelectMonth(e.target.value);
                }
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatLongMonth(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ledger-sort" className="sr-only">
              Sort expenses
            </label>
            <select
              id="ledger-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'amount-desc')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="date-desc">Newest First</option>
              <option value="amount-desc">Highest Amount</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-mono-num">
            Showing {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </span>
          <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
            Filtered Total: {formatMoney(filteredTotal, baseCurrency)}
          </span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {expenses.length === 0
                ? 'No expenses recorded yet'
                : 'No matching expenses found'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {expenses.length === 0
                ? 'Add your first daily expense to start tracking spending and budget alerts.'
                : 'Try clearing your search or selecting All Months.'}
            </p>
            {expenses.length === 0 ? (
              <button
                type="button"
                onClick={onAddExpense}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors"
              >
                Add First Expense
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                  setMonthFilter('all');
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount ({baseCurrency})</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((exp) => {
                  const cat = getCategoryMeta(exp.category);
                  const converted = convertAmount(
                    exp.amount,
                    exp.currency,
                    baseCurrency,
                    exchangeRates
                  );
                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono-num text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {exp.date}
                      </td>
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 capitalize whitespace-nowrap">
                        {exp.paymentMethod}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(converted, baseCurrency)}
                        </div>
                        {exp.currency !== baseCurrency && (
                          <div className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                            {formatMoney(exp.amount, exp.currency)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
