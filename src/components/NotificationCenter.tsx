import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import type { BudgetNotification } from '../types/finance';

interface NotificationCenterProps {
  open: boolean;
  notifications: BudgetNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onGoToBudgets: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  notifications,
  onClose,
  onMarkAllRead,
  onGoToBudgets,
}) => {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="absolute right-0 top-12 z-40 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden"
      role="region"
      aria-label="Budget Limit Notifications"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Budget Alerts
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {unreadCount > 0
              ? `${unreadCount} active unread reminder${unreadCount > 1 ? 's' : ''}`
              : 'All budget alerts reviewed'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Budgets are on track
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reminders appear here automatically when spending nears or exceeds your configured limits.
            </p>
          </div>
        ) : (
          notifications.map((note) => (
            <div
              key={note.id}
              className={`p-3.5 flex items-start gap-3 ${
                note.read
                  ? 'bg-white dark:bg-slate-900 opacity-75'
                  : 'bg-slate-50/70 dark:bg-slate-800/40'
              }`}
            >
              {note.severity === 'exceeded' ? (
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {note.title}
                  </p>
                  <span
                    className={`text-[11px] font-mono-num font-medium shrink-0 ${
                      note.severity === 'exceeded'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {note.utilizationPct}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {note.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
        <button
          type="button"
          onClick={() => {
            onClose();
            onGoToBudgets();
          }}
          className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
        >
          Manage Budget Limits
        </button>
      </div>
    </div>
  );
};
