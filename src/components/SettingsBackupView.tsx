import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bell,
  Cloud,
  CloudUpload,
  Download,
  Fingerprint,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Upload,
} from 'lucide-react';
import type {
  AppPreferences,
  BackupPayload,
  CategoryBudgetMap,
  CurrencyCode,
  ExchangeRates,
  Expense,
} from '../types/finance';
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_EXCHANGE_RATES,
} from '../utils/currency';
import { expensesToCsv, validateBackupPayload } from '../utils/financeMath';
import {
  hashPin,
  isPlatformAuthenticatorAvailable,
  registerBiometricCredential,
} from '../utils/biometric';

interface SettingsBackupViewProps {
  user: User | null;
  cloudSyncing: boolean;
  lastSyncedAt: string | null;
  cloudError: string | null;
  expenses: Expense[];
  categoryBudgets: CategoryBudgetMap;
  preferences: AppPreferences;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onManualCloudSync: () => Promise<void>;
  onUpdatePreferences: (partial: Partial<AppPreferences>) => void;
  onRestoreBackup: (payload: BackupPayload, mode: 'replace' | 'merge') => void;
  onLockNow: () => void;
}

export const SettingsBackupView: React.FC<SettingsBackupViewProps> = ({
  user,
  cloudSyncing,
  lastSyncedAt,
  cloudError,
  expenses,
  categoryBudgets,
  preferences,
  onSignInGoogle,
  onSignOut,
  onManualCloudSync,
  onUpdatePreferences,
  onRestoreBackup,
  onLockNow,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('merge');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [platformBiometricReady, setPlatformBiometricReady] = useState(false);
  const [rateDrafts, setRateDrafts] = useState<Record<CurrencyCode, string>>(() => {
    const map = {} as Record<CurrencyCode, string>;
    for (const code of CURRENCY_CODES) {
      map[code] = String(preferences.exchangeRates[code] ?? DEFAULT_EXCHANGE_RATES[code]);
    }
    return map;
  });

  useEffect(() => {
    void isPlatformAuthenticatorAvailable().then(setPlatformBiometricReady);
  }, []);

  useEffect(() => {
    const map = {} as Record<CurrencyCode, string>;
    for (const code of CURRENCY_CODES) {
      map[code] = String(preferences.exchangeRates[code] ?? DEFAULT_EXCHANGE_RATES[code]);
    }
    setRateDrafts(map);
  }, [preferences.exchangeRates]);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleExportJson = () => {
    const { privacyLock: _ignored, ...safePrefs } = preferences;
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'Mizan',
      expenses,
      categoryBudgets,
      preferences: safePrefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mizan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', 'Full JSON backup file downloaded.');
  };

  const handleExportCsv = () => {
    const csv = expensesToCsv(
      expenses,
      preferences.baseCurrency,
      preferences.exchangeRates
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mizan-all-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', 'CSV spreadsheet exported.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = validateBackupPayload(parsed);
      if (res.valid === false) {
        notify('error', res.error);
        return;
      }
      onRestoreBackup(res.payload, restoreMode);
      notify(
        'success',
        `Restored ${res.payload.expenses.length} expenses (${restoreMode} mode).`
      );
    } catch {
      notify('error', 'Could not parse JSON backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    const nextRates = { ...preferences.exchangeRates } as ExchangeRates;
    for (const code of CURRENCY_CODES) {
      if (code === 'USD') {
        nextRates.USD = 1;
        continue;
      }
      const val = Number(rateDrafts[code]);
      if (!Number.isFinite(val) || val <= 0 || val > 100000) {
        notify('error', `Invalid exchange rate for ${code}.`);
        return;
      }
      nextRates[code] = val;
    }
    onUpdatePreferences({ exchangeRates: nextRates });
    notify('success', 'Multi-currency exchange rates updated.');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!/^[0-9]{4,8}$/.test(clean)) {
      notify('error', 'Privacy PIN must be 4 to 8 digits.');
      return;
    }
    const hashed = await hashPin(clean);
    onUpdatePreferences({
      privacyLock: {
        ...preferences.privacyLock,
        enabled: true,
        pinHash: hashed,
      },
    });
    setPinInput('');
    notify('success', 'Privacy PIN saved and lock protection enabled.');
  };

  const handleEnrollBiometric = async () => {
    const res = await registerBiometricCredential(user?.email || 'Mizan Vault');
    if (res.ok === false) {
      notify('error', res.error);
      return;
    }
    onUpdatePreferences({
      privacyLock: {
        ...preferences.privacyLock,
        enabled: true,
        biometricCredentialId: res.credentialId,
      },
    });
    notify('success', 'Device biometric passkey enrolled.');
  };

  const handleDisableLock = () => {
    onUpdatePreferences({
      privacyLock: {
        enabled: false,
        biometricCredentialId: null,
        pinHash: null,
        lockOnLoad: false,
      },
    });
    notify('success', 'Privacy lock disabled.');
  };

  const handleToggleBrowserNotifications = async () => {
    if (!preferences.browserNotifications) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      onUpdatePreferences({ browserNotifications: true });
      notify('success', 'Browser budget notifications enabled.');
    } else {
      onUpdatePreferences({ browserNotifications: false });
      notify('success', 'Browser budget notifications turned off.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Backup, Cloud & Security
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Cloud sync, JSON/CSV data export, multi-currency rates, dark mode, and biometric privacy lock
        </p>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
          }`}
        >
          {statusBanner.text}
        </div>
      )}

      {/* Cloud Backup Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Cloud Backup & Multi-Device Sync
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {user
                  ? `Signed in as ${user.email || user.displayName}${lastSyncedAt ? ` · Last synced ${lastSyncedAt}` : ''}`
                  : 'Sign in with Google to back up expenses, budgets, and currency preferences securely in Firestore.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {user ? (
              <>
                <button
                  type="button"
                  disabled={cloudSyncing}
                  onClick={onManualCloudSync}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <CloudUpload className="w-4 h-4" />
                  {cloudSyncing ? 'Syncing...' : 'Backup Now'}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
              >
                <Cloud className="w-4 h-4" />
                Connect Google Cloud Backup
              </button>
            )}
          </div>
        </div>

        {cloudError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
          >
            {cloudError}
          </div>
        )}
      </section>

      {/* Local Export & Restore */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Data Export & Local Backup Restore
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download spreadsheets for accounting or export/restore a complete JSON snapshot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export All CSV
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download JSON Backup
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label htmlFor="restore-mode-select" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Restore Mode:
            </label>
            <select
              id="restore-mode-select"
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value as 'replace' | 'merge')}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="merge">Merge with existing records</option>
              <option value="replace">Replace current data</option>
            </select>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload JSON backup file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Restore from JSON File
            </button>
          </div>
        </div>
      </section>

      {/* Biometric Lock & Privacy */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Fingerprint className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Biometric & Privacy Lock
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Status:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {preferences.privacyLock.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {preferences.privacyLock.biometricCredentialId && ' · Biometric Passkey Active'}
                {preferences.privacyLock.pinHash && ' · Privacy PIN Active'}
              </p>
            </div>
          </div>

          {preferences.privacyLock.enabled && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLockNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <LockKeyhole className="w-3.5 h-3.5" />
                Lock App Now
              </button>
              <button
                type="button"
                onClick={handleDisableLock}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
              >
                Disable Lock
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          <form onSubmit={handleSavePin} className="space-y-3">
            <label
              htmlFor="privacy-pin-setup"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {preferences.privacyLock.pinHash ? 'Change Privacy PIN (4–8 digits)' : 'Set Privacy PIN (4–8 digits)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="privacy-pin-setup"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,8}"
                maxLength={8}
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="e.g. 2468"
                className="flex-1 px-3.5 py-2 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 whitespace-nowrap"
              >
                Save PIN
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Device Biometric Unlock (Fingerprint / FaceID)
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleEnrollBiometric}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Fingerprint className="w-4 h-4" />
                {preferences.privacyLock.biometricCredentialId
                  ? 'Re-enroll Biometric'
                  : 'Enroll Biometric Passkey'}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {platformBiometricReady
                  ? 'Platform biometric sensor detected'
                  : 'PIN fallback ready on all browsers'}
              </span>
            </div>

            {preferences.privacyLock.enabled && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={preferences.privacyLock.lockOnLoad}
                  onChange={(e) =>
                    onUpdatePreferences({
                      privacyLock: {
                        ...preferences.privacyLock,
                        lockOnLoad: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Automatically require unlock when opening the app
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Multi-Currency & Exchange Rates */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Multi-Currency & Exchange Rates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose your primary reporting currency and customize conversion rates (units per 1 USD)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdatePreferences({ exchangeRates: { ...DEFAULT_EXCHANGE_RATES } });
              notify('success', 'Exchange rates reset to default values.');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Rates
          </button>
        </div>

        <form onSubmit={handleSaveRates} className="space-y-4">
          <div className="max-w-xs">
            <label
              htmlFor="settings-base-currency"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Primary Display Currency
            </label>
            <select
              id="settings-base-currency"
              value={preferences.baseCurrency}
              onChange={(e) =>
                onUpdatePreferences({ baseCurrency: e.target.value as CurrencyCode })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCIES[code].name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CURRENCY_CODES.map((code) => (
              <div key={code}>
                <label
                  htmlFor={`rate-${code}`}
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  {code} / 1 USD
                </label>
                <input
                  id={`rate-${code}`}
                  type="number"
                  step="any"
                  min="0.001"
                  disabled={code === 'USD'}
                  value={rateDrafts[code]}
                  onChange={(e) =>
                    setRateDrafts((prev) => ({ ...prev, [code]: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors"
          >
            Save Exchange Rates
          </button>
        </form>
      </section>

      {/* Theme & Notifications Preferences */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Appearance & Notifications
        </h2>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => onUpdatePreferences({ darkMode: !preferences.darkMode })}
            className="flex items-center justify-between gap-4 flex-1 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {preferences.darkMode ? (
                <Moon className="w-5 h-5 text-teal-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Dark Mode
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {preferences.darkMode ? 'Dark slate surface active' : 'Light canvas active'}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {preferences.darkMode ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleBrowserNotifications}
            className="flex items-center justify-between gap-4 flex-1 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Budget Limit Push Alerts
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Alert via browser when expenses reach {preferences.alertThresholdPct}%
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {preferences.browserNotifications ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
