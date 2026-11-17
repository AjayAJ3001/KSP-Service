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
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .grid-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      letter-spacing: 0.3px;
    }
    .grid-table td {
      padding: 6px 8px;
      font-size: 11.5px;
      border: 1px solid #cbd5e1;
    }
    .calc-box {
      border: 1.5px solid #0f172a;
      background: #fafafa;
      margin-bottom: 14px;
      border-radius: 4px;
      overflow: hidden;
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 14px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .calc-row:last-child { border-bottom: none; }
    .calc-row.highlight {
      background: #f0fdf4;
      font-weight: 900;
      font-size: 14.5px;
      color: #15803d;
      border-top: 1.5px solid #0f172a;
      padding: 10px 14px;
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
  const row = (label: string, valueHtml: string, extra = '') =>
    `<div class="calc-row"${extra}><span>${label}</span><strong>${valueHtml}</strong></div>`;
  let html = row('Total Driver Expenses Incurred:', `<span style="color:#b45309">${formatCurrency(c.expenses)}</span>`);
  html += row('Advance given with trip:', `<span style="color:#1d4ed8">${formatCurrency(c.withTrip)}</span>`);
  if (c.advanceGivenBy) {
    html += row(`· Given by: ${safe(c.advanceGivenBy)}`, '', ' style="color:#1d4ed8;font-size:11px"');
  }
  html += row(
    'Advance given without trip:',
    `<span style="color:#c2410c">${formatCurrency(c.withoutTrip)}</span>`,
    ' style="background:#fff7ed"'
  );
  if (c.ownerName || c.ownerAdvance > 0) {
    html += row(
      `· Given by: Owner${c.ownerName ? ` — ${safe(c.ownerName)}` : ''}`,
      '',
      ' style="background:#fff7ed;color:#c2410c;font-size:11px"'
    );
  }
  if (c.priorDeficit > 0) {
    html += row(
      'Less: This trip advance adjusted to prior trip dues:',
      `<span style="color:#dc2626">(-) ${formatCurrency(c.priorDeficit)}</span>`,
      ' style="background:#fff7ed;color:#c2410c"'
    );
    html += row(
      'Effective Advance Available for This Trip:',
      formatCurrency(c.effectiveAdvance),
      ' style="background:#f8fafc;font-weight:700"'
    );
  }
  if (c.ownerApplied > 0) {
    html += row(
      'Less: Owner advance used on this trip:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.ownerApplied)}</span>`,
      ' style="background:#fff7ed;color:#c2410c"'
    );
  }
  if (c.leftoverUsed > 0 && c.priorDeficit <= 0) {
    html += row(
      'Less: Previous surplus used on this trip:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.leftoverUsed)}</span>`,
      ' style="background:#fff7ed;color:#c2410c"'
    );
  }
  if (c.laterAdvanceAdjusted) {
    html += row(
      'Less: Adjusted from later trip advance:',
      `<span style="color:#c2410c">(-) ${formatCurrency(c.laterPaid ?? c.paidAmount)}</span>`,
      ' style="background:#fff7ed;color:#c2410c"'
    );
  }
  if (c.isCashDisbursement && c.paidAmount > 0) {
    html += row(
      `Less: Paid to Driver (${safe(c.mode || 'CASH')})${c.settledBy ? ` — settled by ${safe(c.settledBy)}` : ''}:`,
      `<span style="color:#16a34a">(-) ${formatCurrency(c.paidAmount)}</span>`,
      ' style="background:#f0fdf4;color:#15803d"'
    );
  }
  if (c.needToPay > 0) {
    html += row(
      'Need to Pay:',
      `<span style="color:#b91c1c">${formatCurrency(c.needToPay)}</span>`,
      ' style="background:#fef2f2;color:#b91c1c;font-weight:800;border-top:1.5px solid #fecaca"'
    );
  }
  html += `<div class="calc-row highlight" style="background:#ecfdf5;color:#047857"><span>Balance in Hand:</span><span>${formatCurrency(c.inHand)}</span></div>`;
  return `
    <div class="section-title">2. Final Settlement Account Statement</div>
    <div class="calc-box">${html}</div>`;
}
