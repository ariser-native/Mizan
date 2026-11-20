import type {
  AppPreferences,
  CategoryBudgetMap,
  Expense,
} from '../types/finance';
import { DEFAULT_EXCHANGE_RATES } from './currency';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthOffsetDate(baseDate: Date, monthsBack: number, day: number): string {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() - monthsBack;
  const d = new Date(year, month, 1);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDay);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(clampedDay)}`;
}

export const DEFAULT_CATEGORY_BUDGETS: CategoryBudgetMap = {
  food: 35000,
  housing: 55000,
  transport: 18000,
  utilities: 16000,
  health: 12000,
  shopping: 15000,
  entertainment: 8000,
  education: 10000,
  other: 6000,
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  baseCurrency: 'PKR',
  monthlyBudget: 175000,
  alertThresholdPct: 80,
  darkMode: false,
  browserNotifications: false,
  exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
  privacyLock: {
    enabled: false,
    biometricCredentialId: null,
    pinHash: null,
    lockOnLoad: false,
  },
};

export function createSeedExpenses(anchor: Date = new Date()): Expense[] {
  const todayDay = Math.max(1, Math.min(anchor.getDate(), 28));

  return [
    // Current month (0 months back)
    {
      id: 'seed_exp_01',
      title: 'Monthly Apartment Rent',
      amount: 52000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 0, 1),
      paymentMethod: 'bank',
      notes: 'November residential lease transfer',
    },
    {
      id: 'seed_exp_02',
      title: 'Weekly Fresh Groceries',
      amount: 14200,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 0, Math.min(3, todayDay)),
      paymentMethod: 'card',
      notes: 'Produce, pantry staples, dairy',
    },
    {
      id: 'seed_exp_03',
      title: 'Electricity & Gas Utility Bill',
      amount: 14850,
      currency: 'PKR',
      category: 'utilities',
      date: monthOffsetDate(anchor, 0, Math.min(5, todayDay)),
      paymentMethod: 'wallet',
      notes: 'Paid via mobile banking',
    },
    {
      id: 'seed_exp_04',
      title: 'Cloud Storage & Workspace Plan',
      amount: 12,
      currency: 'USD',
      category: 'other',
      date: monthOffsetDate(anchor, 0, Math.min(7, todayDay)),
      paymentMethod: 'card',
      notes: 'Multi-currency recurring subscription',
    },
    {
      id: 'seed_exp_05',
      title: 'Fuel Refill & Commute',
      amount: 9600,
      currency: 'PKR',
      category: 'transport',
      date: monthOffsetDate(anchor, 0, Math.min(10, todayDay)),
      paymentMethod: 'cash',
    },
    {
      id: 'seed_exp_06',
      title: 'Family Dinner Out',
      amount: 11800,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 0, Math.min(14, todayDay)),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_07',
      title: 'Pharmacy & Checkup',
      amount: 6400,
      currency: 'PKR',
      category: 'health',
      date: monthOffsetDate(anchor, 0, Math.min(16, todayDay)),
      paymentMethod: 'cash',
    },
    {
      id: 'seed_exp_08',
      title: 'Online Course & Technical Books',
      amount: 24,
      currency: 'USD',
      category: 'education',
      date: monthOffsetDate(anchor, 0, Math.min(18, todayDay)),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_09',
      title: 'Specialty Coffee & Bakery',
      amount: 3250,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 0, todayDay),
      paymentMethod: 'wallet',
    },

    // 1 month back
    {
      id: 'seed_exp_10',
      title: 'Apartment Rent',
      amount: 52000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 1, 1),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_11',
      title: 'Groceries & Household Supply',
      amount: 29400,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 1, 8),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_12',
      title: 'Utilities & Fiber Internet',
      amount: 15600,
      currency: 'PKR',
      category: 'utilities',
      date: monthOffsetDate(anchor, 1, 12),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_13',
      title: 'Fuel & Car Maintenance',
      amount: 19200,
      currency: 'PKR',
      category: 'transport',
      date: monthOffsetDate(anchor, 1, 18),
      paymentMethod: 'cash',
    },
    {
      id: 'seed_exp_14',
      title: 'Winter Jacket & Footwear',
      amount: 14500,
      currency: 'PKR',
      category: 'shopping',
      date: monthOffsetDate(anchor, 1, 22),
      paymentMethod: 'card',
    },

    // 2 months back
    {
      id: 'seed_exp_15',
      title: 'Apartment Rent',
      amount: 52000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 2, 1),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_16',
      title: 'Groceries & Dining',
      amount: 33200,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 2, 11),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_17',
      title: 'Electricity Bill',
      amount: 18900,
      currency: 'PKR',
      category: 'utilities',
      date: monthOffsetDate(anchor, 2, 15),
      paymentMethod: 'wallet',
    },
    {
      id: 'seed_exp_18',
      title: 'Dental Clinic Visit',
      amount: 9500,
      currency: 'PKR',
      category: 'health',
      date: monthOffsetDate(anchor, 2, 20),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_19',
      title: 'Streaming & Cinema',
      amount: 5800,
      currency: 'PKR',
      category: 'entertainment',
      date: monthOffsetDate(anchor, 2, 24),
      paymentMethod: 'card',
    },

    // 3 months back
    {
      id: 'seed_exp_20',
      title: 'Apartment Rent',
      amount: 50000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 3, 1),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_21',
      title: 'Monthly Groceries',
      amount: 31000,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 3, 10),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_22',
      title: 'Utilities & Water',
      amount: 17400,
      currency: 'PKR',
      category: 'utilities',
      date: monthOffsetDate(anchor, 3, 14),
      paymentMethod: 'wallet',
    },
    {
      id: 'seed_exp_23',
      title: 'Commute & Rideshare',
      amount: 13800,
      currency: 'PKR',
      category: 'transport',
      date: monthOffsetDate(anchor, 3, 19),
      paymentMethod: 'wallet',
    },

    // 4 months back
    {
      id: 'seed_exp_24',
      title: 'Apartment Rent',
      amount: 50000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 4, 1),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_25',
      title: 'Food & Supermarket',
      amount: 28700,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 4, 9),
      paymentMethod: 'card',
    },
    {
      id: 'seed_exp_26',
      title: 'Summer Cooling Utility',
      amount: 21500,
      currency: 'PKR',
      category: 'utilities',
      date: monthOffsetDate(anchor, 4, 16),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_27',
      title: 'Weekend Trip & Fuel',
      amount: 22400,
      currency: 'PKR',
      category: 'entertainment',
      date: monthOffsetDate(anchor, 4, 25),
      paymentMethod: 'card',
    },

    // 5 months back
    {
      id: 'seed_exp_28',
      title: 'Apartment Rent',
      amount: 50000,
      currency: 'PKR',
      category: 'housing',
      date: monthOffsetDate(anchor, 5, 1),
      paymentMethod: 'bank',
    },
    {
      id: 'seed_exp_29',
      title: 'Food & Household',
      amount: 26500,
      currency: 'PKR',
      category: 'food',
      date: monthOffsetDate(anchor, 5, 12),
      paymentMethod: 'cash',
    },
    {
      id: 'seed_exp_30',
      title: 'Annual Certification Exam',
      amount: 120,
      currency: 'USD',
      category: 'education',
      date: monthOffsetDate(anchor, 5, 21),
      paymentMethod: 'card',
    },
  ];
}
