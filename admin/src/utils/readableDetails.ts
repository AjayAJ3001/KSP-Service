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
  party_id: 'Party',
  driver_id: 'Driver',
  vehicle_id: 'Vehicle',
  owner_id: 'Owner',
  route_id: 'Route',
  from_location: 'From',
  to_location: 'To',
  amount: 'Amount',
  received_amount: 'Received',
  balance_due: 'Balance due',
  total_freight: 'Total freight',
  freight_rate: 'Freight rate',
  rate_per_unit: 'Rate per unit',
  advance_paid: 'Advance paid',
  expense_type: 'Expense type',
  payment_mode: 'Payment mode',
  payment_status: 'Payment status',
  settlement_status: 'Settlement status',
  status: 'Status',
  notes: 'Notes',
  description: 'Description',
  mobile_number: 'Mobile',
  target_user: 'Target user',
  max_amount: 'Max amount',
  goods_weight: 'Weight',
  unit_name: 'Unit',
  party_name: 'Party',
  driver_name: 'Driver',
  owner_name: 'Owner',
};

const SECRET_KEYS = ['password', 'token', 'secret', 'hash', 'auth', 'access_token', 'refresh_token'];
const MEDIA_KEYS = ['image', 'photo', 'doc', 'file', 'attachment', 'receipt', 'proof', 'avatar', 'blob', 'pdf', 'rc_book', 'insurance', 'signature'];
const MONEY_KEYS = ['amount', 'paid', 'freight', 'rate', 'balance', 'advance', 'salary', 'total', 'received', 'due', 'expense'];
const SKIP_KEYS = new Set([
  'what_happened', 'short_label', 'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'password_hash',
  'driver_id', 'owner_id', 'vehicle_id', 'party_id', 'route_id', 'unit_id', 'manager_id', 'user_id', 'settlement_id',
]);
const DETAIL_ORDER = [
  'driver_name', 'owner_name', 'lorry_number', 'party_name', 'from_location', 'to_location',
  'trip_date', 'expense_type', 'description', 'amount', 'received_amount', 'balance_due',
  'total_freight', 'entered_advance', 'status', 'reason', 'notes',
];

export type ReadableRow = { label: string; value: string };

function humanLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Detail';
}

function isSecret(key: string) {
  const lk = key.toLowerCase();
  return SECRET_KEYS.some((s) => lk.includes(s));
}

function isMedia(key: string) {
  const lk = key.toLowerCase();
  return MEDIA_KEYS.some((s) => lk.includes(s));
}

function isMoneyKey(key: string) {
  const lk = key.toLowerCase();
  return MONEY_KEYS.some((s) => lk.includes(s));
}

function looksLikeBase64(val: string) {
  const trimmed = val.trim();
  return (
    trimmed.startsWith('data:') ||
    (!/\s/.test(trimmed) && trimmed.length > 80) ||
    /^[A-Za-z0-9+/=]{80,}$/.test(trimmed)
  );
}

export function parseMaybeJson(raw: any): any {
  if (raw == null) return raw;
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (isMoneyKey(key)) {
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (looksLikeBase64(trimmed)) return 'File attached';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    if (isMoneyKey(key) && trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      const n = Number(trimmed);
      return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    if (parsed.length === 0) return [];
    const allScalar = parsed.every((x) => x == null || typeof x !== 'object');
    if (allScalar) {
      return [{ label: prefix || 'Items', value: parsed.map((x) => formatScalar(prefix, x)).join(', ') }];
    }
    const rows: ReadableRow[] = [];
    parsed.forEach((item, idx) => {
      const nested = flatten(item, prefix ? `${prefix} ${idx + 1}` : `Item ${idx + 1}`);
      if (nested.length === 1 && nested[0].label.startsWith(prefix || 'Item')) {
        rows.push(nested[0]);
      } else if (nested.length) {
        const summary = nested.map((r) => `${r.label.replace(`${prefix} ${idx + 1} `, '')}: ${r.value}`).join(', ');
        rows.push({ label: prefix ? `${prefix} ${idx + 1}` : `Item ${idx + 1}`, value: summary });
      }
    });
    return rows;
  }

  const rows: ReadableRow[] = [];
  for (const [key, val] of Object.entries(parsed)) {
    if (SKIP_KEYS.has(key) || isSecret(key)) continue;
    if (val === null || val === undefined || val === '') continue;
    const label = prefix ? `${prefix} › ${humanLabel(key)}` : humanLabel(key);
    if (isMedia(key)) {
      if (val) rows.push({ label, value: 'File attached' });
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

function orderDetails(parsed: any) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const ordered: Record<string, any> = {};
  for (const key of DETAIL_ORDER) {
    if (parsed[key] != null && parsed[key] !== '') ordered[key] = parsed[key];
  }
  for (const [key, val] of Object.entries(parsed)) {
    if (!(key in ordered)) ordered[key] = val;
  }
  return ordered;
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
  return flatten(orderDetails(parseMaybeJson(details)));
}

export function getAuditListLabel(details: any, action?: string): string {
  const parsed = parseMaybeJson(details);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.short_label) {
    return String(parsed.short_label);
  }
  const a = String(action || '').toUpperCase();
  if (a.includes('ADVANCE') && (a.startsWith('CREATE') || a.includes('GIVE'))) return 'Advance given';
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
