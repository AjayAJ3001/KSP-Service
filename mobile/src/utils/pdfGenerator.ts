import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Settlement, Trip } from '../types';

import { formatDateDMY } from './dateUtils';

export const generateSettlementHtml = (trip: Trip, settlement: Settlement) => {
  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isSettled = settlement.settlement_status === 'SETTLED';
  const tripDate = formatDateDMY(trip.trip_date || settlement.trip_date || new Date());
  const payDate = settlement.payment_date ? formatDateDMY(settlement.payment_date) : '';
  const netPayable = parseFloat(String(settlement.balance_to_driver || 0));
  const isPositive = netPayable >= 0;

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
          <div class="company-title">KSP TRANSPORT</div>
          <div class="company-sub">Fleet Logistics &amp; Transport Contractors</div>
          <div class="company-meta">
            Head Office: Namakkal • Tamil Nadu<br />
            Fleet Operations &amp; Freight Settlement Dept.<br />
            Phone: +91 94432 00000 | Email: accounts@ksptransport.com
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
              <span class="status-badge ${isSettled ? 'status-settled' : 'status-pending'}">
                ${isSettled ? '✔ SETTLED' : '⏳ PENDING'}
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
        <td class="info-label">Trip Dispatch Date</td>
        <td class="info-val">${tripDate}</td>
        <td class="info-label">Settlement Mode</td>
        <td class="info-val">${settlement.payment_mode || (isSettled ? 'CASH' : 'PENDING')}</td>
      </tr>
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
      <div class="calc-row">
        <span>Total Gross Freight Billed:</span>
        <strong>${formatCurrency(settlement.total_freight)}</strong>
      </div>
      <div class="calc-row">
        <span>Less: Total Driver Expenses Incurred:</span>
        <strong style="color: #b45309;">(-) ${formatCurrency(settlement.total_expenses)}</strong>
      </div>
      <div class="calc-row">
        <span>Less: Trip Advance Already Paid to Driver:</span>
        <strong style="color: #475569;">(-) ${formatCurrency(settlement.advance_paid)}</strong>
      </div>
      <div class="calc-row highlight">
        <span>NET BALANCE PAYABLE TO DRIVER:</span>
        <span>${isPositive ? '+' : ''}${formatCurrency(settlement.balance_to_driver)}</span>
      </div>
    </div>

    ${isSettled && settlement.payment_mode ? `
      <div class="discharge-box">
        <div class="discharge-title">✔ OFFICIAL DISBURSEMENT RECEIPT</div>
        <div style="line-height: 1.6;">
          Paid Amount: <strong>${formatCurrency(settlement.paid_amount || settlement.balance_to_driver)}</strong> via <strong>${settlement.payment_mode}</strong>
          ${settlement.payment_date ? ` · Paid on <strong>${formatDateDMY(settlement.payment_date)}</strong>` : ''}
          ${settlement.reference_no ? ` · Ref/UTR: <strong>${settlement.reference_no}</strong>` : ''}
          ${settlement.settled_by_name ? ` · Authorized &amp; Disbursed by: <strong>${settlement.settled_by_name}</strong>` : ''}
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
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          <div class="company-title">KSP TRANSPORT</div>
          <div class="company-sub">Fleet Logistics &amp; Freight Management</div>
          <div class="company-meta">
            Tamil Nadu &bull; Head Office &bull; Ph: +91 94432 00000<br />
            GSTIN: 33AAAAA0000A1Z5 &bull; Fleet Operations System
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

