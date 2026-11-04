const FIELD_LABELS: Record<string, string> = {
  username: 'Username',
  user_name: 'User name',
  name: 'Name',
  role: 'Role',
  changes: 'Changes',
  reason: 'Reason',
  trip_id: 'Trip ID',
  record_id: 'Record ID',
  lorry_number: 'Lorry number',
  amount: 'Amount',
  received_amount: 'Received',
  balance_due: 'Balance due',
  expense_type: 'Expense type',
  status: 'Status',
  notes: 'Notes',
  description: 'Description',
  target_user: 'Target user',
};

const SECRET_KEYS = ['password', 'token', 'secret', 'hash', 'auth'];
const MEDIA_KEYS = ['image', 'photo', 'doc', 'file', 'attachment', 'receipt', 'proof', 'blob', 'pdf'];
const MONEY_KEYS = ['amount', 'paid', 'freight', 'rate', 'balance', 'advance', 'total', 'received', 'due', 'expense'];
const SKIP_KEYS = new Set([
  'what_happened', 'short_label', 'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'driver_id', 'owner_id', 'vehicle_id', 'party_id', 'route_id', 'unit_id', 'manager_id', 'user_id',
]);
const DETAIL_ORDER = [
  'driver_name', 'owner_name', 'lorry_number', 'party_name', 'from_location', 'to_location',
  'trip_date', 'expense_type', 'description', 'amount', 'received_amount', 'balance_due',
];

export type ReadableRow = { label: string; value: string };

function humanLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Detail';
}

function isMoneyKey(key: string) {
  const lk = key.toLowerCase();
  return MONEY_KEYS.some((s) => lk.includes(s));
}

export function parseMaybeJson(raw: any): any {
  if (raw == null) return raw;
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

function formatScalar(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value) && isMoneyKey(key)) {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('data:') || trimmed.length > 120) return 'File attached';
    if (isMoneyKey(key) && trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      return `₹${Number(trimmed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return trimmed.replace(/_/g, ' ');
  }
  return String(value);
}

function flatten(obj: any, prefix = ''): ReadableRow[] {
  const parsed = parseMaybeJson(obj);
  if (parsed == null || parsed === '') return [];
  if (typeof parsed !== 'object') {
    return [{ label: prefix || 'Detail', value: formatScalar(prefix, parsed) }];
  }
  if (Array.isArray(parsed)) {
    if (!parsed.length) return [];
    return parsed.map((item, idx) => {
      const nested = flatten(item, prefix ? `${prefix} ${idx + 1}` : `Item ${idx + 1}`);
      return nested.length === 1
        ? nested[0]
        : { label: prefix ? `${prefix} ${idx + 1}` : `Item ${idx + 1}`, value: nested.map((r) => `${r.label}: ${r.value}`).join(', ') };
    });
  }
  const rows: ReadableRow[] = [];
  for (const [key, val] of Object.entries(parsed)) {
    const lk = key.toLowerCase();
    if (SKIP_KEYS.has(key) || SECRET_KEYS.some((s) => lk.includes(s))) continue;
    if (val === null || val === undefined || val === '') continue;
    const label = prefix ? `${prefix} › ${humanLabel(key)}` : humanLabel(key);
    if (MEDIA_KEYS.some((s) => lk.includes(s))) {
      rows.push({ label, value: 'File attached' });
      continue;
    }
    if (typeof val === 'object') {
      rows.push(...flatten(val, label));
      continue;
    }
    rows.push({ label, value: formatScalar(key, val) });
  }
  return rows;
}

export function getAuditPeopleLine(details: any): string {
  const parsed = parseMaybeJson(details);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
  return [
    parsed.driver_name ? `Driver: ${parsed.driver_name}` : '',
    parsed.owner_name ? `Owner: ${parsed.owner_name}` : '',
    parsed.lorry_number ? `Lorry: ${parsed.lorry_number}` : '',
  ].filter(Boolean).join('  •  ');
}

export function getAuditStory(details: any): string {
  const parsed = parseMaybeJson(details);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.what_happened) {
    return String(parsed.what_happened);
  }
  return '';
}

export function getReadableDetailRows(details: any): ReadableRow[] {
  const parsed = parseMaybeJson(details);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return flatten(parsed);
  const ordered: Record<string, any> = {};
  for (const key of DETAIL_ORDER) {
    if (parsed[key] != null && parsed[key] !== '') ordered[key] = parsed[key];
  }
  for (const [key, val] of Object.entries(parsed)) {
    if (!(key in ordered)) ordered[key] = val;
  }
  return flatten(ordered);
}

export function getAuditListLabel(details: any, action?: string): string {
  const parsed = parseMaybeJson(details);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.short_label) {
    return String(parsed.short_label);
  }
  const a = String(action || '').toUpperCase();
  if (a.includes('ADVANCE') && a.startsWith('CREATE')) return 'Advance given';
  if (a === 'ADD_PAYMENT') return 'Party payment received';
  if (a === 'ADD_EXPENSE') return 'Expense added';
  if (a === 'LOGIN') return 'Logged in';
  if (a === 'LOGOUT') return 'Logged out';
  if (a === 'CREATE_TRIP') return 'Trip created';
  return getAuditStory(details) || String(action || '').replace(/_/g, ' ') || '—';
}

export function formatReadableSummary(details: any, maxItems = 4): string {
  const story = getAuditStory(details);
  if (story) return story;
  const rows = getReadableDetailRows(details);
  if (!rows.length) return '—';
  const text = rows.slice(0, maxItems).map((r) => `${r.label}: ${r.value}`).join(' • ');
  return rows.length > maxItems ? `${text} • +${rows.length - maxItems} more` : text;
}
