# Security Specification — Mizan Expense & Budget Tracker

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`expenses`, `categoryBudgets`) is strictly private to the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **No Public User Enumeration**: Listing `/users` is strictly denied (`allow list: if false`).
3. **Master Gate Relational Sync**: Expenses and category budgets under `/users/{userId}` require the parent `/users/{userId}` profile document to exist (`existsAfter(...)`), preventing orphaned subcollection records.
4. **Immutable Identity & Creation Timestamps**: `uid` / `userId`, `id`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` fields must match `request.time`.
5. **Bounded Payloads & Allowlisted Keys**: Every collection validates `hasAll` and `hasOnly` on creation, `affectedKeys().hasOnly(...)` on updates, bounded numeric ranges, enum allowlists for currencies/categories/payment methods, and `.size()` limits on every string.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/users/userA/expenses/exp1` with `auth = null`.
2. **Unverified Email Write**: Write `/users/userA/expenses/exp1` with `email_verified = false`.
3. **Cross-User Read**: UserB reads `/users/userA/expenses/exp1`.
4. **Cross-User List**: UserB runs collection query on `/users/userA/expenses`.
5. **Identity Spoofing on Create**: UserA creates `/users/userA/expenses/exp1` with `userId: "userB"`.
6. **Shadow Field Injection**: UserA creates expense with extra `{ isAdmin: true }`.
7. **Negative / Zero Expense Amount**: UserA creates expense with `amount: -500` or `amount: 0`.
8. **Unsupported Currency Injection**: UserA creates expense with `currency: "XYZ"`.
9. **String Overflow (Denial of Wallet)**: UserA creates expense with 5,000-character `title` or `notes`.
10. **Path ID Poisoning**: UserA writes `/users/userA/expenses/bad$id/with/slash` or `id != expenseId`.
11. **Immutable Timestamp Tampering**: UserA updates expense and modifies `createdAt` or fakes `updatedAt` in the past.
12. **User Directory Scraping**: Any user runs `list` on `/users`.
