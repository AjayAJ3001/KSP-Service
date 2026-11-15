export type ExpenseLine = { label: string; amount: number };
export type ExpenseDetail = { type: string; description: string; amount: number };

export function normalizeExpenseItems(items?: any): any[] {
  let list = items;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list : [];
}

export function expenseDetailLines(items?: any): ExpenseDetail[] {
  return normalizeExpenseItems(items)
    .map((it) => ({
      type: formatExpenseType(it.expense_type),
      description: String(it.description || '').trim(),
      amount: Number(it.amount || 0),
    }))
    .filter((it) => it.amount > 0);
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  LOADING: 'Loading',
  UNLOADING: 'Unloading',
  CLEANING_CHARGE: 'Cleaning',
  DRIVER_BATA: 'Driver bata',
  DRIVER_BETA: 'Driver bata',
  FREIGHT_BASED: 'Freight based',
  TOLL: 'Toll',
  FOOD: 'Food',
  REPAIR: 'Repair',
  OTHER: 'Other',
};

export function formatExpenseType(type?: string | null): string {
  const t = String(type || '').toUpperCase().trim();
  if (EXPENSE_TYPE_LABELS[t]) return EXPENSE_TYPE_LABELS[t];
  if (!t) return 'Expense';
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function expenseLinesFromItems(
  items?: { expense_type?: string; amount?: number | string }[] | string | null
): ExpenseLine[] {
  const list = normalizeExpenseItems(items);
  if (!list.length) return [];
  const grouped = new Map<string, number>();
  for (const it of list) {
    const amt = Number(it.amount || 0);
    if (!(amt > 0)) continue;
    const key = formatExpenseType(it.expense_type);
    grouped.set(key, (grouped.get(key) || 0) + amt);
  }
  return [...grouped.entries()].map(([label, amount]) => ({ label, amount }));
}

export function expenseLinesFromSummary(s: {
  loading_expense?: number | string;
  unloading_expense?: number | string;
  cleaning_expense?: number | string;
  bata_expense?: number | string;
  other_expense?: number | string;
}): ExpenseLine[] {
  return [
    ['Loading', Number(s.loading_expense || 0)],
    ['Unloading', Number(s.unloading_expense || 0)],
    ['Cleaning', Number(s.cleaning_expense || 0)],
    ['Driver bata', Number(s.bata_expense || 0)],
    ['Other', Number(s.other_expense || 0)],
  ]
    .filter(([, amount]) => Number(amount) > 0)
    .map(([label, amount]) => ({ label: String(label), amount: Number(amount) }));
}
