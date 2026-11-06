import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Settlement, Trip } from '../types';

import { formatDateDMY } from './dateUtils';
import { PRINT_BRAND_CSS, printBrandLockup } from './pdfBrand';
import { buildDriverTripStories, getSettlementBreakdown, storyBalanceAdvance, storyCashSettlements } from './driverTripStories';

export const generateSettlementHtml = (trip: Trip, settlement: Settlement) => {
  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const totalExpenses = Math.round(parseFloat(String(settlement.total_expenses || 0)));
  const advancePaid = Math.round(parseFloat(String(settlement.advance_paid || 0)));
  const initialTripAdvance = Math.round(parseFloat(String(settlement.initial_trip_advance || 0)));
  const additionalAdvance = Math.round(parseFloat(String(settlement.additional_advance_paid || 0))) || (initialTripAdvance > 0 ? Math.max(0, advancePaid - initialTripAdvance) : 0);
  const priorDeficitDeduction = Math.round(parseFloat(String(settlement.prior_deficit_deduction || 0)));
  const effectiveAdvance = Math.max(0, advancePaid - priorDeficitDeduction);
  const prevDriverBalance = Math.max(0, Math.round(parseFloat(String(settlement.previous_driver_balance || 0))));
  const totalAdvanceAvailable = effectiveAdvance + prevDriverBalance;

  // Initial deficit/surplus before subsequent deductions:
  const initialDeficit = Math.max(0, totalExpenses - totalAdvanceAvailable);
  const initialSurplus = Math.max(0, totalAdvanceAvailable - totalExpenses);

  // Subsequent advance adjustments or cash settlements:
  const paidAmount = Math.round(parseFloat(String(settlement.paid_amount || 0)));

  // Net payable remaining for this trip:
  const payableToDriver = settlement.net_balance_to_driver !== undefined && settlement.net_balance_to_driver !== null
    ? Math.max(0, Math.round(parseFloat(String(settlement.net_balance_to_driver))))
    : Math.max(0, initialDeficit - paidAmount);

  const balanceInHand = payableToDriver === 0 ? initialSurplus : 0;
  const isFullySettled = settlement.settlement_status === 'SETTLED' && payableToDriver === 0;
  const tripDate = formatDateDMY(trip.trip_date || settlement.trip_date || new Date());
  const payDate = settlement.payment_date ? formatDateDMY(settlement.payment_date) : '';

  const items = settlement.expense_items || [];
  const expenseRows = items.length > 0
    ? items.map((item, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px; color: #0f172a;">${item.expense_type}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; color: #475569;">${item.description || '—'}</td>
          <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px;">${formatCurrency(item.amount)}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px;">1</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px; color: #0f172a;">Consolidated Driver Trip Expenses</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; color: #475569;">Loading, Unloading, Bata, Toll &amp; misc expenses</td>
          <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px;">${formatCurrency(settlement.total_expenses)}</td>
        </tr>
      `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Transport - Settlement Challan #${settlement.id}</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .challan-card {
      border: 2px solid #0f172a;
      border-radius: 4px;
      padding: 20px 24px;
      background: #ffffff;
      max-width: 780px;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .company-meta {
      font-size: 10.5px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.4;
    }
    .voucher-box {
      border: 1.5px solid #0f172a;
      background: #f8fafc;
      padding: 8px 12px;
      text-align: right;
      border-radius: 4px;
      min-width: 220px;
    }
    .voucher-title {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .voucher-meta {
      font-size: 11px;
      color: #334155;
      margin-top: 4px;
      line-height: 1.5;
    }
    .status-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 3px;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-settled {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .status-pending {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #cbd5e1;
    }
    .info-table td {
      padding: 6px 10px;
      font-size: 11.5px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .info-label {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      width: 20%;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
      width: 30%;
    }
    .plate-box {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: monospace, monospace;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
    }
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
    .calc-row:last-child {
      border-bottom: none;
    }
    .calc-row.highlight {
      background: #f0fdf4;
      font-weight: 900;
      font-size: 14.5px;
      color: #15803d;
      border-top: 1.5px solid #0f172a;
      padding: 10px 14px;
    }
    .discharge-box {
      border: 1.5px solid #16a34a;
      background: #f0fdf4;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 11.5px;
      color: #166534;
    }
    .discharge-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: #15803d;
      letter-spacing: 0.5px;
    }
    .declaration {
      font-size: 10px;
      color: #64748b;
      line-height: 1.45;
      margin-bottom: 24px;
      padding: 8px 10px;
      background: #f8fafc;
      border-left: 3px solid #94a3b8;
      border-radius: 2px;
    }
    .sig-table {
      width: 100%;
      margin-top: 20px;
    }
    .sig-table td {
      vertical-align: bottom;
      width: 50%;
    }
    .sig-line {
      width: 200px;
      border-bottom: 1px solid #0f172a;
      margin-bottom: 6px;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .stamp-box {
      display: inline-block;
      border: 1px dashed #94a3b8;
      padding: 6px 12px;
      font-size: 10px;
      color: #94a3b8;
      border-radius: 4px;
      margin-top: 6px;
    }
    .footer-note {
      text-align: center;
      font-size: 9.5px;
      color: #94a3b8;
      margin-top: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="challan-card">
    <table class="header-table" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align: top;">
          ${printBrandLockup('Fleet Logistics &amp; Transport Contractors')}
          <div class="company-meta">
            Head Office: Namakkal • Tamil Nadu<br />
            Fleet Operations &amp; Freight Settlement Dept.
          </div>
        </td>
        <td style="vertical-align: top; text-align: right;" width="260">
          <div class="voucher-box">
            <div class="voucher-title">TRIP SETTLEMENT CHALLAN</div>
            <div class="voucher-meta">
              <strong>Voucher #:</strong> SETTLE-${settlement.id}<br />
              <strong>Trip Ref:</strong> #TRIP-${trip.id || settlement.trip_id}<br />
              <strong>Settlement Date:</strong> ${payDate || tripDate}
            </div>
            <div>
              <span class="status-badge ${isFullySettled ? 'status-settled' : 'status-pending'}">
                ${isFullySettled ? '✔ SETTLED' : '⏳ PENDING PAYMENT'}
              </span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <table class="info-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="info-label">Lorry Number</td>
        <td class="info-val"><span class="plate-box">${trip.lorry_number || settlement.lorry_number}</span></td>
        <td class="info-label">Party / Consignor</td>
        <td class="info-val">${trip.party_name || settlement.party_name}</td>
      </tr>
      <tr>
        <td class="info-label">Driver Name</td>
        <td class="info-val">${trip.driver_name || settlement.driver_name}</td>
        <td class="info-label">Destination / Unit</td>
        <td class="info-val">${trip.to_location || settlement.to_location || settlement.from_location || '—'}</td>
      </tr>
      <tr>
        <td class="info-label">Truck Owner</td>
        <td class="info-val" style="color:#6d28d9;font-weight:700">${trip.owner_name || settlement.owner_name || '—'}</td>
        <td class="info-label">Trip Dispatch Date</td>
        <td class="info-val">${tripDate}</td>
      </tr>
      <tr>
        <td class="info-label">Settlement Mode</td>
        <td class="info-val">${settlement.payment_mode || (isFullySettled ? 'CASH' : 'PENDING')}</td>
        <td class="info-label"></td>
        <td class="info-val"></td>
      </tr>
      ${((settlement as any).advance_given_by_name || settlement.settled_by_name) ? `
      <tr>
        <td class="info-label">Advance Given By</td>
        <td class="info-val">${(settlement as any).advance_given_by_name || '—'}</td>
        <td class="info-label">Settlement Done By</td>
        <td class="info-val">${settlement.settled_by_name || '—'}</td>
      </tr>
      ` : ''}
    </table>

    <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px;">
      1. Driver Trip Expenses Breakdown
    </div>
    <table class="grid-table" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th width="40">#</th>
          <th>Expense Category</th>
          <th>Description / Remarks</th>
          <th width="120" style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenseRows}
        <tr style="background: #f8fafc; font-weight: 800;">
          <td colspan="3" style="text-align: right; padding: 7px 8px; font-size: 11.5px; text-transform: uppercase;">Total Trip Expenses:</td>
          <td style="text-align: right; padding: 7px 8px; font-size: 12.5px; color: #b45309;">${formatCurrency(settlement.total_expenses)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px;">
      2. Final Settlement Account Statement
    </div>
    <div class="calc-box">
      ${(() => {
        const tripAdvance = Math.round(Number((settlement as any).manager_advance ?? initialTripAdvance ?? 0));
        const ownerAdvance = Math.round(Number((settlement as any).owner_given || 0));
        const ownerApplied = Math.round(Number((settlement as any).owner_applied || 0));
        const leftoverUsed = Math.round(Number((settlement as any).owner_leftover_used || 0));
        const ownerBal = Math.round(Number((settlement as any).owner_balance || 0));
        const ownerName = String((settlement as any).advance_owner_name || '').trim();
        const givenBy = String((settlement as any).advance_given_by_name || '').trim();
        const settledBy = String(settlement.settled_by_name || '').trim();
        const mode = String(settlement.payment_mode || '').toUpperCase();
        const isCash = ['CASH', 'UPI', 'BANK_TRANSFER'].includes(mode);
        const laterAdj = paidAmount > 0 && !isCash;
        const effectiveMgr = (settlement as any).effective_manager_advance != null
          ? Math.round(Number((settlement as any).effective_manager_advance))
          : Math.max(0, tripAdvance - priorDeficitDeduction);
        const needToPay = ownerBal > 0 ? 0 : Math.max(0, totalExpenses - effectiveMgr - ownerAdvance - leftoverUsed - (isCash || laterAdj ? paidAmount : 0));
        const inHand = ownerBal > 0 ? ownerBal : 0;
        const row = (label: string, value: string, extra = '') =>
          `<div class="calc-row"${extra}><span>${label}</span><strong>${value}</strong></div>`;
        let html = row('Total Driver Expenses Incurred:', `<span style="color:#b45309">${formatCurrency(totalExpenses)}</span>`);
        if (tripAdvance > 0 && priorDeficitDeduction <= 0) {
          html += row(`Less: Trip Advance${givenBy ? ` (given by ${givenBy})` : ''}:`, `<span style="color:#1d4ed8">(-) ${formatCurrency(tripAdvance)}</span>`);
        } else if (tripAdvance > 0) {
          html += row(`Trip Advance (given${givenBy ? ` by ${givenBy}` : ''}):`, `<span style="color:#1d4ed8">${formatCurrency(tripAdvance)}</span>`);
        }
        if (ownerAdvance > 0) {
          html += row(`Advance from Owner${ownerName ? ` (${ownerName})` : ''}:`, `<span style="color:#6d28d9">${formatCurrency(ownerAdvance)}</span>`, ' style="background:#f5f3ff"');
        }
        if (priorDeficitDeduction > 0) {
          html += row('Less: This trip advance adjusted to prior trip dues:', `<span style="color:#dc2626">(-) ${formatCurrency(priorDeficitDeduction)}</span>`, ' style="background:#fff7ed;color:#c2410c"');
          html += row('Effective Advance Available for This Trip:', formatCurrency(effectiveAdvance), ' style="background:#f8fafc;font-weight:700"');
        }
        if (ownerApplied > 0) {
          html += row('Less: Owner advance used on this trip:', `<span style="color:#c2410c">(-) ${formatCurrency(ownerApplied)}</span>`, ' style="background:#fff7ed;color:#c2410c"');
        }
        if (leftoverUsed > 0 && priorDeficitDeduction <= 0) {
          html += row('Less: Previous surplus used on this trip:', `<span style="color:#c2410c">(-) ${formatCurrency(leftoverUsed)}</span>`, ' style="background:#fff7ed;color:#c2410c"');
        }
        if (laterAdj) {
          html += row('Less: Adjusted from later trip advance:', `<span style="color:#c2410c">(-) ${formatCurrency(paidAmount)}</span>`, ' style="background:#fff7ed;color:#c2410c"');
        }
        if (isCash && paidAmount > 0) {
          html += row(`Less: Paid to Driver (${mode})${settledBy ? ` — settled by ${settledBy}` : ''}:`, `<span style="color:#16a34a">(-) ${formatCurrency(paidAmount)}</span>`, ' style="background:#f0fdf4;color:#15803d"');
        }
        if (needToPay > 0 || inHand === 0) {
          html += row('Need to Pay:', `<span style="color:#b91c1c">${formatCurrency(needToPay)}</span>`, ' style="background:#fef2f2;color:#b91c1c;font-weight:800;border-top:1.5px solid #fecaca"');
        }
        if (inHand > 0) {
          html += `<div class="calc-row highlight" style="background:#ecfdf5;color:#047857"><span>Balance in Hand:</span><span>${formatCurrency(inHand)}</span></div>`;
        }
        return html;
      })()}
    </div>

    ${priorDeficitDeduction > 0 ? `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 9px 12px; margin-bottom: 14px; font-size: 11px; color: #92400e; line-height: 1.45;">
      <strong>⚠ Advance Adjustment Notice:</strong> This trip's advance of ${formatCurrency(Number((settlement as any).manager_advance ?? initialTripAdvance ?? advancePaid))} was applied to prior trip dues (${formatCurrency(priorDeficitDeduction)}). Effective advance for this trip is ${formatCurrency(effectiveAdvance)}. This trip's expenses of ${formatCurrency(totalExpenses)} are payable to the driver.
    </div>
    ` : ''}

    ${paidAmount > 0 && !['CASH', 'UPI', 'BANK_TRANSFER'].includes(String(settlement.payment_mode || '').toUpperCase()) ? `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 9px 12px; margin-bottom: 14px; font-size: 11px; color: #92400e; line-height: 1.45;">
      <strong>✔ Later Trip Advance Adjustment:</strong> <strong>${formatCurrency(paidAmount)}</strong> from a later trip advance was applied to this trip's pending dues.
    </div>
    ` : ''}

    ${['CASH', 'UPI', 'BANK_TRANSFER'].includes(String(settlement.payment_mode || '').toUpperCase()) && paidAmount > 0 ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 9px 12px; margin-bottom: 14px; font-size: 11px; color: #166534; line-height: 1.45;">
      <strong>✔ Payment Recorded:</strong> <strong>${formatCurrency(paidAmount)}</strong> paid to driver via ${settlement.payment_mode}. Remaining balance payable to driver: <strong>${formatCurrency(payableToDriver)}</strong>.
    </div>
    ` : ''}

    ${isFullySettled && settlement.payment_mode ? `
      <div class="discharge-box">
        <div class="discharge-title">✔ OFFICIAL DISBURSEMENT RECEIPT</div>
        <div style="line-height: 1.6;">
          Paid Amount: <strong>${formatCurrency(settlement.paid_amount || settlement.balance_to_driver)}</strong> via <strong>${settlement.payment_mode}</strong>
          ${settlement.payment_date ? ` · Paid on <strong>${formatDateDMY(settlement.payment_date)}</strong>` : ''}
          ${settlement.reference_no ? ` · Ref/UTR: <strong>${settlement.reference_no}</strong>` : ''}
          ${(settlement as any).advance_given_by_name ? ` · Advance given by: <strong>${(settlement as any).advance_given_by_name}</strong>` : ''}
          ${settlement.settled_by_name ? ` · Settlement done by: <strong>${settlement.settled_by_name}</strong>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="declaration">
      <strong>Declaration &amp; Acknowledgment:</strong>
      Certified that all vehicle fuel, driver allowances, unloading/loading dues and miscellaneous expenses for Trip #${trip.id || settlement.trip_id} have been verified against original vouchers and settled in full. The driver acknowledges receipt of the net amount without further claims.
    </div>

    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-line"></div>
          <div class="sig-title">Driver's Signature</div>
          <div class="sig-sub">Name: <strong>${trip.driver_name || settlement.driver_name}</strong></div>
          <div class="sig-sub">Date: ____/____/2026</div>
        </td>
        <td style="text-align: right;">
          <div class="sig-line" style="margin-left: auto;"></div>
          <div class="sig-title">Authorized Signatory</div>
          <div class="sig-sub">For <strong>KSP TRANSPORT</strong></div>
          <div class="stamp-box">[ OFFICIAL SEAL &amp; STAMP ]</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      Official Transport Settlement Voucher • KSP Fleet Management System • Triplicate Copy
    </div>
  </div>
</body>
</html>`;
};

// Print Action
export const printSettlementPdf = async (trip: Trip, settlement: Settlement) => {
  try {
    const html = generateSettlementHtml(trip, settlement);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing PDF', error);
    throw error;
  }
};

// Share Action
export const shareSettlementPdf = async (trip: Trip, settlement: Settlement) => {
  try {
    const html = generateSettlementHtml(trip, settlement);
    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Share Settlement Slip',
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (error) {
    console.error('Error sharing PDF', error);
    throw error;
  }
};

// Download / Save to Local Device Storage Action
export const downloadSettlementPdf = async (
  trip: Trip,
  settlement: Settlement
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateSettlementHtml(trip, settlement);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const filename = `KSP_Settlement_Trip_${trip.id}_${Date.now()}`;

    // On Android: Use StorageAccessFramework to allow user to pick their Downloads/Documents folder
    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            }));

          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );

          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          return {
            success: true,
            filename: `${filename}.pdf`,
            uri: createdFileUri,
            savedDirectly: true,
          };
        }
      } catch (safErr) {
        console.warn('SAF download attempt failed, falling back to Sharing:', safErr);
      }
    }

    // Fallback or iOS: save to documents and open system save dialog
    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({
      from: uri,
      to: targetUri,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Save / Download Settlement Slip to Device',
      });
    }

    return {
      success: true,
      filename: `${filename}.pdf`,
      uri: targetUri,
      savedDirectly: false,
    };
  } catch (error) {
    console.error('Error downloading PDF', error);
    throw error;
  }
};

// Backwards-compatible export
export const printOrShareSettlementPdf = async (trip: Trip, settlement: Settlement) => {
  return shareSettlementPdf(trip, settlement);
};

/* ─────────────────────────────────────────────────────────────
   Trip Details Slip PDF Generator, Share & Download
───────────────────────────────────────────────────────────── */
export const generateTripHtml = (trip: Trip) => {
  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const tripDate = formatDateDMY(trip.trip_date || new Date());
  const balanceDue = trip.balance_due ?? Math.max(0, (trip.total_freight || 0) - (trip.total_received || 0));
  const isSettled = trip.status === 'SETTLED';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Transport - Trip Challan #${trip.id}</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .challan-card {
      border: 2px solid #0f172a;
      border-radius: 4px;
      padding: 20px 24px;
      background: #ffffff;
      max-width: 780px;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .company-meta {
      font-size: 10.5px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.4;
    }
    .voucher-box {
      border: 1.5px solid #0f172a;
      background: #f8fafc;
      padding: 8px 12px;
      text-align: right;
      border-radius: 4px;
      min-width: 220px;
    }
    .voucher-title {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .voucher-meta {
      font-size: 11px;
      color: #334155;
      margin-top: 4px;
      line-height: 1.5;
    }
    .status-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 3px;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-settled {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .status-pending {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #cbd5e1;
    }
    .info-table td {
      padding: 7px 10px;
      font-size: 11.5px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .info-label {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      width: 20%;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
      width: 30%;
    }
    .plate-box {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: monospace, monospace;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
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
      padding: 8px 14px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .calc-row:last-child {
      border-bottom: none;
    }
    .calc-row.highlight {
      background: #eff6ff;
      font-weight: 900;
      font-size: 14px;
      color: #1e40af;
      border-top: 1.5px solid #0f172a;
      padding: 10px 14px;
    }
    .sig-table {
      width: 100%;
      margin-top: 24px;
      margin-bottom: 14px;
    }
    .sig-table td {
      vertical-align: top;
      width: 50%;
    }
    .sig-line {
      width: 180px;
      border-top: 1.5px dashed #0f172a;
      margin-bottom: 6px;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 10.5px;
      color: #475569;
      margin-top: 2px;
    }
    .stamp-box {
      display: inline-block;
      margin-top: 8px;
      border: 1.5px dashed #94a3b8;
      color: #64748b;
      font-size: 9.5px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer-note {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 9.5px;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="challan-card">
    <table class="header-table" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align: top;">
          ${printBrandLockup('Fleet Logistics &amp; Freight Management')}
          <div class="company-meta">
            Tamil Nadu &bull; Head Office<br />
            Fleet Operations System
          </div>
        </td>
        <td style="vertical-align: top; text-align: right;">
          <div class="voucher-box">
            <div class="voucher-title">OFFICIAL TRIP CHALLAN</div>
            <div class="voucher-meta">
              <strong>Trip Ref:</strong> #TRIP-${trip.id}<br />
              <strong>Trip Date:</strong> ${tripDate}
            </div>
            <div>
              <span class="status-badge ${isSettled ? 'status-settled' : 'status-pending'}">
                ${trip.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <div class="section-title">1. Route &amp; Consignment Details</div>
    <table class="info-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="info-label">From Location</td>
        <td class="info-val">${trip.from_location || '—'}</td>
        <td class="info-label">To Location</td>
        <td class="info-val">${trip.to_location || '—'}</td>
      </tr>
      <tr>
        <td class="info-label">Party / Consignor</td>
        <td class="info-val">${trip.party_name || '—'}</td>
        <td class="info-label">Party Mobile</td>
        <td class="info-val">${trip.party_mobile || '—'}</td>
      </tr>
      <tr>
        <td class="info-label">Weight / Quantity</td>
        <td class="info-val">${trip.goods_weight ? `${trip.goods_weight} ${trip.unit_name || trip.unit_abbreviation || 'Ton'}` : '—'}</td>
        <td class="info-label">Freight Rate</td>
        <td class="info-val">${trip.freight_rate ? formatCurrency(trip.freight_rate) : '—'}</td>
      </tr>
    </table>

    <div class="section-title">2. Fleet &amp; Driver Details</div>
    <table class="info-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="info-label">Lorry Number</td>
        <td class="info-val"><span class="plate-box">${trip.lorry_number || '—'}</span></td>
        <td class="info-label">Dispatch Date</td>
        <td class="info-val">${tripDate}</td>
      </tr>
      <tr>
        <td class="info-label">Driver Name</td>
        <td class="info-val">${trip.driver_name || '—'}</td>
        <td class="info-label">Driver Contact</td>
        <td class="info-val">${trip.driver_mobile || '—'}</td>
      </tr>
      ${trip.owner_name ? `
      <tr>
        <td class="info-label">Truck Owner</td>
        <td class="info-val" style="color: #6d28d9; font-weight: 800;">${trip.owner_name}</td>
        <td class="info-label">Owner Contact</td>
        <td class="info-val">${trip.owner_mobile || '—'}</td>
      </tr>
      ` : ''}
    </table>

    <div class="section-title">3. Financial Statement</div>
    <div class="calc-box">
      <div class="calc-row">
        <span>Total Gross Freight:</span>
        <strong style="color: #0f172a; font-size: 13px;">${formatCurrency(trip.total_freight || 0)}</strong>
      </div>
      ${trip.advance_paid ? `
      <div class="calc-row">
        <span>Driver Advance Paid:</span>
        <strong style="color: #b45309;">${formatCurrency(trip.advance_paid)}</strong>
      </div>
      ` : ''}
      <div class="calc-row">
        <span>Amount Received from Party:</span>
        <strong style="color: #15803d;">${formatCurrency(trip.total_received || 0)}</strong>
      </div>
      <div class="calc-row highlight">
        <span>NET BALANCE DUE:</span>
        <span>${formatCurrency(balanceDue)}</span>
      </div>
    </div>

    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-line"></div>
          <div class="sig-title">Driver's Signature</div>
          <div class="sig-sub">Name: <strong>${trip.driver_name || '—'}</strong></div>
          <div class="sig-sub">Date: ${tripDate}</div>
        </td>
        <td style="text-align: right;">
          <div class="sig-line" style="margin-left: auto;"></div>
          <div class="sig-title">Authorized Dispatcher</div>
          <div class="sig-sub">For <strong>KSP TRANSPORT</strong></div>
          <div class="stamp-box">[ OFFICIAL SEAL &amp; STAMP ]</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      Official Transport Waybill &bull; KSP Fleet Management System &bull; System Generated
    </div>
  </div>
</body>
</html>`;
};

// Print Trip PDF Action
export const printTripPdf = async (trip: Trip) => {
  try {
    const html = generateTripHtml(trip);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing trip PDF', error);
    throw error;
  }
};

// ======================= MASTERS PDF =======================

export type MasterPdfTab =
  | 'UNITS'
  | 'ROUTES'
  | 'CLEANING'
  | 'UNLOADING'
  | 'BATA'
  | 'LIMITS'
  | 'OWNERS'
  | 'ADVANCES'
  | 'PARTIES'
  | 'DRIVERS'
  | 'VEHICLES'
  | 'USERS'
  | 'DRIVER_ADVANCES'
  | 'TRUCK_ADVANCES';

export interface MastersPdfData {
  tab: MasterPdfTab;
  tabLabel: string;
  units?: any[];
  routes?: any[];
  cleaningRates?: any[];
  unloadingRates?: any[];
  bataRates?: any[];
  limits?: any[];
  owners?: any[];
  advances?: any[];
  parties?: any[];
  drivers?: any[];
  vehicles?: any[];
  users?: any[];
  driverAdvances?: any[];
  driverSummaries?: any[];
  truckAdvances?: any[];
}

export const generateMastersPdfHtml = (data: MastersPdfData): string => {
  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

  const inr = (v: any) => `₹${Math.round(parseFloat(String(v || 0))).toLocaleString('en-IN')}`;

  const tableWrap = (headers: string[], rows: string[][], emptyMsg: string) => {
    if (rows.length === 0) return `<p style="color:#94a3b8;font-style:italic;padding:10px 0;">${emptyMsg}</p>`;
    return `<table class="mt" cellpadding="0" cellspacing="0">
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r,i)=>`<tr class="${i%2===0?'even':'odd'}">${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  };

  let bodyContent = '';

  if (data.tab === 'UNITS') {
    const rows = (data.units||[]).map((u,i) => [`${i+1}`, `<strong>${u.name}</strong>`, u.abbreviation||'—', u.status||'ACTIVE', u.created_at ? u.created_at.split('T')[0].split('-').reverse().join('/') : '—']);
    bodyContent = tableWrap(['#','Unit Name','Abbreviation','Status','Created Date'], rows, 'No units defined.');
  } else if (data.tab === 'ROUTES') {
    const rows = (data.routes||[]).map((r,i) => [`${i+1}`, `<strong style="color:#1e40af">${r.to_location}</strong>`, r.party_name||'<span style="color:#94a3b8">All Parties</span>', r.rate_per_unit?`<strong style="color:#d97706">${inr(r.rate_per_unit)}/Ton</strong>`:'—', r.distance_km?`${r.distance_km} KM`:'—', r.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Destination / Party Unit','Party','Freight Rate','Distance','Status'], rows, 'No routes defined.');
  } else if (data.tab === 'CLEANING') {
    const rows = (data.cleaningRates||[]).map((c,i) => [`${i+1}`, `<strong>${c.unit_name}</strong>`, `<strong style="color:#d97706">${inr(c.cleaning_charge)}</strong>`, c.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Unit Name','Cleaning Charge','Status'], rows, 'No cleaning rates defined.');
  } else if (data.tab === 'UNLOADING') {
    const rows = (data.unloadingRates||[]).map((u,i) => [`${i+1}`, u.party_name||'—', `<strong>${u.unit_name}</strong>`, u.unit_number||'—', `<strong style="color:#d97706">${inr(u.rate_per_ton)}/Ton</strong>`, u.description||'—', u.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Party','Unit Name','Unit No.','Rate/Ton','Description','Status'], rows, 'No unloading rates defined.');
  } else if (data.tab === 'BATA') {
    const rows = (data.bataRates||[]).map((b,i) => [`${i+1}`, `<strong style="color:#059669">${b.rate_percentage}%</strong>`, `${b.rate_multiplier}x`, b.description||'—', b.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Rate %','Multiplier','Description','Status'], rows, 'No driver bata rates defined.');
  } else if (data.tab === 'LIMITS') {
    const rows = (data.limits||[]).map((l,i) => [`${i+1}`, `<strong style="color:#d97706">${inr(l.max_amount)}</strong>`, l.description||'—', l.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Max Amount (₹)','Description','Status'], rows, 'No expense limits defined.');
  } else if (data.tab === 'OWNERS') {
    const rows = (data.owners||[]).map((o,i) => [`${i+1}`, `<strong>${o.name}</strong>`, o.mobile_number||'—', o.created_at ? o.created_at.split('T')[0].split('-').reverse().join('/') : '—']);
    bodyContent = tableWrap(['#','Owner Name','Mobile','Created Date'], rows, 'No owners defined.');
  } else if (data.tab === 'ADVANCES') {
    const rows = (data.advances||[]).map((a,i) => {
      const isDriver = a.recipient_type === 'DRIVER' || (!a.manager_id && a.driver_id);
      const recipientCol = isDriver
        ? `<span style="color:#7c3aed;font-weight:700;">[DRIVER] ${a.driver_name || `Driver #${a.driver_id}`}</span>${a.lorry_number ? `<br/><small style="color:#64748b;">Truck: ${a.lorry_number}</small>` : ''}`
        : `<span style="color:#0284c7;font-weight:700;">[MANAGER] ${a.manager_name || (a.manager_id ? `Manager #${a.manager_id}` : '—')}</span>`;

      return [
        `${i+1}`,
        a.owner_name || `Owner #${a.owner_id}`,
        recipientCol,
        `<strong style="color:#d97706">${inr(a.amount)}</strong>`,
        a.payment_mode || '—',
        a.advance_date ? a.advance_date.split('T')[0].split('-').reverse().join('/') : '—',
        a.notes || '—'
      ];
    });
    bodyContent = tableWrap(['#','Owner','Received By (Recipient)','Amount','Mode','Date','Notes'], rows, 'No advance records found.');
  } else if (data.tab === 'PARTIES') {
    const rows = (data.parties||[]).map((p,i) => [`${i+1}`, `<strong>${p.name}</strong>`, p.contact_person||'—', p.mobile_number||'—', p.address||'—', p.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Party Name','Contact Person','Mobile','Address','Status'], rows, 'No parties defined.');
  } else if (data.tab === 'DRIVERS') {
    const rows = (data.drivers||[]).map((d,i) => [`${i+1}`, `<strong>${d.name}</strong>`, d.mobile_number||'—', d.license_number||'—', d.license_type||'—', d.license_expiry_date ? d.license_expiry_date.split('T')[0].split('-').reverse().join('/') : '—', d.status||'ACTIVE']);
    bodyContent = tableWrap(['#','Driver Name','Mobile','License No.','Type','License Expiry','Status'], rows, 'No drivers defined.');
  } else if (data.tab === 'VEHICLES') {
    const rows = (data.vehicles||[]).map((v,i) => [
      `${i+1}`,
      `<strong style="color:#1e40af">${v.lorry_number}</strong>`,
      v.owner_name ? `<span style="color:#6d28d9;font-weight:700">${v.owner_name}</span>` : '—',
      v.vehicle_type||'—',
      v.capacity_tons?`${v.capacity_tons} Tons`:'—',
      v.fc_expiry_date ? v.fc_expiry_date.split('T')[0].split('-').reverse().join('/') : '—',
      v.insurance_expiry_date ? v.insurance_expiry_date.split('T')[0].split('-').reverse().join('/') : '—',
      v.status||'ACTIVE'
    ]);
    bodyContent = tableWrap(['#','Lorry Number','Truck Owner','Type','Capacity','FC Expiry','Insurance Expiry','Status'], rows, 'No vehicles defined.');
  } else if (data.tab === 'USERS') {
    const rows = (data.users||[]).map((u,i) => [`${i+1}`, `<strong>${u.name}</strong>`, u.username||'—', `<span style="color:#2563eb;font-weight:700">${u.role}</span>`, u.mobile_number||'—', u.status||'ACTIVE']);
    bodyContent = tableWrap(['#','User Name','Username','Role','Mobile','Status'], rows, 'No users defined.');
  } else if (data.tab === 'DRIVER_ADVANCES') {
    const items = data.driverAdvances || [];
    const summaryById = new Map((data.driverSummaries || []).map((d: any) => [Number(d.driver_id), d]));
    type GiverAmt = { trip: number; noTrip: number };
    const byDriver = new Map<number, {
      driver_id: number;
      driver_name: string;
      managers: Map<string, GiverAmt>;
      owners: Map<string, GiverAmt>;
      tripIds: Set<number>;
      tripAmt: number;
      noTripAmt: number;
      totalAmt: number;
    }>();
    for (const a of items) {
      const id = Number(a.driver_id);
      if (!byDriver.has(id)) {
        byDriver.set(id, {
          driver_id: id,
          driver_name: a.driver_name || '—',
          managers: new Map(),
          owners: new Map(),
          tripIds: new Set(),
          tripAmt: 0,
          noTripAmt: 0,
          totalAmt: 0,
        });
      }
      const row = byDriver.get(id)!;
      const amt = parseFloat(String(a.amount || 0)) || 0;
      const isOwner = a.source_type === 'OWNER_DIRECT_ADVANCE' || a.given_by_role === 'OWNER';
      const name = isOwner
        ? (a.owner_name || a.given_by_name || 'Owner')
        : (a.manager_name || a.given_by_name || 'Manager');
      const bucket = isOwner ? row.owners : row.managers;
      const g = bucket.get(name) || { trip: 0, noTrip: 0 };
      if (a.trip_id) {
        g.trip += amt;
        row.tripAmt += amt;
        row.tripIds.add(Number(a.trip_id));
      } else {
        g.noTrip += amt;
        row.noTripAmt += amt;
      }
      bucket.set(name, g);
      row.totalAmt += amt;
    }
    const driverRows = [...byDriver.values()].sort((a, b) => a.driver_name.localeCompare(b.driver_name));
    const giverHtml = (role: string, map: Map<string, GiverAmt>, color: string) =>
      [...map.entries()].map(([name, g]) => `
        <div style="margin:2px 0">
          <span style="background:${color};font-size:8.5px;font-weight:800;padding:2px 5px;border-radius:3px;text-transform:uppercase">${role}: ${name}</span>
          ${g.trip > 0.5 ? `<div style="font-size:9.5px;font-weight:700;color:#334155;margin-top:2px">For trip: ${inr(g.trip)}</div>` : ''}
          ${g.noTrip > 0.5 ? `<div style="font-size:9.5px;font-weight:700;color:#b45309;margin-top:2px">Without trip: ${inr(g.noTrip)}</div>` : ''}
        </div>`).join('');
    const rows = driverRows.map((r, i) => {
      const d = summaryById.get(r.driver_id);
      const trips = Number(d?.trip_count || r.tripIds.size) || 0;
      const exp = parseFloat(String(d?.total_expenses_reported || 0)) || 0;
      const need = parseFloat(String(d?.need_to_pay || 0)) || 0;
      const bal = Math.max(0, parseFloat(String(d?.balance_in_hand ?? 0)) || 0);
      const fromWhom = `${giverHtml('Manager', r.managers, '#dbeafe')}${giverHtml('Owner', r.owners, '#f3e8ff')}` || '—';
      return [
        `${i + 1}`,
        `<strong>${r.driver_name}</strong>`,
        `<strong>${trips}</strong>`,
        fromWhom,
        `<strong style="color:#0369a1">${inr(r.tripAmt)}</strong>`,
        `<strong style="color:#b45309">${inr(r.noTripAmt)}</strong>`,
        `<strong style="color:#15803d">${inr(r.totalAmt)}</strong>`,
        `<strong style="color:#b45309">${inr(exp)}</strong>`,
        need > 0
          ? `<strong style="color:#dc2626">Pay ${inr(need)}</strong>`
          : `<strong style="color:${bal > 0 ? '#047857' : '#64748b'}">${inr(bal)}</strong>`,
      ];
    });
    const totalAdv = driverRows.reduce((s, r) => s + r.totalAmt, 0);
    const totalExp = driverRows.reduce((s, r) => s + (parseFloat(String(summaryById.get(r.driver_id)?.total_expenses_reported || 0)) || 0), 0);

    bodyContent = `
      ${tableWrap(['#', 'Driver', 'Trips', 'Advance from whom', 'Trip Adv', 'Without Trip', 'Total Advance', 'Expenses', 'Balance in Hand'], rows, 'No driver advance records found.')}
      <div style="margin-top:10px;text-align:right;font-size:12px;font-weight:800;color:#0f172a;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;">
        Drivers: ${driverRows.length} &bull; Total Advance: <span style="color:#059669;font-size:13px;">${inr(totalAdv)}</span> &bull; Expenses: ${inr(totalExp)}
      </div>
    `;
  } else if (data.tab === 'TRUCK_ADVANCES') {
    const totalAdv = (data.truckAdvances || []).reduce((acc: number, t: any) => acc + (parseFloat(String(t.amount || 0)) || 0), 0);
    const rows = (data.truckAdvances || []).map((t, i) => {
      const truckCol = `
        <div><strong style="color:#1e40af;font-size:11px;">${t.lorry_number || '—'}</strong></div>
        ${t.owner_name ? `<div style="font-size:9.5px;color:#6d28d9;font-weight:600;margin-top:2px;">🏢 ${t.owner_name}</div>` : ''}
      `;

      const driverCol = t.driver_name
        ? `<div><strong>${t.driver_name}</strong>${t.driver_mobile ? `<div style="font-size:9.5px;color:#64748b;">${t.driver_mobile}</div>` : ''}</div>`
        : '<span style="color:#94a3b8;">—</span>';

      let tripCol = '<span style="color:#94a3b8;">—</span>';
      if (t.trip_id || t.party_name || t.from_location) {
        const tripNum = t.trip_id ? `<strong style="color:#1e40af;font-size:10.5px;">TRIP #${t.trip_id}</strong>` : '';
        const tripStatus = t.trip_status ? `<span style="background:#eff6ff;color:#1d4ed8;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;border:1px solid #bfdbfe;margin-left:4px;">${t.trip_status}</span>` : '';
        const party = t.party_name ? `<div style="font-weight:700;color:#0f172a;font-size:10px;margin-top:2px;">🏢 ${t.party_name}</div>` : '';
        const route = (t.from_location || t.to_location) ? `<div style="color:#475569;font-size:9.5px;margin-top:1px;">📍 ${t.from_location || '—'} &rarr; ${t.to_location || '—'}</div>` : '';
        const weightFreight = (t.goods_weight || t.total_freight) ? `
          <div style="font-size:9px;color:#64748b;margin-top:2px;">
            ${t.goods_weight ? `<strong>${t.goods_weight} ${t.unit_abbreviation || 'MT'}</strong>` : ''}
            ${(t.goods_weight && t.total_freight) ? ' &bull; ' : ''}
            ${t.total_freight ? `<span style="color:#1d4ed8;font-weight:700;">Freight: ${inr(t.total_freight)}</span>` : ''}
          </div>
        ` : '';
        const tripDate = t.trip_date ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;">📅 ${t.trip_date.split('T')[0].split('-').reverse().join('/')}</div>` : '';

        tripCol = `
          <div>
            ${tripNum}${tripStatus}
            ${party}
            ${route}
            ${weightFreight}
            ${tripDate}
          </div>
        `;
      }

      const advDate = t.advance_date ? t.advance_date.split('T')[0].split('-').reverse().join('/') : '—';

      return [
        `${i + 1}`,
        truckCol,
        driverCol,
        tripCol,
        t.manager_name || '—',
        `<strong style="color:#d97706;font-size:11.5px;">${inr(t.amount)}</strong>`,
        `<span style="white-space:nowrap;font-size:10px;">${advDate}</span>`,
        t.notes || '—'
      ];
    });

    bodyContent = `
      ${tableWrap(['#', 'Lorry & Owner', 'Driver', 'Linked Trip Details', 'Manager', 'Amount (₹)', 'Date', 'Notes'], rows, 'No truck advance records found.')}
      <div style="margin-top:10px;text-align:right;font-size:12px;font-weight:800;color:#0f172a;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;">
        Total Truck Advances: <span style="color:#b45309;font-size:13px;">${inr(totalAdv)}</span> &bull; (${data.truckAdvances?.length || 0} Entries)
      </div>
    `;
  }

  const recordCount = (() => {
    const m: Record<MasterPdfTab, number> = {
      UNITS: (data.units||[]).length,
      ROUTES: (data.routes||[]).length,
      CLEANING: (data.cleaningRates||[]).length,
      UNLOADING: (data.unloadingRates||[]).length,
      BATA: (data.bataRates||[]).length,
      LIMITS: (data.limits||[]).length,
      OWNERS: (data.owners||[]).length,
      ADVANCES: (data.advances||[]).length,
      PARTIES: (data.parties||[]).length,
      DRIVERS: (data.drivers||[]).length,
      VEHICLES: (data.vehicles||[]).length,
      USERS: (data.users||[]).length,
      DRIVER_ADVANCES: (data.driverAdvances||[]).length,
      TRUCK_ADVANCES: (data.truckAdvances||[]).length,
    };
    return m[data.tab] || 0;
  })();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Transport – ${data.tabLabel} Master Report</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${PRINT_BRAND_CSS}
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; }
    .company-sub { font-size: 10px; font-weight: 700; color: #b45309; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
    .company-meta { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.5; }
    .doc-box { text-align: right; }
    .doc-title { font-size: 16px; font-weight: 900; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
    .record-badge {
      display: inline-block;
      background: #0f172a;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      margin-top: 6px;
    }
    .mt {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 11.5px;
    }
    .mt thead tr { background: #0f172a; }
    .mt thead th {
      color: #fff;
      font-weight: 700;
      padding: 7px 10px;
      text-align: left;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .mt tbody tr.even { background: #f8fafc; }
    .mt tbody tr.odd { background: #ffffff; }
    .mt tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 10.5px; }
    .footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${printBrandLockup('Logistics &amp; Fleet Transport Services')}
      <div class="company-meta">Erode, Tamil Nadu &bull; Fleet Management System</div>
    </div>
    <div class="doc-box">
      <div class="doc-title">${data.tabLabel} – Master Report</div>
      <div class="doc-sub">Printed on: ${printDate}</div>
      <div class="record-badge">${recordCount} Record${recordCount !== 1 ? 's' : ''}</div>
    </div>
  </div>

  ${bodyContent}

  <div class="footer">
    <span>KSP Fleet Management System &bull; Master Data Report &bull; ${data.tabLabel}</span>
    <span>System Generated &bull; ${printDate}</span>
  </div>
</body>
</html>`;
};

export const printMastersPdf = async (data: MastersPdfData): Promise<void> => {
  try {
    const html = generateMastersPdfHtml(data);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing masters PDF', error);
    throw error;
  }
};

export const shareMastersPdf = async (data: MastersPdfData): Promise<void> => {
  try {
    const html = generateMastersPdfHtml(data);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share ${data.tabLabel} Master Report`,
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (error) {
    console.error('Error sharing masters PDF', error);
    throw error;
  }
};

export const downloadMastersPdf = async (
  data: MastersPdfData
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateMastersPdfHtml(data);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const tabClean = data.tab.replace(/\s+/g, '_');
    const filename = `KSP_Masters_${tabClean}_${Date.now()}`;

    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { success: true, filename: `${filename}.pdf`, uri: createdFileUri, savedDirectly: true };
        }
      } catch (safErr) {
        console.warn('SAF download failed, falling back to Sharing:', safErr);
      }
    }

    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Download ${data.tabLabel} Master Report`,
      });
    }
    return { success: true, filename: `${filename}.pdf`, uri: targetUri, savedDirectly: false };
  } catch (error) {
    console.error('Error downloading masters PDF', error);
    throw error;
  }
};

// Share Trip PDF Action
export const shareTripPdf = async (trip: Trip) => {
  try {
    const html = generateTripHtml(trip);
    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share Trip Slip #${trip.id}`,
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (error) {
    console.error('Error sharing trip PDF', error);
    throw error;
  }
};

// Download / Save Trip PDF to Local Storage Action
export const downloadTripPdf = async (
  trip: Trip
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateTripHtml(trip);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const lorryClean = trip.lorry_number ? trip.lorry_number.replace(/\s+/g, '_') : 'Truck';
    const filename = `KSP_Trip_${trip.id}_${lorryClean}_${Date.now()}`;

    // On Android: Use StorageAccessFramework to allow user to pick their Downloads/Documents folder
    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            }));

          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );

          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          return {
            success: true,
            filename: `${filename}.pdf`,
            uri: createdFileUri,
            savedDirectly: true,
          };
        }
      } catch (safErr) {
        console.warn('SAF download attempt failed, falling back to Sharing:', safErr);
      }
    }

    // Fallback or iOS: save to documents and open system save dialog
    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({
      from: uri,
      to: targetUri,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Save / Download Trip Slip to Device',
      });
    }

    return {
      success: true,
      filename: `${filename}.pdf`,
      uri: targetUri,
      savedDirectly: false,
    };
  } catch (error) {
    console.error('Error downloading trip PDF', error);
    throw error;
  }
};

// ─── ADMIN REPORTS PDF GENERATION ──────────────────────────────────────────────

export interface ReportsPdfData {
  type: 'TRIPS' | 'PAYMENTS' | 'SETTLEMENTS';
  title: string;
  subtitle?: string;
  dateRange?: string;
  filtersText?: string;
  items: any[];
  summary?: Record<string, any>;
}

export const generateReportsPdfHtml = (data: ReportsPdfData): string => {
  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const inr = (v: any) => `₹${Math.round(parseFloat(String(v || 0))).toLocaleString('en-IN')}`;

  const tableWrap = (headers: string[], rows: string[][], emptyMsg: string, footerRow?: string[]) => {
    if (rows.length === 0) return `<p style="color:#94a3b8;font-style:italic;padding:12px 0;">${emptyMsg}</p>`;
    return `<table class="mt" cellpadding="0" cellspacing="0">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">${r.map((c, ci) => `<td class="${ci === 0 ? 'center' : ''}">${c}</td>`).join('')}</tr>`).join('')}
        ${footerRow ? `<tr class="footer-tr">${footerRow.map((c, ci) => `<td class="${ci === 0 ? 'center' : ''}">${c}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>`;
  };

  let bodyContent = '';

  const parseList = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const driverExpenseBalance = (t: any) => {
    const total = parseFloat(String(t.total_expenses || 0)) || 0;
    const toPay = Math.max(0, parseFloat(String(t.need_to_pay || 0)) || 0);
    return { total, toPay, settled: Math.max(0, total - toPay) };
  };

  const driverExpenseStatus = (t: any) => {
    const amt = parseFloat(String(t.total_expenses || 0)) || 0;
    if (amt <= 0) return 'NO EXPENSE';
    const settle = String(t.settlement_status || '').toUpperCase();
    if (settle === 'SETTLED') return 'SETTLED';
    if (settle === 'VERIFIED') return 'VERIFIED';
    const need = parseFloat(String(t.need_to_pay || 0)) || 0;
    const paid = parseFloat(String(t.driver_cash_paid || 0)) || 0;
    if (paid > 0 && need > 0) return 'PARTIALLY PAID';
    return 'PENDING';
  };

  const expenseStatusBadge = (status: string) => {
    const key = String(status || '').replace(/ /g, '_');
    const cls = key === 'SETTLED' ? 'b-settled' : (key === 'NO_EXPENSE' ? 'b-settled' : 'b-pending');
    return `<span class="badge ${cls}">${status}</span>`;
  };

  if (data.type === 'TRIPS') {
    const items = data.items || [];
    const sumFreight = items.reduce((acc, t) => acc + (parseFloat(String(t.total_freight)) || 0), 0);

    const tripRows = items.map((t, i) => [
      `${i + 1}`,
      `#${t.id}`,
      t.trip_date ? formatDateDMY(t.trip_date) : '—',
      `<strong style="color:#1e40af">${t.lorry_number || '—'}</strong>`,
      `<strong>${t.driver_name || '—'}</strong>`,
      `<strong>${t.party_name || '—'}</strong>`,
      `${t.from_location || ''} → ${t.to_location || ''}`,
      `<strong style="color:#0f172a">${inr(t.total_freight)}</strong>`,
      `<span class="badge ${t.status === 'SETTLED' ? 'b-settled' : 'b-pending'}">${t.status || '—'}</span>`,
    ]);

    const expenseRows: string[][] = [];
    let sumExp = 0;
    let sumSettled = 0;
    let sumToPay = 0;
    items.forEach((t) => {
      const lines = parseList(t.expense_items);
      const bal = driverExpenseBalance(t);
      const tripExp = bal.total;
      sumExp += tripExp;
      sumSettled += bal.settled;
      sumToPay += bal.toPay;
      const statusHtml = expenseStatusBadge(driverExpenseStatus(t));
      const settledHtml = `<span style="color:#15803d;font-weight:700">${inr(bal.settled)}</span>`;
      const toPayHtml = `<strong style="color:${bal.toPay > 0 ? '#b91c1c' : '#15803d'}">${inr(bal.toPay)}</strong>`;
      if (lines.length === 0) {
        if (tripExp <= 0) return;
        expenseRows.push([
          `${expenseRows.length + 1}`,
          t.trip_date ? formatDateDMY(t.trip_date) : '—',
          `<strong>${t.lorry_number || '—'}</strong>`,
          t.driver_name || '—',
          'TOTAL',
          '—',
          `<span style="color:#6d28d9;font-weight:700">${inr(tripExp)}</span>`,
          settledHtml,
          toPayHtml,
          statusHtml,
        ]);
        return;
      }
      lines.forEach((item: any, idx: number) => {
        expenseRows.push([
          `${expenseRows.length + 1}`,
          idx === 0 && t.trip_date ? formatDateDMY(t.trip_date) : '',
          idx === 0 ? `<strong>${t.lorry_number || '—'}</strong>` : '',
          idx === 0 ? (t.driver_name || '—') : '',
          item.expense_type || 'OTHER',
          item.description || '—',
          `<span style="color:#6d28d9;font-weight:700">${inr(item.amount)}</span>`,
          idx === 0 ? settledHtml : '',
          idx === 0 ? toPayHtml : '',
          idx === 0 ? statusHtml : '',
        ]);
      });
    });

    const paymentRows: string[][] = [];
    let sumRec = 0;
    let sumBal = 0;
    items.forEach((t) => {
      const lines = parseList(t.payment_items);
      const rec = parseFloat(String(t.total_received)) || 0;
      const bal = parseFloat(String(t.balance_due)) || 0;
      sumRec += rec;
      sumBal += bal;
      if (lines.length === 0) {
        paymentRows.push([
          `${paymentRows.length + 1}`,
          t.trip_date ? formatDateDMY(t.trip_date) : '—',
          `<strong>${t.lorry_number || '—'}</strong>`,
          t.party_name || '—',
          '—',
          inr(t.total_freight),
          `<span style="color:#15803d;font-weight:700">${inr(rec)}</span>`,
          `<strong style="color:${bal > 0 ? '#b91c1c' : '#15803d'}">${inr(bal)}</strong>`,
        ]);
        return;
      }
      lines.forEach((item: any, idx: number) => {
        paymentRows.push([
          `${paymentRows.length + 1}`,
          idx === 0 && t.trip_date ? formatDateDMY(t.trip_date) : '',
          idx === 0 ? `<strong>${t.lorry_number || '—'}</strong>` : '',
          idx === 0 ? (t.party_name || '—') : '',
          item.payment_date ? formatDateDMY(item.payment_date) : '—',
          idx === 0 ? inr(t.total_freight) : '',
          `<span style="color:#15803d;font-weight:700">${inr(item.received_amount)}</span>`,
          `<strong style="color:${(parseFloat(String(item.balance_due)) || 0) > 0 ? '#b91c1c' : '#15803d'}">${inr(item.balance_due)}</strong>`,
        ]);
      });
    });

    bodyContent = `
      <div class="section-title">1. Trip Dispatch</div>
      ${tableWrap(
        ['#', 'Trip ID', 'Date', 'Lorry', 'Driver', 'Party', 'Route', 'Freight', 'Status'],
        tripRows,
        'No trips found for selected filters.',
        ['TOTAL', `${items.length} Trips`, '', '', '', '', '', `<strong>${inr(sumFreight)}</strong>`, '']
      )}
      <div class="section-title exp">2. Driver Expenses</div>
      ${tableWrap(
        ['#', 'Trip Date', 'Lorry', 'Driver', 'Type', 'Description', 'Amount', 'Settled', 'To Pay', 'Status'],
        expenseRows,
        'No driver expenses for these trips.',
        ['TOTAL', `${expenseRows.length} line(s)`, '', '', '', '', `<strong>${inr(sumExp)}</strong>`, `<strong>${inr(sumSettled)}</strong>`, `<strong>${inr(sumToPay)}</strong>`, '']
      )}
      <div class="section-title pay">3. Party Payments</div>
      ${tableWrap(
        ['#', 'Trip Date', 'Lorry', 'Party', 'Paid Date', 'Freight', 'Received', 'Balance Due'],
        paymentRows,
        'No party payments for these trips.',
        ['TOTAL', `${paymentRows.length} line(s)`, '', '', '', '', `<strong>${inr(sumRec)}</strong>`, `<strong>${inr(sumBal)}</strong>`]
      )}
    `;
  } else if (data.type === 'PAYMENTS') {
    const items = data.items || [];
    const sumReceived = items.reduce((acc, p) => acc + (parseFloat(String(p.received_amount)) || 0), 0);
    const sumFreight = items.reduce((acc, p) => acc + (parseFloat(String(p.total_freight)) || 0), 0);
    const sumBal = items.reduce((acc, p) => acc + (parseFloat(String(p.balance_due)) || 0), 0);

    const rows = items.map((p, i) => [
      `${i + 1}`,
      `#${p.id}`,
      p.trip_id ? `#${p.trip_id}` : '—',
      p.payment_date ? formatDateDMY(p.payment_date) : '—',
      `<strong>${p.party_name || '—'}</strong>`,
      `<strong style="color:#1e40af">${p.lorry_number || '—'}</strong>`,
      p.owner_name ? `<span style="color:#6d28d9;font-weight:700">🏢 ${p.owner_name}</span>` : '—',
      `<strong style="color:#15803d;font-size:12px">${inr(p.received_amount)}</strong>`,
      `<span>${inr(p.total_freight)}</span>`,
      `<strong style="color:${(parseFloat(String(p.balance_due)) || 0) > 0 ? '#b91c1c' : '#15803d'}">${inr(p.balance_due)}</strong>`,
      `<span class="badge ${p.payment_status === 'PAID' ? 'b-settled' : 'b-pending'}">${p.payment_status || 'PAID'}</span>`,
    ]);

    const footer = [
      'TOTAL',
      `${items.length} Records`,
      '',
      '',
      '',
      '',
      '',
      `<strong style="color:#15803d">${inr(sumReceived)}</strong>`,
      `<strong>${inr(sumFreight)}</strong>`,
      `<strong>${inr(sumBal)}</strong>`,
      '',
    ];

    bodyContent = tableWrap(
      ['#', 'Pay ID', 'Trip ID', 'Date', 'Party Name', 'Lorry Number', 'Truck Owner', 'Received Amount', 'Total Freight', 'Balance Due', 'Status'],
      rows,
      'No payment records found for selected filters.',
      footer
    );
  } else if (data.type === 'SETTLEMENTS') {
    const items = data.items || [];
    const sumFreight = items.reduce((acc, s) => acc + (parseFloat(String(s.total_freight)) || 0), 0);
    const sumExp = items.reduce((acc, s) => acc + (parseFloat(String(s.total_expenses)) || 0), 0);
    const sumAdv = items.reduce((acc, s) => acc + (parseFloat(String(s.advance_paid)) || 0), 0);
    const outcome = (s: any) => {
      const expenses = Math.round(Number(s.total_expenses || 0));
      const managerGiven = Math.round(Number(s.manager_advance ?? s.initial_trip_advance ?? 0));
      const priorDeficit = Math.round(Number(s.prior_deficit_deduction || 0));
      const manager = s.effective_manager_advance != null
        ? Math.round(Number(s.effective_manager_advance))
        : Math.max(0, managerGiven - priorDeficit);
      const ownerGiven = Math.round(Number(s.owner_given || 0));
      const leftoverUsed = Math.round(Number(s.owner_leftover_used || 0));
      const ownerBal = Math.round(Number(s.owner_balance || 0));
      const cashPaid = s.payment_mode !== 'ADJUSTED_ADVANCE' ? Math.round(Number(s.paid_amount || 0)) : 0;
      const needToPay = ownerBal > 0 ? 0 : Math.max(0, expenses - manager - ownerGiven - leftoverUsed - cashPaid);
      const inHand = ownerBal > 0 ? ownerBal : 0;
      return { needToPay, inHand };
    };
    const sumNeed = items.reduce((acc, s) => acc + outcome(s).needToPay, 0);
    const sumInHand = items.reduce((acc, s) => acc + outcome(s).inHand, 0);

    const rows = items.map((s, i) => [
      `${i + 1}`,
      `#${s.id}`,
      s.trip_id ? `Trip #${s.trip_id}` : '—',
      s.trip_date ? formatDateDMY(s.trip_date) : s.created_at ? formatDateDMY(s.created_at) : '—',
      `<strong style="color:#1e40af">${s.lorry_number || '—'}</strong>`,
      s.owner_name ? `<span style="color:#6d28d9;font-weight:700">🏢 ${s.owner_name}</span>` : '—',
      `<strong>${s.driver_name || '—'}</strong>`,
      `<span>${s.party_name || '—'}</span>`,
      `<span>${inr(s.total_freight)}</span>`,
      `<span style="color:#b45309">${inr(s.total_expenses)}</span>`,
      `<span>${inr(s.advance_paid)}</span>`,
      `<strong style="color:#b91c1c">${inr(outcome(s).needToPay)}</strong>`,
      `<strong style="color:#047857">${inr(outcome(s).inHand)}</strong>`,
      `<span class="badge ${s.settlement_status === 'SETTLED' ? 'b-settled' : 'b-pending'}">${s.settlement_status || 'SETTLED'}</span>`,
    ]);

    const footer = [
      'TOTAL',
      `${items.length} Settlements`,
      '',
      '',
      '',
      '',
      '',
      '',
      `<strong>${inr(sumFreight)}</strong>`,
      `<strong>${inr(sumExp)}</strong>`,
      `<strong>${inr(sumAdv)}</strong>`,
      `<strong style="color:#b91c1c">${inr(sumNeed)}</strong>`,
      `<strong style="color:#047857">${inr(sumInHand)}</strong>`,
      '',
    ];

    bodyContent = tableWrap(
      ['#', 'Settlement ID', 'Trip ID', 'Trip Date', 'Lorry Number', 'Truck Owner', 'Driver Name', 'Party', 'Freight', 'Expenses', 'Advance', 'Need to Pay', 'Balance in Hand', 'Status'],
      rows,
      'No settlement records found for selected filters.',
      footer
    );
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Transport – ${data.title}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
    }
    ${PRINT_BRAND_CSS}
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 0.8px; text-transform: uppercase; }
    .company-sub { font-size: 10px; font-weight: 700; color: #b45309; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px; }
    .company-meta { font-size: 10px; color: #64748b; margin-top: 3px; }
    .doc-box { text-align: right; }
    .doc-title { font-size: 15px; font-weight: 900; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-sub { font-size: 10.5px; color: #64748b; margin-top: 2px; }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin: 14px 0 6px;
      padding: 6px 10px;
      background: #f1f5f9;
      border-left: 4px solid #2563eb;
    }
    .section-title.exp { border-left-color: #7c3aed; }
    .section-title.pay { border-left-color: #15803d; }
    .filter-bar {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 10.5px;
      color: #475569;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .mt {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .mt thead tr { background: #0f172a; }
    .mt thead th {
      color: #fff;
      font-weight: 700;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .mt tbody tr.even { background: #fbfcfe; }
    .mt tbody tr.odd { background: #ffffff; }
    .mt tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .center { text-align: center; }
    .footer-tr td {
      background: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      color: #0f172a;
      padding: 7px 8px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .b-settled { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .b-pending { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .b-active { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .footer {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${printBrandLockup('Logistics &amp; Fleet Transport Operations')}
      <div class="company-meta">Erode, Tamil Nadu &bull; ERP Report Audit</div>
    </div>
    <div class="doc-box">
      <div class="doc-title">${data.title}</div>
      <div class="doc-sub">Generated: ${printDate}</div>
    </div>
  </div>

  <div class="filter-bar">
    <span><strong>Active Filters:</strong> ${data.filtersText || 'All Records (No Filters)'}</span>
    <span><strong>Total Count:</strong> ${data.items?.length || 0} Records</span>
  </div>

  ${bodyContent}

  <div class="footer">
    <span>KSP Service Management ERP &bull; Admin Audit Report &bull; ${data.title}</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;
};

export const printReportsPdf = async (data: ReportsPdfData): Promise<void> => {
  try {
    const html = generateReportsPdfHtml(data);
    await Print.printAsync({ html });
  } catch (err) {
    console.error('Print reports PDF error', err);
    throw err;
  }
};

export const shareReportsPdf = async (data: ReportsPdfData): Promise<void> => {
  try {
    const html = generateReportsPdfHtml(data);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share ${data.title}`,
      });
    }
  } catch (err) {
    console.error('Share reports PDF error', err);
    throw err;
  }
};

export const downloadReportsPdf = async (
  data: ReportsPdfData
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateReportsPdfHtml(data);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const cleanTitle = data.type.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `KSP_${cleanTitle}_Report_${Date.now()}`;

    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            }));

          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );

          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          return {
            success: true,
            filename: `${filename}.pdf`,
            uri: createdFileUri,
            savedDirectly: true,
          };
        }
      } catch (safErr) {
        console.warn('SAF download attempt failed, falling back to Sharing:', safErr);
      }
    }

    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Save ${data.title} to Device`,
      });
    }

    return {
      success: true,
      filename: `${filename}.pdf`,
      uri: targetUri,
      savedDirectly: false,
    };
  } catch (err) {
    console.error('Download reports PDF error', err);
    throw err;
  }
};

// ─── SINGLE PAYMENT VOUCHER PDF ───────────────────────────────────────────────

export const generatePaymentVoucherHtml = (payment: any): string => {
  const inr = (v: any) => `₹${Math.round(parseFloat(String(v || 0))).toLocaleString('en-IN')}`;
  const payDate = payment.payment_date ? formatDateDMY(payment.payment_date) : formatDateDMY(new Date());

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt #${payment.id}</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 16px;
    }
    .voucher-card {
      border: 2px solid #0f172a;
      border-radius: 6px;
      padding: 24px;
      max-width: 720px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title { font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
    .company-sub { font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-top: 2px; }
    .doc-box { text-align: right; }
    .doc-title { font-size: 16px; font-weight: 900; color: #1e40af; text-transform: uppercase; }
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; }
    .info-grid td { padding: 8px 10px; border: 1px solid #e2e8f0; }
    .lbl { background: #f8fafc; font-weight: 700; width: 28%; color: #475569; }
    .val { font-weight: 600; color: #0f172a; }
    .amount-box {
      background: #f0fdf4;
      border: 2px solid #86efac;
      border-radius: 6px;
      padding: 16px;
      text-align: center;
      margin-bottom: 20px;
    }
    .amt-label { font-size: 12px; font-weight: 700; color: #15803d; text-transform: uppercase; }
    .amt-value { font-size: 28px; font-weight: 900; color: #15803d; margin-top: 4px; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px; }
    .sign-box { border-top: 1px solid #0f172a; width: 180px; text-align: center; padding-top: 6px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="voucher-card">
    <div class="header">
      <div>
        ${printBrandLockup('Party Freight Payment Voucher')}
      </div>
      <div class="doc-box">
        <div class="doc-title">Receipt #${payment.id}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Date: ${payDate}</div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amt-label">Amount Received</div>
      <div class="amt-value">${inr(payment.received_amount)}</div>
    </div>

    <table class="info-grid">
      <tr>
        <td class="lbl">Trip ID</td>
        <td class="val">${payment.trip_id ? `#${payment.trip_id}` : '—'}</td>
        <td class="lbl">Payment Date</td>
        <td class="val">${payDate}</td>
      </tr>
      <tr>
        <td class="lbl">Party / Consignor</td>
        <td class="val" colspan="3"><strong>${payment.party_name || '—'}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Lorry Number</td>
        <td class="val"><strong>${payment.lorry_number || '—'}</strong></td>
        <td class="lbl">Truck Owner</td>
        <td class="val"><strong style="color:#6d28d9">${payment.owner_name ? `🏢 ${payment.owner_name}` : '—'}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Total Trip Freight</td>
        <td class="val">${inr(payment.total_freight)}</td>
        <td class="lbl">Outstanding Balance</td>
        <td class="val" style="color:${(parseFloat(String(payment.balance_due)) || 0) > 0 ? '#b91c1c' : '#15803d'}"><strong>${inr(payment.balance_due)}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Payment Status</td>
        <td class="val" colspan="3"><strong style="color:#15803d">${payment.payment_status || 'PAID'}</strong></td>
      </tr>
    </table>

    <div class="sign-row">
      <div class="sign-box">Received By (Authorized)</div>
      <div class="sign-box">Payer Signature / Stamp</div>
    </div>
  </div>
</body>
</html>`;
};

export const downloadPaymentPdf = async (
  payment: any
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generatePaymentVoucherHtml(payment);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const filename = `KSP_Payment_${payment.id}_${Date.now()}`;

    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            }));

          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );

          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          return {
            success: true,
            filename: `${filename}.pdf`,
            uri: createdFileUri,
            savedDirectly: true,
          };
        }
      } catch (safErr) {
        console.warn('SAF download attempt failed, falling back to Sharing:', safErr);
      }
    }

    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Save Payment Receipt to Device`,
      });
    }

    return {
      success: true,
      filename: `${filename}.pdf`,
      uri: targetUri,
      savedDirectly: false,
    };
  } catch (err) {
    console.error('Download payment PDF error', err);
    throw err;
  }
};

/* ─────────────────────────────────────────────────────────────
   Driver Advance, Expenses & Settlement Statement PDF
───────────────────────────────────────────────────────────── */

export interface DriverStatementPdfData {
  driver: {
    id: number;
    name: string;
    mobile_number?: string;
    license_number?: string;
    status?: string;
  };
  summary: {
    total_advance_given: number;
    total_expenses: number;
    total_settled_cash_paid: number;
    balance_in_manager_hand: number;
    is_deficit: boolean;
    is_surplus: boolean;
    is_settled: boolean;
    deficit_amount: number;
    surplus_amount: number;
    manager_advance_total?: number;
    owner_advance_total?: number;
  };
  timeline: Array<{
    id: string;
    type: 'ADVANCE' | 'EXPENSE' | 'SETTLEMENT';
    date: string;
    title: string;
    subtitle?: string;
    amount: number;
    effect: '+' | '-';
    notes?: string;
    ref_id?: string;
    lorry_number?: string;
    settlement_status?: string;
    given_by?: string;
    given_by_role?: string;
    given_by_name?: string;
    balance_due?: number;
  }>;
  dateRangeText?: string;
  advances?: any[];
  trips_and_expenses?: any[];
  settlement_payments?: any[];
}

const pdfSafeText = (val: any) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[₹]/g, 'Rs. ')
    .replace(/[→]/g, '-&gt;')
    .replace(/[←]/g, '&lt;-')
    .replace(/[−–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');

const printHtmlToFile = async (html: string) => {
  try {
    return await Print.printToFileAsync({ html });
  } catch (firstErr) {
    const stripped = html.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
    try {
      return await Print.printToFileAsync({ html: stripped });
    } catch {
      throw firstErr;
    }
  }
};

export const generateDriverStatementHtml = (data: DriverStatementPdfData): string => {
  const esc = pdfSafeText;

  const formatCurrency = (val: number | string) => {
    const num = Math.round(parseFloat(String(val)) || 0);
    const digits = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `Rs. ${num < 0 ? '-' : ''}${digits}`;
  };

  const printDate = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isDeficit = data.summary.is_deficit;
  const isSurplus = data.summary.is_surplus;
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const managerAdvanceTotal = data.summary.manager_advance_total ?? timeline
    .filter((i) => i.type === 'ADVANCE' && i.given_by_role !== 'Owner')
    .reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);
  const ownerAdvanceTotal = data.summary.owner_advance_total ?? timeline
    .filter((i) => i.type === 'ADVANCE' && i.given_by_role === 'Owner')
    .reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);
  const needToPay = Math.round(parseFloat(String(data.summary.deficit_amount || 0)) || 0);
  const balanceInHand = Math.round(parseFloat(String(data.summary.surplus_amount || 0)) || 0);

  const groupAdvances = (isOwner: boolean) => {
    const groups = new Map<string, number>();
    for (const item of timeline) {
      if (item.type !== 'ADVANCE') continue;
      if ((item.given_by_role === 'Owner') !== isOwner) continue;
      const name = (item.given_by_name || (isOwner ? 'Owner' : 'Manager')).trim();
      groups.set(name, (groups.get(name) || 0) + (parseFloat(String(item.amount)) || 0));
    }
    return Array.from(groups.entries());
  };
  const managerBreakdownHtml = groupAdvances(false).map(([name, amt]) =>
    `<div style="font-size:11px;font-weight:700;color:#1e3a8a;padding:2px 0;">${esc(name)} - ${formatCurrency(amt)}</div>`
  ).join('') || `<div style="font-size:11px;color:#64748b;">No manager advances</div>`;
  const ownerBreakdownHtml = groupAdvances(true).map(([name, amt]) =>
    `<div style="font-size:11px;font-weight:700;color:#5b21b6;padding:2px 0;">${esc(name)} - ${formatCurrency(amt)}</div>`
  ).join('') || `<div style="font-size:11px;color:#64748b;">No owner advances</div>`;

  const tripStories = buildDriverTripStories(timeline);
  let tripNo = 0;
  const storiesHtml = tripStories.length > 0
    ? tripStories.map((story) => {
        const br = getSettlementBreakdown(story);
        const laterPays = (br.laterPays || []).filter((pay, idx, arr) =>
          arr.findIndex((p) => String(p.sourceTripId || p.sourceLabel) === String(pay.sourceTripId || pay.sourceLabel)) === idx
        );
        const laterCovered = laterPays.reduce((s, p) => s + Math.round(p.thisTripPaid || 0), 0);
        const priorFromExp = story.expenses
          .map((e: any) => Math.round(parseFloat(String(e.prior_deficit_deduction || 0)) || 0))
          .find((n: number) => n > 0) || 0;
        const priorFromApplied = (br.appliedTo || []).reduce((s, r) => s + Math.round(r.amount || 0), 0);
        const reducedPrior = Math.max(
          Math.round(br.cashMovement?.reducedDue || 0),
          priorFromApplied,
          priorFromExp
        );
        const priorTripLabel = (br.appliedTo || [])
          .map((r) => (r.tripId ? `Trip #${r.tripId}` : r.label))
          .filter(Boolean)
          .join(', ') || 'previous trip';
        const availableThisTrip = Math.max(0, Math.round(story.totalAdvance || 0) + Math.round(story.broughtForward || 0) - reducedPrior);
        const calcNeed = Math.round(story.needToPay || 0);
        const leftoverLater = laterPays.reduce((s, p) => s + Math.round(p.leftoverInHand || Math.max(0, (p.totalGiven || 0) - (p.thisTripPaid || 0))), 0);
        const calcHand = calcNeed > 0.5 ? 0 : Math.max(0, Math.round(story.balanceInHand || 0), leftoverLater);
        const resultLabel = calcNeed > 0.5 ? 'NEED TO PAY' : calcHand > 0.5 ? 'BALANCE IN HAND' : 'BALANCED';
        const resultAmt = calcNeed > 0.5 ? calcNeed : calcHand;
        const resultColor = calcNeed > 0.5 ? '#dc2626' : calcHand > 0.5 ? '#16a34a' : '#475569';
        tripNo += 1;
        const title = `Trip ${tripNo}${story.tripId ? ' #' + story.tripId : ''}${story.date ? ' - ' + formatDateDMY(story.date) : ''}`;
        const infoRows = [
          ['Party', story.partyName],
          ['Truck No', story.lorry],
          ['Owner', story.ownerName],
          ['Route', story.route ? String(story.route).replace(/→/g, 'to') : ''],
        ].filter(([, val]) => !!val)
          .map(([label, val]) => `<tr><td style="padding:2px 8px;width:90px;font-size:10px;font-weight:800;color:#64748b;">${esc(label)}</td><td style="padding:2px 8px;font-size:11px;font-weight:700;color:#0f172a;">${esc(val)}</td></tr>`)
          .join('');
        const balAdv = storyBalanceAdvance(story);
        const cashSettles = storyCashSettlements(story);
        if (!cashSettles.length && br.paid > 0) cashSettles.push({ amount: br.paid, by: 'Admin' });
        const nextTripLabel = (pay: { sourceTripId?: number | null; sourceLabel?: string }) =>
          pay.sourceTripId ? `Trip #${pay.sourceTripId}` : (pay.sourceLabel || 'next trip');
        const advRows = [
          ...story.advances.map((adv: any) => {
            const who = `${adv.given_by_role === 'Owner' ? 'Owner' : 'Manager'}: ${adv.given_by_name || (adv.given_by_role === 'Owner' ? 'Owner' : 'Manager')}`;
            return `<tr><td style="padding:3px 8px;font-size:11px;">${esc(who)}</td><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#1d4ed8;text-align:right;">${formatCurrency(adv.amount)}</td></tr>`;
          }),
          ...laterPays.map((pay) => {
            const used = Math.round(pay.thisTripPaid || 0);
            const left = Math.max(0, Math.round(pay.leftoverInHand || 0), laterPays.length === 1 ? calcHand : 0);
            const full = Math.max(Math.round(pay.totalGiven || 0), used + left);
            const owner = /Owner/i.test(String(pay.sourceLabel || ''));
            const who = owner
              ? String(pay.sourceLabel || 'Owner').replace(/^Advance from\s+/i, '')
              : `Next trip (${nextTripLabel(pay)})`;
            return `<tr><td style="padding:3px 8px;font-size:11px;font-weight:800;color:${owner ? '#6d28d9' : '#166534'};">${esc(who)} given</td><td style="padding:3px 8px;font-size:11px;font-weight:800;color:${owner ? '#6d28d9' : '#166534'};text-align:right;">${formatCurrency(full)}</td></tr>
                    <tr><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#c2410c;">Less: reduced to this trip dues</td><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#c2410c;text-align:right;">(-) ${formatCurrency(used)}</td></tr>`;
          }),
          ...(reducedPrior > 0.5
            ? [`<tr><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#c2410c;">Less: given advance used for ${esc(priorTripLabel)}</td><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#c2410c;text-align:right;">(-) ${formatCurrency(reducedPrior)}</td></tr>`]
            : []),
          ...(balAdv ? [`<tr><td style="padding:3px 8px;font-size:11px;color:#047857;">Owner Advance Bal: ${esc(balAdv.name)}</td><td style="padding:3px 8px;font-size:11px;font-weight:800;color:#047857;text-align:right;">${formatCurrency(balAdv.amount)}</td></tr>`] : []),
        ].join('') || `<tr><td colspan="2" style="padding:3px 8px;font-size:11px;color:#94a3b8;">No advance recorded</td></tr>`;
        const cm = br.cashMovement;
        const showSettle = br.happened || br.stillToPay > 0 || br.remainingInHand > 0 || !!balAdv || cashSettles.length > 0;
        const settleRows = showSettle ? `
          <tr><td colspan="2" style="padding:6px 8px;background:#f0fdf4;font-size:10px;font-weight:800;color:#15803d;">4. SETTLEMENT / ADJUSTMENT</td></tr>
          ${balAdv ? `<tr><td style="padding:3px 8px;font-size:11px;color:#c2410c;">Settlement done by adjustment</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#c2410c;text-align:right;">${formatCurrency(balAdv.amount)}</td></tr>
          <tr><td colspan="2" style="padding:2px 8px 4px;font-size:10px;color:#9a3412;">Owner Advance Bal (${esc(balAdv.name)})</td></tr>` : ''}
          ${cashSettles.map((p) => `<tr><td style="padding:3px 8px;font-size:11px;color:#15803d;">Settlement done by ${esc(p.by)}</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#15803d;text-align:right;">${formatCurrency(p.amount)}</td></tr>`).join('')}
          ${laterPays.length === 0 && cm ? `
            <tr><td style="padding:3px 8px;font-size:11px;color:#6d28d9;">${esc(cm.sourceLabel)} total</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#6d28d9;text-align:right;">${formatCurrency(cm.totalGiven)}</td></tr>
            <tr><td style="padding:3px 8px;font-size:11px;color:#166534;">Reduced previous trip due</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#166534;text-align:right;">${formatCurrency(cm.reducedDue)}</td></tr>
            <tr><td style="padding:3px 8px;font-size:11px;color:#047857;">Balance in hand after this</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#047857;text-align:right;">${formatCurrency(cm.leftInHand)}</td></tr>
          ` : ''}
          ${!balAdv && laterPays.length === 0 && !cm ? br.sources.map((src) => `<tr><td style="padding:3px 8px;font-size:11px;color:#166534;">Adjusted leftover from ${esc(src.label)}</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#166534;text-align:right;">${formatCurrency(src.amount)}</td></tr>`).join('') : ''}
          ${!balAdv && laterPays.length === 0 && !cm && br.sources.length === 0 && br.adjusted > 0 ? `<tr><td style="padding:3px 8px;font-size:11px;color:#166534;">Adjusted leftover</td><td style="padding:3px 8px;font-size:12px;font-weight:800;color:#166534;text-align:right;">${formatCurrency(br.adjusted)}</td></tr>` : ''}
          ${br.appliedTo.map((row, ri) => `<tr><td colspan="2" style="padding:2px 8px 2px 16px;font-size:10px;color:#334155;">${ri + 1}. Adjusted ${esc(row.label)}: ${formatCurrency(row.amount)}${row.remainingOnThatTrip > 0 ? ' (still ' + formatCurrency(row.remainingOnThatTrip) + ')' : ' (fully settled)'}</td></tr>`).join('')}
          ${calcNeed > 0.5 ? `<tr><td style="padding:6px 8px;font-size:11px;font-weight:800;color:#b91c1c;">Need to pay</td><td style="padding:6px 8px;font-size:13px;font-weight:800;color:#b91c1c;text-align:right;">${formatCurrency(calcNeed)}</td></tr>` : ''}
        ` : '';
        return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #cbd5e1;margin:8px 0;">
          <tr><td colspan="2" style="padding:8px;background:#f8fafc;font-size:12px;font-weight:800;color:#0f172a;">${esc(title)}</td></tr>
          ${infoRows}
          <tr><td colspan="2" style="padding:6px 8px 2px;font-size:10px;font-weight:800;color:#1d4ed8;">1. ADVANCE GIVEN</td></tr>
          ${advRows}
          <tr><td colspan="2" style="padding:6px 8px 2px;font-size:10px;font-weight:800;color:#c2410c;">2. TRIP EXPENSES</td></tr>
          <tr><td colspan="2" style="padding:2px 8px 6px;font-size:13px;font-weight:800;color:#9a3412;">${formatCurrency(story.totalExpenses)}</td></tr>
          <tr><td colspan="2" style="padding:6px 8px;background:#f8fafc;font-size:10px;font-weight:800;color:#475569;">3. CALCULATION</td></tr>
          ${story.broughtForward > 0 ? `<tr><td colspan="2" style="padding:2px 8px;font-size:11px;color:#047857;font-weight:700;">Previous in hand ${formatCurrency(story.broughtForward)}</td></tr>` : ''}
          <tr><td colspan="2" style="padding:2px 8px;font-size:11px;color:#334155;">Advance ${formatCurrency(Math.max(availableThisTrip, laterCovered, Math.round(story.totalAdvance || 0)))}</td></tr>
          ${reducedPrior > 0 ? `<tr><td colspan="2" style="padding:2px 8px;font-size:11px;font-weight:800;color:#c2410c;">Less: given advance used for ${esc(priorTripLabel)} (-) ${formatCurrency(reducedPrior)}</td></tr>` : ''}
          <tr><td colspan="2" style="padding:2px 8px;font-size:11px;color:#334155;">Expenses ${formatCurrency(story.totalExpenses)}</td></tr>
          ${story.inHandUsed > 0 ? `<tr><td colspan="2" style="padding:2px 8px;font-size:11px;font-weight:700;color:#b45309;">Balance in hand used ${formatCurrency(story.inHandUsed)}</td></tr>` : ''}
          <tr>
            <td style="padding:4px 8px 8px;font-size:11px;font-weight:800;color:${resultColor};">${resultLabel}</td>
            <td style="padding:4px 8px 8px;font-size:14px;font-weight:800;color:${resultColor};text-align:right;">${formatCurrency(resultAmt)}</td>
          </tr>
          ${settleRows}
        </table>`;
      }).join('')
    : `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">No transactions recorded for this driver.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Driver Statement - ${esc(data.driver.name)}</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; padding: 12px; }
    td { vertical-align: top; }
  </style>
</head>
<body>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td>
              ${printBrandLockup('Driver Statement')}
            </td>
            <td style="text-align:right;">
              <div style="background:#0f172a;color:#ffffff;padding:4px 10px;font-size:11px;font-weight:800;">DRIVER STATEMENT</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">Generated: ${esc(printDate)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #cbd5e1;margin-bottom:14px;">
          <tr>
            <td style="padding:6px 8px;width:18%;color:#64748b;font-weight:700;font-size:11px;">DRIVER NAME:</td>
            <td style="padding:6px 8px;width:32%;font-size:14px;font-weight:800;">${esc(data.driver.name)}</td>
            <td style="padding:6px 8px;width:18%;color:#64748b;font-weight:700;font-size:11px;">MOBILE:</td>
            <td style="padding:6px 8px;width:32%;font-weight:700;font-size:11px;">${esc(data.driver.mobile_number || '-')}</td>
          </tr>
          <tr>
            <td style="padding:6px 8px;color:#64748b;font-weight:700;font-size:11px;">DRIVER ID:</td>
            <td style="padding:6px 8px;font-weight:700;font-size:11px;">#${data.driver.id}</td>
            <td style="padding:6px 8px;color:#64748b;font-weight:700;font-size:11px;">PERIOD:</td>
            <td style="padding:6px 8px;font-size:11px;">${esc(data.dateRangeText || 'All Transactions')}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;background:${isDeficit ? '#fef2f2' : isSurplus ? '#f0fdf4' : '#f8fafc'};border:2px solid ${isDeficit ? '#f87171' : isSurplus ? '#4ade80' : '#94a3b8'};">
          <tr>
            <td style="padding:12px 16px;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
                ${isDeficit ? 'DEFICIT - BALANCE NEED TO PAY TO DRIVER' : isSurplus ? 'SURPLUS - BALANCE IN DRIVER HAND' : 'ALL BALANCES FULLY SETTLED'}
              </div>
              <div style="font-size:10px;margin-top:2px;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
                ${isDeficit ? `Trip expenses exceeded advance. Manager/office must pay ${formatCurrency(data.summary.deficit_amount)} to driver.` : isSurplus ? `Remaining advance of ${formatCurrency(data.summary.surplus_amount)} held in driver hand.` : 'Advance received and trip expenses are completely balanced.'}
              </div>
            </td>
            <td style="padding:12px 16px;font-size:22px;font-weight:800;text-align:right;color:${isDeficit ? '#991b1b' : isSurplus ? '#166534' : '#334155'};">
              ${isDeficit ? formatCurrency(data.summary.deficit_amount) : isSurplus ? formatCurrency(data.summary.surplus_amount) : 'Rs. 0'}
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;text-align:center;width:25%;">
              <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;">Advance Given</div>
              <div style="font-size:15px;font-weight:800;color:#6d28d9;">${formatCurrency(data.summary.total_advance_given)}</div>
            </td>
            <td style="border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;text-align:center;width:25%;">
              <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;">Trip Expenses</div>
              <div style="font-size:15px;font-weight:800;color:#c2410c;">${formatCurrency(data.summary.total_expenses)}</div>
            </td>
            <td style="border:1px solid #fecaca;padding:8px 10px;background:#fef2f2;text-align:center;width:25%;">
              <div style="font-size:9px;font-weight:800;color:#dc2626;text-transform:uppercase;">Need to Pay</div>
              <div style="font-size:15px;font-weight:800;color:#dc2626;">${formatCurrency(needToPay)}</div>
            </td>
            <td style="border:1px solid #bbf7d0;padding:8px 10px;background:#f0fdf4;text-align:center;width:25%;">
              <div style="font-size:9px;font-weight:800;color:#16a34a;text-transform:uppercase;">Balance in Hand</div>
              <div style="font-size:15px;font-weight:800;color:#16a34a;">${formatCurrency(balanceInHand)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="border:1px solid #bfdbfe;padding:8px 10px;background:#eff6ff;width:50%;">
              <div style="font-size:9px;font-weight:800;color:#1d4ed8;text-transform:uppercase;">From Manager - ${formatCurrency(managerAdvanceTotal)}</div>
              ${managerBreakdownHtml}
            </td>
            <td style="border:1px solid #ddd6fe;padding:8px 10px;background:#f5f3ff;width:50%;">
              <div style="font-size:9px;font-weight:800;color:#6d28d9;text-transform:uppercase;">From Owner - ${formatCurrency(ownerAdvanceTotal)}</div>
              ${ownerBreakdownHtml}
            </td>
          </tr>
        </table>

        <div style="font-size:11px;font-weight:800;color:#0f172a;margin:10px 0;text-transform:uppercase;">
          Trip Story History (${tripStories.length})
        </div>
        ${storiesHtml}

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
          <tr>
            <td style="text-align:center;width:50%;padding-top:16px;">
              <div style="border-top:1px solid #0f172a;margin:0 24px 4px;"></div>
              <div style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;">Driver Signature (${esc(data.driver.name)})</div>
            </td>
            <td style="text-align:center;width:50%;padding-top:16px;">
              <div style="border-top:1px solid #0f172a;margin:0 24px 4px;"></div>
              <div style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;">Authorized Signatory (KSP Service)</div>
            </td>
          </tr>
        </table>

        <div style="text-align:center;margin-top:20px;font-size:9px;color:#94a3b8;">
          This is a computer-generated document from KSP Fleet Management System | Statement #${data.driver.id}-${Date.now()}
        </div>
</body>
</html>`;
};

export const printDriverStatementPdf = async (data: DriverStatementPdfData): Promise<void> => {
  try {
    const html = generateDriverStatementHtml(data);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing driver statement PDF', error);
    throw error;
  }
};

export const shareDriverStatementPdf = async (data: DriverStatementPdfData): Promise<void> => {
  try {
    const html = generateDriverStatementHtml(data);
    const { uri } = await printHtmlToFile(html);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share Driver Statement - ${data.driver.name}`,
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (error) {
    console.error('Error sharing driver statement PDF', error);
    throw error;
  }
};

export const downloadDriverStatementPdf = async (
  data: DriverStatementPdfData
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateDriverStatementHtml(data);
    const printed = await printHtmlToFile(html);
    const uri = printed.uri;
    const base64 = (printed as any).base64;
    const cleanName = data.driver.name.replace(/\s+/g, '_');
    const filename = `Driver_Statement_${cleanName}_${Date.now()}`;

    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { success: true, filename: `${filename}.pdf`, uri: createdFileUri, savedDirectly: true };
        }
      } catch (safErr) {
        console.warn('SAF download failed, falling back to Sharing:', safErr);
      }
    }

    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Download Driver Statement - ${data.driver.name}`,
      });
    }
    return { success: true, filename: `${filename}.pdf`, uri: targetUri, savedDirectly: false };
  } catch (error) {
    console.error('Error downloading driver statement PDF', error);
    throw error;
  }
};

// ─── Driver Balance Master PDF ──────────────────────────────────────────────

export interface DriverBalanceMasterPdfData {
  drivers: Array<{
    driver_name: string;
    driver_mobile?: string;
    driver_license?: string;
    lorry_number?: string;
    owner_name?: string;
    trip_id?: number;
    from_location?: string;
    to_location?: string;
    total_advance_given: number;
    total_expenses_reported: number;
    balance_in_hand: number;
    need_to_pay?: number;
    settlement_status?: string;
  }>;
  grandTotals: {
    total_advance_given: number;
    total_expenses_reported: number;
    balance_in_hand: number;
    total_need_to_pay?: number;
  };
  filterSummary?: string;
  generatedAt?: string;
}

export const generateDriverBalanceMasterHtml = (data: DriverBalanceMasterPdfData): string => {
  const formatCurrency = (val: number | string) => {
    const num = Math.max(0, parseFloat(String(val)) || 0);
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const rowsHtml = (data.drivers || [])
    .map((d, idx) => {
      const balInHand = Math.max(0, parseFloat(String(d.balance_in_hand ?? 0)));
      const needToPay = Math.max(0, parseFloat(String(d.need_to_pay ?? 0)));

      return `
        <tr>
          <td style="text-align: center; padding: 6px 4px; border: 1px solid #cbd5e1; font-size: 10px;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11px; color: #0f172a;">
            ${d.driver_name}
            ${d.driver_mobile ? `<div style="font-size: 9.5px; color: #64748b; font-weight: normal;">${d.driver_mobile}</div>` : ''}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; font-weight: 600; color: #334155;">
            ${d.lorry_number || '—'}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; color: #475569;">
            ${d.owner_name || '—'}
          </td>
          <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 11px; color: #15803d; background: #f0fdf4;">
            ${formatCurrency(balInHand)}
          </td>
          <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 11px; color: #dc2626; background: #fef2f2;">
            ${formatCurrency(needToPay)}
          </td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Transport - Driver Balance Master Report</title>
  <style>
    ${PRINT_BRAND_CSS}
    @page { size: landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .metrics-grid {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .metric-card {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #f8fafc;
    }
    .metric-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .metric-val {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 7px 8px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid #0f172a;
      text-align: left;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 10px;
    }
    .sig-col {
      width: 220px;
      text-align: center;
    }
    .sig-line {
      border-top: 1.5px solid #0f172a;
      margin-bottom: 6px;
    }
    .sig-text {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        ${printBrandLockup('Driver Balance Master Statement')}
        ${data.filterSummary ? `<div style="font-size: 10px; color: #64748b; margin-top: 3px;">Filter: ${data.filterSummary}</div>` : ''}
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Total Drivers: ${data.drivers.length}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Date: ${data.generatedAt || new Date().toLocaleString('en-IN')}</div>
      </td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 28%;">Driver Name</th>
        <th style="width: 16%;">Lorry No</th>
        <th style="width: 20%;">Owner</th>
        <th style="width: 18%; text-align: right;">Cash in Hand (₹)</th>
        <th style="width: 18%; text-align: right;">Need to Pay (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="background: #f1f5f9; font-weight: 800;">
        <td style="text-align: center; padding: 7px 4px; border: 1px solid #cbd5e1;">TOTAL</td>
        <td colspan="3" style="padding: 7px 8px; border: 1px solid #cbd5e1;">
          Summary for ${data.drivers.length} Drivers
        </td>
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; color: #15803d; background: #ecfdf5;">
          ${formatCurrency(data.grandTotals.balance_in_hand)}
        </td>
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; color: #dc2626; background: #fef2f2;">
          ${formatCurrency(data.grandTotals.total_need_to_pay || 0)}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-text">Accounts / Manager Signature</div>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-text">Authorized Signatory (KSP Service)</div>
    </div>
  </div>
</body>
</html>`;
};

export const printDriverBalanceMasterPdf = async (data: DriverBalanceMasterPdfData): Promise<void> => {
  try {
    const html = generateDriverBalanceMasterHtml(data);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing driver balance master PDF', error);
    throw error;
  }
};

export const shareDriverBalanceMasterPdf = async (data: DriverBalanceMasterPdfData): Promise<void> => {
  try {
    const html = generateDriverBalanceMasterHtml(data);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Share Driver Balance Master Report',
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (error) {
    console.error('Error sharing driver balance master PDF', error);
    throw error;
  }
};

export const downloadDriverBalanceMasterPdf = async (
  data: DriverBalanceMasterPdfData
): Promise<{ success: boolean; filename: string; uri: string; savedDirectly: boolean }> => {
  try {
    const html = generateDriverBalanceMasterHtml(data);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const filename = `KSP_Driver_Balance_Master_${Date.now()}`;

    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data =
            base64 ||
            (await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { success: true, filename: `${filename}.pdf`, uri: createdFileUri, savedDirectly: true };
        }
      } catch (safErr) {
        console.warn('SAF download failed, falling back to Sharing:', safErr);
      }
    }

    const targetUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Download Driver Balance Master Report',
      });
    }
    return { success: true, filename: `${filename}.pdf`, uri: targetUri, savedDirectly: false };
  } catch (error) {
    console.error('Error downloading driver balance master PDF', error);
    throw error;
  }
};



