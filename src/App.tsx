import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  BarChart3,
  Bell,
  Cloud,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  PieChart,
  Plus,
  ReceiptText,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { auth } from './firebase';
import {
  deleteCloudExpense,
  ensureUserProfile,
  pushSnapshotToCloud,
  signInWithGoogle,
  signOutCloud,
  subscribeCloudData,
  updateCloudPreferences,
  upsertCloudCategoryBudget,
  upsertCloudExpense,
} from './services/cloudSync';
import type {
  AppPreferences,
  BackupPayload,
  CategoryBudgetMap,
  CategoryId,
  CurrencyCode,
  Expense,
  NavTab,
} from './types/finance';
import {
  CURRENCIES,
  CURRENCY_CODES,
  convertAmount,
  formatMoney,
  sumExpensesInBase,
} from './utils/currency';
import {
  CATEGORY_IDS,
  buildCategoryBreakdown,
  buildDailySeries,
  buildMonthlySeries,
  calculateSafeDailySpend,
  evaluateBudgetAlerts,
  filterExpensesByMonth,
  getMonthKey,
  getRecentMonthKeys,
} from './utils/financeMath';
import {
  createSeedExpenses,
  DEFAULT_CATEGORY_BUDGETS,
  DEFAULT_PREFERENCES,
} from './utils/seedData';
import { BudgetsView } from './components/BudgetsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExpenseModal } from './components/ExpenseModal';
import { ExpensesView } from './components/ExpensesView';
import { NotificationCenter } from './components/NotificationCenter';
import { OverviewView } from './components/OverviewView';
import { PrivacyLockOverlay } from './components/PrivacyLockOverlay';
import { ReportsView } from './components/ReportsView';
import { SettingsBackupView } from './components/SettingsBackupView';

const STORAGE_KEYS = {
  expenses: 'mizan_expenses_v1',
  budgets: 'mizan_category_budgets_v1',
  prefs: 'mizan_preferences_v1',
  readAlerts: 'mizan_read_alerts_v1',
};

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentMonthKey(): string {
  return getTodayIso().slice(0, 7);
}

