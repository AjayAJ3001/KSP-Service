import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Settlement, Trip } from '../types';

export const generateSettlementHtml = (trip: Trip, settlement: Settlement) => {
  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const tripDate = trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

  const expenseRows = (settlement.expense_items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.expense_type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.description || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KSP Transport Settlement Slip</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
          .slip-container { border: 2px dashed #94a3b8; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: 1px; }
          .tagline { color: #d97706; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
          .title { font-size: 16px; font-weight: 800; margin-top: 8px; }
          .status { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; border: 1px solid #a7f3d0; }
          .grid { display: flex; flex-wrap: wrap; margin-bottom: 16px; }
          .col { width: 50%; box-sizing: border-box; padding: 6px 0; font-size: 13px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          .table th { background: #f8fafc; padding: 8px; text-align: left; border-bottom: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; }
          .summary-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; }
          .row.highlight { font-weight: 800; font-size: 16px; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 6px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="slip-container">
          <div class="header">
            <div class="logo">KSP TRANSPORT</div>
            <div class="tagline">Logistics & Fleet Transport Services</div>
            <div class="title">TRIP SETTLEMENT SLIP</div>
            <div style="margin-top: 6px;"><span class="status">VERIFIED</span></div>
          </div>

          <div class="grid">
            <div class="col"><strong>Trip Date:</strong> ${tripDate}</div>
            <div class="col"><strong>Lorry Number:</strong> ${trip.lorry_number || ''}</div>
            <div class="col"><strong>Driver Name:</strong> ${trip.driver_name || ''}</div>
            <div class="col"><strong>Party Name:</strong> ${trip.party_name || ''}</div>
            <div class="col" style="width: 100%;"><strong>Route:</strong> ${trip.from_location} → ${trip.to_location}</div>
          </div>

          ${
            settlement.expense_items && settlement.expense_items.length > 0
              ? `
            <div style="margin-top: 12px; font-weight: 700; font-size: 13px;">Driver Expenses Line Items:</div>
            <table class="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows}
              </tbody>
            </table>
          `
              : ''
          }

          <div class="summary-box">
            <div class="row">
              <span>Total Freight Billed:</span>
              <strong>${formatCurrency(settlement.total_freight)}</strong>
            </div>
            <div class="row">
              <span>Total Driver Expenses:</span>
              <strong style="color: #d97706;">${formatCurrency(settlement.total_expenses)}</strong>
            </div>
            <div class="row">
              <span>Advance Paid to Driver:</span>
              <strong>${formatCurrency(settlement.advance_paid)}</strong>
            </div>
            <div class="row highlight">
              <span>Net Balance to Driver:</span>
              <span style="color: ${settlement.balance_to_driver >= 0 ? '#15803d' : '#b91c1c'};">
                ${formatCurrency(settlement.balance_to_driver)}
              </span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div style="height: 30px;"></div>
              <div>_________________________</div>
              <div><strong>Driver's Signature</strong></div>
            </div>
            <div style="text-align: right;">
              <div style="height: 30px;"></div>
              <div>_________________________</div>
              <div><strong>Authorized Signatory (KSP)</strong></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const printOrShareSettlementPdf = async (trip: Trip, settlement: Settlement) => {
  try {
    const html = generateSettlementHtml(trip, settlement);
    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (error) {
    console.error('Error printing/sharing PDF', error);
    throw error;
  }
};
