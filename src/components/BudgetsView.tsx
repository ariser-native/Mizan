import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, ShieldAlert } from 'lucide-react';
import type {
  CategoryBreakdownItem,
  CategoryBudgetMap,
  CategoryId,
  CurrencyCode,
} from '../types/finance';
import { formatMoney } from '../utils/currency';
import { CATEGORIES, formatLongMonth } from '../utils/financeMath';

interface BudgetsViewProps {
  selectedMonth: string;
  baseCurrency: CurrencyCode;
  monthlyBudget: number;
  alertThresholdPct: number;
  categoryBudgets: CategoryBudgetMap;
  categoryBreakdown: CategoryBreakdownItem[];
  totalSpent: number;
  onSaveOverallBudget: (monthlyBudget: number, alertThresholdPct: number) => void;
  onSaveCategoryBudget: (category: CategoryId, limit: number) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  selectedMonth,
  baseCurrency,
  monthlyBudget,
  alertThresholdPct,
  categoryBudgets,
  categoryBreakdown,
  totalSpent,
  onSaveOverallBudget,
  onSaveCategoryBudget,
}) => {
  const [overallInput, setOverallInput] = useState(String(monthlyBudget));
  const [thresholdInput, setThresholdInput] = useState(alertThresholdPct);
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setOverallInput(String(monthlyBudget));
    setThresholdInput(alertThresholdPct);
  }, [monthlyBudget, alertThresholdPct]);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of CATEGORIES) {
      map[c.id] = String(categoryBudgets[c.id] ?? 0);
    }
    setCatDrafts(map);
  }, [categoryBudgets]);

  const showSaved = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleSaveOverall = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(overallInput);
    if (!Number.isFinite(num) || num < 0) return;
    onSaveOverallBudget(num, thresholdInput);
    showSaved('Monthly budget cap and alert threshold updated.');
  };

  const handleSaveCategory = (category: CategoryId) => {
    const val = Number(catDrafts[category] ?? 0);
    if (!Number.isFinite(val) || val < 0) return;
    onSaveCategoryBudget(category, val);
    showSaved('Category budget limit saved.');
  };

  const overallPct = monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0;
  const allocatedSum = CATEGORIES.reduce(
    (sum, c) => sum + (categoryBudgets[c.id] ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Monthly Budgets & Alerts
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Configure spending caps and warning thresholds for {formatLongMonth(selectedMonth)}
          </p>
        </div>

        {savedMsg && (
          <div
            role="status"
            className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 px-3 py-2 rounded-lg"
          >
            {savedMsg}
          </div>
        )}
      </div>

      {/* Overall Monthly Cap Card */}
      <form
        onSubmit={handleSaveOverall}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Overall Monthly Spending Cap
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Spent {formatMoney(totalSpent, baseCurrency)} of {formatMoney(monthlyBudget, baseCurrency)} ({overallPct}%) · Category sum: {formatMoney(allocatedSum, baseCurrency)}
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors self-start md:self-auto whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Save Monthly Cap
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="overall-budget-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Monthly Budget Limit ({baseCurrency})
            </label>
            <input
              id="overall-budget-input"
              type="number"
              min="0"
              step="any"
              required
              value={overallInput}
              onChange={(e) => setOverallInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="alert-threshold-range"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Alert Notification Threshold
              </label>
              <span className="text-xs font-mono-num font-semibold text-teal-700 dark:text-teal-400">
                {thresholdInput}%
              </span>
            </div>
            <input
              id="alert-threshold-range"
              type="range"
              min={50}
              max={95}
              step={5}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Number(e.target.value))}
              className="w-full accent-teal-700"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Trigger a reminder notification when spending reaches {thresholdInput}% of a limit.
            </p>
          </div>
        </div>
      </form>

      {/* Per-Category Budgets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Category Monthly Limits
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track individual category budgets and receive targeted alerts
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {categoryBreakdown.map((item) => {
            const draftVal = catDrafts[item.category] ?? String(item.budgetLimit);
            const isDirty = Number(draftVal) !== item.budgetLimit;
            return (
              <div
                key={item.category}
                className="p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                        · {item.count} items
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        item.status === 'exceeded'
                          ? 'text-red-600 dark:text-red-400'
                          : item.status === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {item.status === 'exceeded' ? (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      ) : item.status === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {item.status === 'exceeded'
                        ? 'Exceeded'
                        : item.status === 'warning'
                        ? 'Near Limit'
                        : 'On Track'}
                      {item.budgetLimit > 0 && (
                        <span className="font-mono-num ml-1">
                          ({Math.round(item.utilizationPct)}%)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.status === 'exceeded'
                          ? 'bg-red-600 dark:bg-red-500'
                          : item.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-teal-600 dark:bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(100, item.utilizationPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono-num text-slate-600 dark:text-slate-400">
                    <span>Spent: {formatMoney(item.spent, baseCurrency)}</span>
                    <span>
                      Limit: {formatMoney(item.budgetLimit, baseCurrency)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor={`cat-budget-${item.category}`}
                    className="sr-only"
                  >
                    {item.label} budget limit
                  </label>
                  <input
                    id={`cat-budget-${item.category}`}
                    type="number"
                    min="0"
                    step="any"
                    value={draftVal}
                    onChange={(e) =>
                      setCatDrafts((prev) => ({
                        ...prev,
                        [item.category]: e.target.value,
                      }))
                    }
                    className="w-32 px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCategory(item.category)}
                    disabled={!isDirty}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    Update
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
