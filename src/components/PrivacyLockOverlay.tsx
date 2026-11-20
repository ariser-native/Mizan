import React, { useState } from 'react';
import { Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { PrivacyLockConfig } from '../types/finance';
import { verifyBiometricCredential, verifyPin } from '../utils/biometric';

interface PrivacyLockOverlayProps {
  config: PrivacyLockConfig;
  onUnlock: () => void;
}

export const PrivacyLockOverlay: React.FC<PrivacyLockOverlayProps> = ({
  config,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleBiometric = async () => {
    if (!config.biometricCredentialId) return;
    setChecking(true);
    setError(null);
    const res = await verifyBiometricCredential(config.biometricCredentialId);
    setChecking(false);
    if (res.ok) {
      onUnlock();
    } else {
      setError(res.error || 'Biometric verification failed. Use your Privacy PIN.');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.pinHash) {
      onUnlock();
      return;
    }
    setChecking(true);
    setError(null);
    const ok = await verifyPin(pin.trim(), config.pinHash);
    setChecking(false);
    if (ok) {
      setPin('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-lock-heading"
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 text-center shadow-2xl">
        <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-400">
          <LockKeyhole className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2
            id="privacy-lock-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Mizan Vault Locked
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Verify with biometrics or your Privacy PIN to view expenses and budgets.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {config.biometricCredentialId && (
          <button
            type="button"
            disabled={checking}
            onClick={handleBiometric}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-60 transition-colors"
          >
            <Fingerprint className="w-4 h-4" />
            {checking ? 'Verifying...' : 'Unlock with Biometrics'}
          </button>
        )}

        {config.pinHash && (
          <form onSubmit={handlePinSubmit} className="space-y-3 text-left">
            <div>
              <label
                htmlFor="unlock-pin-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Privacy PIN
              </label>
              <input
                id="unlock-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full px-3.5 py-2.5 text-center tracking-widest text-base font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={checking || !pin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Unlock with PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
