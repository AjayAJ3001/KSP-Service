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
  CLEANING: 'Cleaning',
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

export type SettlementExpenseRow = { type: string; description: string; amount: number };

export function settlementExpenseBreakdown(s: {
  expense_items?: any;
  total_expenses?: number | string;
  loading_expense?: number | string;
  unloading_expense?: number | string;
  bata_expense?: number | string;
  cleaning_expense?: number | string;
  other_expense?: number | string;
}): {
  rows: SettlementExpenseRow[];
  loading: number;
  unloading: number;
  total: number;
} {
  const items = normalizeExpenseItems(s.expense_items);
  const toRow = (it: any): SettlementExpenseRow => ({
    type: formatExpenseType(it.expense_type || it.type),
    description: String(it.description || it.type || '').trim(),
    amount: Number(it.amount || 0),
  });

  const rows: SettlementExpenseRow[] = items
    .map(toRow)
    .filter((row) => Number(row.amount || 0) > 0);

  const loading = Math.round(
    rows.filter((r) => r.type === 'Loading').reduce((sum, r) => sum + Number(r.amount || 0), 0)
    || Number(s.loading_expense || 0)
  );
  const unloading = Math.round(
    rows.filter((r) => r.type === 'Unloading').reduce((sum, r) => sum + Number(r.amount || 0), 0)
    || Number(s.unloading_expense || 0)
  );

  if (!items.length) {
    const catalog: Array<[string, string, number]> = [
      ['Loading', 'Loading charge', Math.round(Number(s.loading_expense || 0))],
      ['Unloading', 'Unloading charge', Math.round(Number(s.unloading_expense || 0))],
      ['Driver bata', 'Driver bata', Math.round(Number(s.bata_expense || 0))],
      ['Cleaning', 'Cleaning charge', Math.round(Number(s.cleaning_expense || 0))],
      ['Other', 'Other trip expenses', Math.round(Number(s.other_expense || 0))],
    ];
    for (const [type, description, amount] of catalog) {
      if (amount > 0) rows.push({ type, description, amount });
    }
  }

  const itemsTotal = Math.round(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const total = Math.round(Number(s.total_expenses || 0)) || itemsTotal;
  const remainder = Math.round(total - itemsTotal);
  if (remainder > 0) {
    rows.push({ type: 'Other', description: 'Other trip expenses', amount: remainder });
  }
  return { rows, loading, unloading, total };
}

export function driverSummaryExpense(d: {
  loading_expense?: number | string;
  unloading_expense?: number | string;
  total_expenses_reported?: number | string;
  total_expenses?: number | string;
}): { loading: number; unloading: number; total: number } {
  const loading = Math.round(Number(d.loading_expense || 0));
  const unloading = Math.round(Number(d.unloading_expense || 0));
  const total = Math.round(Number(d.total_expenses_reported ?? d.total_expenses ?? 0));
  return { loading, unloading, total: total || loading + unloading };
}