function loadStoredJson<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function DashboardShell() {
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadStoredJson<Expense[]>(STORAGE_KEYS.expenses, () => createSeedExpenses())
  );
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetMap>(() => ({
    ...DEFAULT_CATEGORY_BUDGETS,
    ...loadStoredJson<Partial<CategoryBudgetMap>>(STORAGE_KEYS.budgets, () => ({})),
  }));
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    const saved = loadStoredJson<Partial<AppPreferences>>(STORAGE_KEYS.prefs, () => ({}));
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      exchangeRates: {
        ...DEFAULT_PREFERENCES.exchangeRates,
        ...(saved.exchangeRates ?? {}),
      },
      privacyLock: {
        ...DEFAULT_PREFERENCES.privacyLock,
        ...(saved.privacyLock ?? {}),
      },
    };
  });

  const [readAlertIds, setReadAlertIds] = useState<string[]>(() =>
    loadStoredJson<string[]>(STORAGE_KEYS.readAlerts, () => [])
  );

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return false;
    }
    const saved = loadStoredJson<Partial<AppPreferences>>(STORAGE_KEYS.prefs, () => ({}));
    const lock = saved.privacyLock;
    return Boolean(
      lock?.enabled && lock?.lockOnLoad && (lock.pinHash || lock.biometricCredentialId)
    );
  });

  const [user, setUser] = useState<User | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const hasMountedRef = useRef(false);

  // Persist locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
    } catch {
      // ignore storage quota errors
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(categoryBudgets));
    } catch {
      // ignore
    }
  }, [categoryBudgets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.readAlerts, JSON.stringify(readAlertIds));
    } catch {
      // ignore
    }
  }, [readAlertIds]);

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.darkMode);
  }, [preferences.darkMode]);

  // Firebase Auth + Real-Time Firestore Subscription
  useEffect(() => {
    let unsubData: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (unsubData) {
        unsubData();
        unsubData = null;
      }
      if (!nextUser) return;

      try {
        setCloudSyncing(true);
        setCloudError(null);
        const createdNew = await ensureUserProfile(nextUser, preferences);
        if (createdNew) {
          await pushSnapshotToCloud(nextUser, expenses, categoryBudgets, preferences);
        }
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        unsubData = subscribeCloudData(nextUser.uid, {
          onExpenses: (cloudExpenses) => {
            if (cloudExpenses.length > 0) {
              setExpenses(cloudExpenses);
              setLastSyncedAt(
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              );
            }
          },
          onCategoryBudgets: (cloudBudgets) => {
            if (Object.keys(cloudBudgets).length > 0) {
              setCategoryBudgets((prev) => ({ ...prev, ...cloudBudgets }));
            }
          },
          onPreferences: (cloudPrefs) => {
            setPreferences((prev) => ({
              ...prev,
              ...cloudPrefs,
              privacyLock: prev.privacyLock,
            }));
          },
        });
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : 'Cloud sync failed.');
      } finally {
        setCloudSyncing(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubData) unsubData();
    };
    // Intentionally subscribe once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMonthKey = getCurrentMonthKey();

  const availableMonths = useMemo(() => {
    const recent = getRecentMonthKeys(currentMonthKey, 12);
    const set = new Set(recent);
    for (const exp of expenses) {
      set.add(getMonthKey(exp.date));
    }
    set.add(selectedMonth);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentMonthKey, selectedMonth]);

  const monthExpenses = useMemo(
    () => filterExpensesByMonth(expenses, selectedMonth),
    [expenses, selectedMonth]
  );

  const totalSpent = useMemo(
    () =>
      sumExpensesInBase(
        monthExpenses,
        preferences.baseCurrency,
        preferences.exchangeRates
      ),
    [monthExpenses, preferences.baseCurrency, preferences.exchangeRates]
  );

  const { remaining, daysRemaining, dailySafe } = useMemo(
    () =>
      calculateSafeDailySpend(
        preferences.monthlyBudget,
        totalSpent,
        selectedMonth
      ),
    [preferences.monthlyBudget, totalSpent, selectedMonth]
  );

  const monthlySeries12 = useMemo(
    () =>
      buildMonthlySeries(
        expenses,
        currentMonthKey,
        12,
        preferences.monthlyBudget,
        preferences.baseCurrency,
        preferences.exchangeRates
      ),
    [
      expenses,
      currentMonthKey,
      preferences.monthlyBudget,
      preferences.baseCurrency,
      preferences.exchangeRates,
    ]
  );

  const monthlySeries6 = useMemo(
    () => monthlySeries12.slice(-6),
    [monthlySeries12]
  );

  const dailySeries = useMemo(
    () =>
      buildDailySeries(
        monthExpenses,
        selectedMonth,
        preferences.baseCurrency,
        preferences.exchangeRates
      ),
    [monthExpenses, selectedMonth, preferences.baseCurrency, preferences.exchangeRates]
  );

  const categoryBreakdown = useMemo(
    () =>
      buildCategoryBreakdown(
        monthExpenses,
        categoryBudgets,
        preferences.alertThresholdPct,
        preferences.baseCurrency,
        preferences.exchangeRates
      ),
    [
      monthExpenses,
      categoryBudgets,
      preferences.alertThresholdPct,
      preferences.baseCurrency,
      preferences.exchangeRates,
    ]
  );

  // Budget limit notifications evaluated on the active/current month
  const currentMonthExpenses = useMemo(
    () => filterExpensesByMonth(expenses, currentMonthKey),
    [expenses, currentMonthKey]
  );

  const notifications = useMemo(() => {
    const readSet = new Set(readAlertIds);
    return evaluateBudgetAlerts(
      currentMonthExpenses,
      currentMonthKey,
      preferences.monthlyBudget,
      categoryBudgets,
      preferences.alertThresholdPct,
      preferences.baseCurrency,
      preferences.exchangeRates,
      readSet
    );
  }, [
    currentMonthExpenses,
    currentMonthKey,
    preferences.monthlyBudget,
    categoryBudgets,
    preferences.alertThresholdPct,
    preferences.baseCurrency,
    preferences.exchangeRates,
    readAlertIds,
  ]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Trigger native browser notification when a new alert fires after initial mount
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevAlertIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    if (
      preferences.browserNotifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      for (const note of notifications) {
        if (!prevAlertIdsRef.current.has(note.id) && !note.read) {
          new Notification(note.title, { body: note.message });
        }
      }
    }
    prevAlertIdsRef.current = new Set(notifications.map((n) => n.id));
  }, [notifications, preferences.browserNotifications]);

  const handleSaveExpense = useCallback(
    (expense: Expense, isNew: boolean) => {
      setExpenses((prev) => {
        if (isNew) return [expense, ...prev];
        return prev.map((item) => (item.id === expense.id ? expense : item));
      });
      setSelectedMonth(getMonthKey(expense.date));
      if (user) {
        void upsertCloudExpense(user.uid, expense, isNew).catch((err) => {
          setCloudError(err instanceof Error ? err.message : 'Cloud write failed.');
        });
      }
    },
    [user]
  );

  const handleDeleteExpense = useCallback(
    (expense: Expense) => {
      setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
      if (user) {
        void deleteCloudExpense(user.uid, expense.id).catch((err) => {
          setCloudError(err instanceof Error ? err.message : 'Cloud delete failed.');
        });
      }
    },
    [user]
  );

  const handleUpdatePreferences = useCallback(
    (partial: Partial<AppPreferences>) => {
      const fromCurrency = preferences.baseCurrency;
      const toCurrency = partial.baseCurrency;
      const rates = partial.exchangeRates ?? preferences.exchangeRates;
      const isCurrencySwitch = Boolean(
        toCurrency && toCurrency !== fromCurrency && partial.monthlyBudget === undefined
      );

      setPreferences((prev) => {
        const nextRates = partial.exchangeRates ?? prev.exchangeRates;
        let nextMonthlyBudget = partial.monthlyBudget ?? prev.monthlyBudget;

        if (
          partial.baseCurrency &&
          partial.baseCurrency !== prev.baseCurrency &&
          partial.monthlyBudget === undefined
        ) {
          const decimals = CURRENCIES[partial.baseCurrency].decimals;
          const factor = Math.pow(10, decimals);
          nextMonthlyBudget =
            Math.round(
              convertAmount(
                prev.monthlyBudget,
                prev.baseCurrency,
                partial.baseCurrency,
                nextRates
              ) * factor
            ) / factor;
        }

        const next = {
          ...prev,
          ...partial,
          monthlyBudget: nextMonthlyBudget,
        };

        if (user) {
          void updateCloudPreferences(user.uid, next, user.displayName).catch((err) => {
            setCloudError(err instanceof Error ? err.message : 'Cloud update failed.');
          });
        }
        return next;
      });

      if (isCurrencySwitch && toCurrency) {
        const decimals = CURRENCIES[toCurrency].decimals;
        const factor = Math.pow(10, decimals);
        setCategoryBudgets((prevBudgets) => {
          const updated = { ...prevBudgets };
          for (const cat of CATEGORY_IDS) {
            updated[cat] =
              Math.round(
                convertAmount(prevBudgets[cat] ?? 0, fromCurrency, toCurrency, rates) *
                  factor
              ) / factor;
            if (user) {
              void upsertCloudCategoryBudget(user.uid, cat, updated[cat]).catch(() => {
                // handled on next sync
              });
            }
          }
          return updated;
        });
      }
    },
    [user, preferences.baseCurrency, preferences.exchangeRates]
  );

  const handleSaveOverallBudget = useCallback(
    (monthlyBudget: number, alertThresholdPct: number) => {
      handleUpdatePreferences({ monthlyBudget, alertThresholdPct });
    },
    [handleUpdatePreferences]
  );

  const handleSaveCategoryBudget = useCallback(
    (category: CategoryId, limit: number) => {
      setCategoryBudgets((prev) => ({ ...prev, [category]: limit }));
      if (user) {
        void upsertCloudCategoryBudget(user.uid, category, limit).catch((err) => {
          setCloudError(err instanceof Error ? err.message : 'Cloud budget save failed.');
        });
      }
    },
    [user]
  );

  const handleRestoreBackup = useCallback(
    (payload: BackupPayload, mode: 'replace' | 'merge') => {
      if (mode === 'replace') {
        setExpenses(payload.expenses);
        setCategoryBudgets(payload.categoryBudgets);
        handleUpdatePreferences({
          ...payload.preferences,
          privacyLock: preferences.privacyLock,
        });
      } else {
        setExpenses((prev) => {
          const map = new Map<string, Expense>();
          for (const e of prev) map.set(e.id, e);
          for (const e of payload.expenses) map.set(e.id, e);
          return Array.from(map.values()).sort((a, b) =>
            b.date.localeCompare(a.date)
          );
        });
      }
    },
    [handleUpdatePreferences, preferences.privacyLock]
  );

  const handleManualCloudSync = useCallback(async () => {
    if (!user) return;
    try {
      setCloudSyncing(true);
      setCloudError(null);
      await pushSnapshotToCloud(user, expenses, categoryBudgets, preferences);
      setLastSyncedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Cloud backup failed.');
    } finally {
      setCloudSyncing(false);
    }
  }, [user, expenses, categoryBudgets, preferences]);

  const handleSignInGoogle = useCallback(async () => {
    try {
      setCloudError(null);
      await signInWithGoogle();
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutCloud();
    setLastSyncedAt(null);
  }, []);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'expenses', label: 'Expenses', icon: <ReceiptText className="w-4 h-4" /> },
    { id: 'budgets', label: 'Budgets', icon: <PieChart className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Backup & Security', icon: <Settings className="w-4 h-4" /> },
  ];

  const activeNavMeta = navItems.find((n) => n.id === activeTab)!;
  const budgetPct =
    preferences.monthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / preferences.monthlyBudget) * 100))
      : 0;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Mizan
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Monthly Cap</span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                {budgetPct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 dark:bg-teal-500 rounded-full"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 truncate">
              {formatMoney(totalSpent, preferences.baseCurrency)} /{' '}
              {formatMoney(preferences.monthlyBudget, preferences.baseCurrency)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 truncate"
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {user ? 'Cloud Synced' : 'Local Backup'}
              </span>
            </button>

            {preferences.privacyLock.enabled && (
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                aria-label="Lock application"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <LockKeyhole className="w-3.5 h-3.5" />
                Lock
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="text-base font-bold font-display text-slate-900 dark:text-slate-100">
                Mizan
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="lg:hidden font-bold font-display text-slate-900 dark:text-slate-100 shrink-0">
                Mizan
              </span>
              <span className="hidden sm:inline lg:hidden text-slate-300 dark:text-slate-700">/</span>
              <span className="hidden sm:inline font-medium text-slate-700 dark:text-slate-300 truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <label htmlFor="header-currency-select" className="sr-only">
              Display Currency
            </label>
            <select
              id="header-currency-select"
              aria-label="Display Currency"
              value={preferences.baseCurrency}
              onChange={(e) =>
                handleUpdatePreferences({
                  baseCurrency: e.target.value as CurrencyCode,
                })
              }
              className="px-2.5 py-1.5 text-xs font-mono-num font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                handleUpdatePreferences({ darkMode: !preferences.darkMode })
              }
              aria-label={
                preferences.darkMode ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {preferences.darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="Budget Notifications"
                aria-expanded={notificationsOpen}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <NotificationCenter
                open={notificationsOpen}
                notifications={notifications}
                onClose={() => setNotificationsOpen(false)}
                onMarkAllRead={() =>
                  setReadAlertIds(notifications.map((n) => n.id))
                }
                onGoToBudgets={() => setActiveTab('budgets')}
              />
            </div>

            {preferences.privacyLock.enabled && (
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                aria-label="Lock App"
                className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LockKeyhole className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              aria-label="Add Expense"
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add Expense</span>
            </button>
          </div>
        </header>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onSelectMonth={setSelectedMonth}
              baseCurrency={preferences.baseCurrency}
              exchangeRates={preferences.exchangeRates}
              monthlyBudget={preferences.monthlyBudget}
              alertThresholdPct={preferences.alertThresholdPct}
              monthExpenses={monthExpenses}
              totalSpent={totalSpent}
              remaining={remaining}
              dailySafe={dailySafe}
              daysRemaining={daysRemaining}
              monthlySeries6={monthlySeries6}
              monthlySeries12={monthlySeries12}
              dailySeries={dailySeries}
              categoryBreakdown={categoryBreakdown}
              onAddExpense={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              onEditExpense={(exp) => {
                setEditingExpense(exp);
                setExpenseModalOpen(true);
              }}
              onDeleteExpense={handleDeleteExpense}
              onViewAllExpenses={() => setActiveTab('expenses')}
              onViewReports={() => setActiveTab('reports')}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onSelectMonth={setSelectedMonth}
              baseCurrency={preferences.baseCurrency}
              exchangeRates={preferences.exchangeRates}
              onAddExpense={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              onEditExpense={(exp) => {
                setEditingExpense(exp);
                setExpenseModalOpen(true);
              }}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsView
              selectedMonth={selectedMonth}
              baseCurrency={preferences.baseCurrency}
              monthlyBudget={preferences.monthlyBudget}
              alertThresholdPct={preferences.alertThresholdPct}
              categoryBudgets={categoryBudgets}
              categoryBreakdown={categoryBreakdown}
              totalSpent={totalSpent}
              onSaveOverallBudget={handleSaveOverallBudget}
              onSaveCategoryBudget={handleSaveCategoryBudget}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onSelectMonth={setSelectedMonth}
              baseCurrency={preferences.baseCurrency}
              exchangeRates={preferences.exchangeRates}
              monthExpenses={monthExpenses}
              monthlySeries12={monthlySeries12}
              dailySeries={dailySeries}
              categoryBreakdown={categoryBreakdown}
              totalSpent={totalSpent}
              monthlyBudget={preferences.monthlyBudget}
              user={user}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsBackupView
              user={user}
              cloudSyncing={cloudSyncing}
              lastSyncedAt={lastSyncedAt}
              cloudError={cloudError}
              expenses={expenses}
              categoryBudgets={categoryBudgets}
              preferences={preferences}
              onSignInGoogle={handleSignInGoogle}
              onSignOut={handleSignOut}
              onManualCloudSync={handleManualCloudSync}
              onUpdatePreferences={handleUpdatePreferences}
              onRestoreBackup={handleRestoreBackup}
              onLockNow={() => setIsLocked(true)}
            />
          )}
        </main>
      </div>

      {/* Modals & Privacy Overlay */}
      <ExpenseModal
        open={expenseModalOpen}
        initialExpense={editingExpense}
        defaultCurrency={preferences.baseCurrency}
        baseCurrency={preferences.baseCurrency}
        exchangeRates={preferences.exchangeRates}
        defaultDate={getTodayIso()}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
      />

      {isLocked && preferences.privacyLock.enabled && (
        <PrivacyLockOverlay
          config={preferences.privacyLock}
          onUnlock={() => setIsLocked(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardShell />
    </ErrorBoundary>
  );
}
