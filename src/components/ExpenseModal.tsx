import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CategoryId,
  CurrencyCode,
  ExchangeRates,
  Expense,
  PaymentMethod,
} from '../types/finance';
import { CURRENCY_CODES, convertAmount, formatMoney } from '../utils/currency';
import {
  CATEGORIES,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  PAYMENT_METHODS,
  sanitizeExpenseInput,
} from '../utils/financeMath';

interface ExpenseModalProps {
  open: boolean;
  initialExpense: Expense | null;
  defaultCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRates;
  defaultDate: string;
  onClose: () => void;
  onSave: (expense: Expense, isNew: boolean) => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  open,
  initialExpense,
  defaultCurrency,
  baseCurrency,
  exchangeRates,
  defaultDate,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [category, setCategory] = useState<CategoryId>('food');
  const [date, setDate] = useState(defaultDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialExpense) {
      setTitle(initialExpense.title);
      setAmountStr(String(initialExpense.amount));
      setCurrency(initialExpense.currency);
      setCategory(initialExpense.category);
      setDate(initialExpense.date);
      setPaymentMethod(initialExpense.paymentMethod);
      setNotes(initialExpense.notes ?? '');
    } else {
      setTitle('');
      setAmountStr('');
      setCurrency(defaultCurrency);
      setCategory('food');
      setDate(defaultDate);
      setPaymentMethod('cash');
      setNotes('');
    }
    setError(null);
  }, [open, initialExpense, defaultCurrency, defaultDate]);

  if (!open) return null;

  const parsedAmount = Number(amountStr);
  const showConversion =
    currency !== baseCurrency && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const convertedPreview = showConversion
    ? convertAmount(parsedAmount, currency, baseCurrency, exchangeRates)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = sanitizeExpenseInput({
      id: initialExpense?.id,
      title,
      amount: Number(amountStr),
      currency,
      category,
      date,
      paymentMethod,
      notes,
    });

    if (res.valid === false) {
      setError(res.error);
      return;
    }

    onSave(res.data, !initialExpense);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id="expense-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {initialExpense ? 'Edit Expense' : 'Add Daily Expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense dialog"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="expense-title"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Expense Title
            </label>
            <input
              id="expense-title"
              type="text"
              required
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Grocery market, Fuel, Utility bill"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Amount
              </label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label
                htmlFor="expense-currency"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Currency
              </label>
              <select
                id="expense-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showConversion && (
            <p className="text-xs font-mono-num text-teal-700 dark:text-teal-400">
              Converted to base currency: {formatMoney(convertedPreview, baseCurrency)}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Category
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryId)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expense-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="expense-payment"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Payment Method
            </label>
            <select
              id="expense-payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="expense-notes"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Notes (optional)
            </label>
            <textarea
              id="expense-notes"
              rows={2}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Receipt reference, merchant, or memo"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              {initialExpense ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
