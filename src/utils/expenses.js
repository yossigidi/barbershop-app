// Expense category catalog — emoji + Hebrew label per key.
// Keys are stable IDs persisted in Firestore (so renaming labels is safe).

export const EXPENSE_CATEGORIES = [
  { key: 'rent',         emoji: '🏠', label: 'שכירות' },
  { key: 'supplies',     emoji: '🧴', label: 'חומרים' },
  { key: 'equipment',    emoji: '📦', label: 'ציוד' },
  { key: 'utilities',    emoji: '⚡', label: 'חשבונות' },
  { key: 'marketing',    emoji: '📱', label: 'פרסום' },
  { key: 'transport',    emoji: '🚗', label: 'רכב/דלק' },
  { key: 'tax',          emoji: '📋', label: 'מסים/רו״ח' },
  { key: 'food',         emoji: '🍽',  label: 'כלכלה' },
  { key: 'subscriptions', emoji: '💳', label: 'מנויים' },
  { key: 'other',        emoji: '📎', label: 'שונות' },
];

export function categoryByKey(key) {
  return EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

// Sum expenses within an inclusive ISO date range.
export function sumExpenses(expenses, fromISO, toISO) {
  let total = 0;
  for (const e of expenses) {
    if (!e?.date) continue;
    if (e.date < fromISO || e.date > toISO) continue;
    total += Number(e.amount) || 0;
  }
  return total;
}

// Group expenses by category for a given month, sorted descending by amount.
export function categoryBreakdown(expenses, fromISO, toISO) {
  const totals = new Map();
  for (const e of expenses) {
    if (!e?.date) continue;
    if (e.date < fromISO || e.date > toISO) continue;
    const k = e.category || 'other';
    totals.set(k, (totals.get(k) || 0) + (Number(e.amount) || 0));
  }
  return [...totals.entries()]
    .map(([key, total]) => ({ ...categoryByKey(key), total }))
    .sort((a, b) => b.total - a.total);
}
