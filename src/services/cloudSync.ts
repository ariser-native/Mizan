import {
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AppPreferences,
  CategoryBudgetMap,
  CategoryId,
  CurrencyCode,
  Expense,
} from '../types/finance';
import { CATEGORY_IDS, MAX_NOTES_LENGTH, MAX_TITLE_LENGTH } from '../utils/financeMath';
import { CURRENCY_CODES, DEFAULT_EXCHANGE_RATES, isValidCurrencyCode } from '../utils/currency';

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutCloud(): Promise<void> {
  await signOut(auth);
}

function buildSanitizedRates(rates: AppPreferences['exchangeRates']) {
  const clean: Record<string, number> = {};
  for (const code of CURRENCY_CODES) {
    const val = Number(rates[code]);
    clean[code] = Number.isFinite(val) && val > 0 && val <= 100000 ? val : DEFAULT_EXCHANGE_RATES[code];
  }
  return clean;
}

export async function ensureUserProfile(user: User, prefs: AppPreferences): Promise<boolean> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: (user.displayName || user.email || 'Mizan User').slice(0, 100),
        baseCurrency: prefs.baseCurrency,
        monthlyBudget: Math.max(0, Math.min(1_000_000_000, Number(prefs.monthlyBudget) || 0)),
        alertThresholdPct: Math.max(50, Math.min(95, Number(prefs.alertThresholdPct) || 80)),
        darkMode: Boolean(prefs.darkMode),
        browserNotifications: Boolean(prefs.browserNotifications),
        exchangeRates: buildSanitizedRates(prefs.exchangeRates),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return true;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateCloudPreferences(
  uid: string,
  prefs: AppPreferences,
  displayName?: string | null
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      ...(displayName ? { displayName: displayName.slice(0, 100) } : {}),
      baseCurrency: prefs.baseCurrency,
      monthlyBudget: Math.max(0, Math.min(1_000_000_000, Number(prefs.monthlyBudget) || 0)),
      alertThresholdPct: Math.max(50, Math.min(95, Number(prefs.alertThresholdPct) || 80)),
      darkMode: Boolean(prefs.darkMode),
      browserNotifications: Boolean(prefs.browserNotifications),
      exchangeRates: buildSanitizedRates(prefs.exchangeRates),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function upsertCloudExpense(
  uid: string,
  expense: Expense,
  isNew: boolean
): Promise<void> {
  const path = `users/${uid}/expenses/${expense.id}`;
  const ref = doc(db, 'users', uid, 'expenses', expense.id);
  const payload = {
    title: expense.title.trim().slice(0, MAX_TITLE_LENGTH),
    amount: Math.max(0.01, Math.min(1_000_000_000, Number(expense.amount))),
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    paymentMethod: expense.paymentMethod,
    ...(expense.notes ? { notes: expense.notes.trim().slice(0, MAX_NOTES_LENGTH) } : {}),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(ref, {
        id: expense.id,
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCloudExpense(uid: string, expenseId: string): Promise<void> {
  const path = `users/${uid}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCloudCategoryBudget(
  uid: string,
  category: CategoryId,
  limit: number
): Promise<void> {
  const path = `users/${uid}/categoryBudgets/${category}`;
  const ref = doc(db, 'users', uid, 'categoryBudgets', category);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        category,
        userId: uid,
        limit: Math.max(0, Math.min(1_000_000_000, Number(limit) || 0)),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        limit: Math.max(0, Math.min(1_000_000_000, Number(limit) || 0)),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pushSnapshotToCloud(
  user: User,
  expenses: Expense[],
  categoryBudgets: CategoryBudgetMap,
  prefs: AppPreferences
): Promise<void> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    if (!userSnap.exists()) {
      ops.push((batch) =>
        batch.set(userRef, {
          uid,
          displayName: (user.displayName || user.email || 'Mizan User').slice(0, 100),
          baseCurrency: prefs.baseCurrency,
          monthlyBudget: Math.max(0, Math.min(1_000_000_000, Number(prefs.monthlyBudget) || 0)),
          alertThresholdPct: Math.max(50, Math.min(95, Number(prefs.alertThresholdPct) || 80)),
          darkMode: Boolean(prefs.darkMode),
          browserNotifications: Boolean(prefs.browserNotifications),
          exchangeRates: buildSanitizedRates(prefs.exchangeRates),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      ops.push((batch) =>
        batch.update(userRef, {
          baseCurrency: prefs.baseCurrency,
          monthlyBudget: Math.max(0, Math.min(1_000_000_000, Number(prefs.monthlyBudget) || 0)),
          alertThresholdPct: Math.max(50, Math.min(95, Number(prefs.alertThresholdPct) || 80)),
          darkMode: Boolean(prefs.darkMode),
          browserNotifications: Boolean(prefs.browserNotifications),
          exchangeRates: buildSanitizedRates(prefs.exchangeRates),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const cat of CATEGORY_IDS) {
      const catRef = doc(db, 'users', uid, 'categoryBudgets', cat);
      const limit = Math.max(0, Math.min(1_000_000_000, Number(categoryBudgets[cat]) || 0));
      ops.push((batch) =>
        batch.set(catRef, {
          category: cat,
          userId: uid,
          limit,
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const exp of expenses) {
      const expRef = doc(db, 'users', uid, 'expenses', exp.id);
      ops.push((batch) =>
        batch.set(expRef, {
          id: exp.id,
          userId: uid,
          title: exp.title.trim().slice(0, MAX_TITLE_LENGTH),
          amount: Math.max(0.01, Math.min(1_000_000_000, Number(exp.amount))),
          currency: exp.currency,
          category: exp.category,
          date: exp.date,
          paymentMethod: exp.paymentMethod,
          ...(exp.notes ? { notes: exp.notes.trim().slice(0, MAX_NOTES_LENGTH) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    const CHUNK = 380;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const apply of ops.slice(i, i + CHUNK)) {
        apply(batch);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export interface CloudListenersCallbacks {
  onExpenses: (expenses: Expense[]) => void;
  onCategoryBudgets: (budgets: Partial<CategoryBudgetMap>) => void;
  onPreferences: (prefs: Partial<AppPreferences>) => void;
}

export function subscribeCloudData(
  uid: string,
  callbacks: CloudListenersCallbacks
): Unsubscribe {
  const userPath = `users/${uid}`;
  const expensesPath = `users/${uid}/expenses`;
  const budgetsPath = `users/${uid}/categoryBudgets`;

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const partial: Partial<AppPreferences> = {};
      if (isValidCurrencyCode(d.baseCurrency)) {
        partial.baseCurrency = d.baseCurrency as CurrencyCode;
      }
      if (typeof d.monthlyBudget === 'number') {
        partial.monthlyBudget = d.monthlyBudget;
      }
      if (typeof d.alertThresholdPct === 'number') {
        partial.alertThresholdPct = d.alertThresholdPct;
      }
      if (typeof d.darkMode === 'boolean') {
        partial.darkMode = d.darkMode;
      }
      if (typeof d.browserNotifications === 'boolean') {
        partial.browserNotifications = d.browserNotifications;
      }
      if (d.exchangeRates && typeof d.exchangeRates === 'object') {
        partial.exchangeRates = {
          ...DEFAULT_EXCHANGE_RATES,
          ...d.exchangeRates,
        };
      }
      callbacks.onPreferences(partial);
    },
    (error) => handleFirestoreError(error, OperationType.GET, userPath)
  );

  const unsubExpenses = onSnapshot(
    collection(db, 'users', uid, 'expenses'),
    (snap) => {
      const list: Expense[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.title === 'string' && typeof d.amount === 'number' && typeof d.date === 'string') {
          list.push({
            id: docSnap.id,
            title: d.title,
            amount: d.amount,
            currency: isValidCurrencyCode(d.currency) ? d.currency : 'PKR',
            category: d.category,
            date: d.date,
            paymentMethod: d.paymentMethod,
            ...(typeof d.notes === 'string' ? { notes: d.notes } : {}),
          });
        }
      });
      callbacks.onExpenses(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, expensesPath)
  );

  const unsubBudgets = onSnapshot(
    collection(db, 'users', uid, 'categoryBudgets'),
    (snap) => {
      const map: Partial<CategoryBudgetMap> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const cat = docSnap.id as CategoryId;
        if (CATEGORY_IDS.includes(cat) && typeof d.limit === 'number') {
          map[cat] = d.limit;
        }
      });
      callbacks.onCategoryBudgets(map);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, budgetsPath)
  );

  return () => {
    unsubUser();
    unsubExpenses();
    unsubBudgets();
  };
}
