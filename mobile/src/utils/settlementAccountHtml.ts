export type SettlementAccountCalc = {
  expenses: number;
  withTrip: number;
  tripAdvance: number;
  ownerAdvance: number;
  advanceGivenBy?: string;
  ownerName?: string;
  withoutTrip: number;
  priorDeficit: number;
  effectiveAdvance: number;
  ownerApplied: number;
  leftoverUsed: number;
  laterAdvanceAdjusted: boolean;
  laterPaid?: number;
  paidAmount: number;
  isCashDisbursement: boolean;
  mode?: string;
  settledBy?: string;
  needToPay: number;
  inHand: number;
};

export const SETTLEMENT_ACCOUNT_CSS = `
    .grid-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 14px;
    }
    .grid-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 7px 6px;
      border: 1px solid #cbd5e1;
      letter-spacing: 0.3px;
    }
    .grid-table td {
      padding: 6px;
      font-size: 11.5px;
      border: 1px solid #cbd5e1;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      vertical-align: top;
    }
    .grid-table th:first-child,
    .grid-table td:first-child { width: 32px; text-align: center; }
    .grid-table th:last-child,
    .grid-table td:last-child {
      width: 30%;
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .calc-box {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      background: #fafafa;
      margin-bottom: 14px;
    }
    .calc-label {
      padding: 7px 10px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .calc-amt {
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 800;
      border-bottom: 1px solid #e2e8f0;
      text-align: right;
      white-space: nowrap;
      width: 36%;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }
    .calc-box tr:last-child td { border-bottom: none; }
    .calc-highlight td {
      background: #ecfdf5;
      font-weight: 900;
      font-size: 14px;
      color: #047857;
      border-top: 1.5px solid #0f172a;
      padding: 10px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
    }
`;

const safe = (val: string) =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function settlementExpenseTableHtml(
  rows: { type: string; description?: string; amount: number }[],
  total: number,
  formatCurrency: (n: number) => string
): string {
  const body = rows
    .map(
      (item, idx) =>
        `<tr>
          <td width="40">${idx + 1}</td>
          <td>${safe(item.type)}</td>
          <td>${safe(item.description || '—')}</td>
          <td style="text-align:right;font-weight:700;">${formatCurrency(item.amount)}</td>
        </tr>`
    )
    .join('');
  return `
    <div class="section-title">1. Driver Trip Expenses Breakdown</div>
    <table class="grid-table" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th width="40">#</th>
          <th>Expense Category</th>
          <th>Description / Remarks</th>
          <th width="120" style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${body || `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No trip expenses</td></tr>`}
        <tr style="background:#f8fafc;font-weight:800;">
          <td colspan="3" style="text-align:right;padding:7px 8px;font-size:11.5px;text-transform:uppercase;">Full Trip Expenses:</td>
          <td style="text-align:right;padding:7px 8px;font-size:12.5px;color:#b45309;">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>`;
}

export function settlementAccountStatementHtml(
  c: SettlementAccountCalc,
  formatCurrency: (n: number) => string
): string {
  const row = (label: string, valueHtml: string, extraStyle = '') =>
    `<tr>
      <td class="calc-label" style="${extraStyle}">${label}</td>
      <td class="calc-amt" style="${extraStyle}">${valueHtml || '&nbsp;'}</td>
    </tr>`;
  let html = row('Total Driver Expenses Incurred:', `<span style="color:#b45309">${formatCurrency(c.expenses)}</span>`);
  html += row('Advance given with trip:', `<span style="color:#1d4ed8">${formatCurrency(c.withTrip)}</span>`);
  if (c.advanceGivenBy) {
    html += row(`· Given by: ${safe(c.advanceGivenBy)}`, '', 'color:#1d4ed8;font-size:11px;');
  }
  html += row(
    'Advance given without trip:',
    `<span style="color:#c2410c">${formatCurrency(c.withoutTrip)}</span>`,
    'background:#fff7ed'
  );
  if (c.ownerName || c.ownerAdvance > 0) {
    html += row(
      `· Given by: Owner${c.ownerName ? ` — ${safe(c.ownerName)}` : ''}`,
      '',
      'background:#fff7ed;color:#c2410c;font-size:11px;'
    );
  }
  if (c.priorDeficit > 0) {
    html += row(
      'Less: This trip advance adjusted to prior trip dues:',
      `<span style="color:#dc2626">(-) ${formatCurrency(c.priorDeficit)}</span>`,
      'background:#fff7ed;color:#c2410c'
    );
    html += row(
      'Effective Advance Available for This Trip:',
      formatCurrency(c.effectiveAdvance),
      'background:#f8fafc;font-weight:700'
    );
  }
  if (c.ownerApplied > 0) {
    html += row(
      'Less: Owner advance used on this trip:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.ownerApplied)}</span>`,
      'background:#fff7ed;color:#c2410c'
    );
  }
  if (c.leftoverUsed > 0 && c.priorDeficit <= 0) {
    html += row(
      'Less: Previous surplus used on this trip:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.leftoverUsed)}</span>`,
      'background:#fff7ed;color:#c2410c'
    );
  }
  if (c.laterAdvanceAdjusted) {
    html += row(
      'Less: Adjusted from later trip advance:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.laterPaid ?? c.paidAmount)}</span>`,
      'background:#fff7ed;color:#c2410c'
    );
  }
  if (c.isCashDisbursement && c.paidAmount > 0) {
    html += row(
      `Less: Paid to Driver (${safe(c.mode || 'CASH')})${c.settledBy ? ` — settled by ${safe(c.settledBy)}` : ''}:`,
      `<span style="color:#16a34a">(-) ${formatCurrency(c.paidAmount)}</span>`,
      'background:#f0fdf4;color:#15803d'
    );
  }
  if (c.needToPay > 0) {
    html += row(
      'Need to Pay:',
      `<span style="color:#b91c1c">${formatCurrency(c.needToPay)}</span>`,
      'background:#fef2f2;color:#b91c1c;font-weight:800'
    );
  }
  html += `<tr class="calc-highlight">
    <td class="calc-label">Balance in Hand:</td>
    <td class="calc-amt">${formatCurrency(c.inHand)}</td>
  </tr>`;
  return `
    <div class="section-title">2. Final Settlement Account Statement</div>
    <table class="calc-box" cellpadding="0" cellspacing="0">${html}</table>`;
}
