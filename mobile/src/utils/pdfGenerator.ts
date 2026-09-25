import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Settlement, Trip } from '../types';

export const generateSettlementHtml = (trip: Trip, settlement: Settlement) => {
  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const tripDate = trip.trip_date
    ? new Date(trip.trip_date).toLocaleDateString('en-IN')
    : new Date().toLocaleDateString('en-IN');

  const goodsWeight = parseFloat(String(trip.goods_weight || 0));
  const freightRate = parseFloat(String(trip.freight_rate || 0));
  const totalFreight = parseFloat(String(settlement.total_freight || 0));
  const totalExpenses = parseFloat(String(settlement.total_expenses || 0));
  const advancePaid = parseFloat(String(settlement.advance_paid || 0));
  const balanceToDriver = parseFloat(String(settlement.balance_to_driver || 0));

  const items = settlement.expense_items || [];

  // Step-by-Step Expense Categorization
  const loadingItems = items.filter((e) => e.expense_type === 'LOADING');
  const loadingTotal = loadingItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const unloadingItems = items.filter((e) => e.expense_type === 'UNLOADING');
  const unloadingTotal = unloadingItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const bataItems = items.filter(
    (e) => e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
  );
  const bataTotal = bataItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const cleaningItems = items.filter(
    (e) => e.expense_type === 'CLEANING_CHARGE' || e.expense_type === 'CLEANING'
  );
  const cleaningTotal = cleaningItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const otherItems = items.filter(
    (e) =>
      !['LOADING', 'UNLOADING', 'DRIVER_BATA', 'DRIVER_BETA', 'CLEANING_CHARGE', 'CLEANING'].includes(
        e.expense_type
      )
  );
  const otherTotal = otherItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const stepList = [
    {
      step: 'Step 1',
      name: 'Loading Charge',
      total: loadingTotal,
      desc:
        loadingItems.length > 0 && loadingItems[0].description
          ? loadingItems.map((i) => i.description).join(', ')
          : 'Fixed from truck loading rate',
    },
    {
      step: 'Step 2',
      name: 'Unloading Charge',
      total: unloadingTotal,
      desc:
        unloadingItems.length > 0 && unloadingItems[0].description
          ? unloadingItems.map((i) => i.description).join(', ')
          : unloadingTotal > 0
          ? 'Krishi unit unloading rate'
          : 'Non-Krishi (Not applicable)',
    },
    {
      step: 'Step 3',
      name: 'Driver Bata',
      total: bataTotal,
      desc:
        bataItems.length > 0 && bataItems[0].description
          ? bataItems.map((i) => i.description).join(', ')
          : '15% of Total Freight Amount',
    },
    {
      step: 'Step 4',
      name: 'Cleaning Charge',
      total: cleaningTotal,
      desc:
        cleaningItems.length > 0 && cleaningItems[0].description
          ? cleaningItems.map((i) => i.description).join(', ')
          : 'Truck cleaning charge from master',
    },
    {
      step: 'Step 5',
      name: 'Other Expenses',
      total: otherTotal,
      desc:
        otherItems.length > 0 && otherItems[0].description
          ? otherItems.map((i) => i.description).join(', ')
          : 'Minor trip expenses (Max limit configured)',
    },
  ];

  const stepRows = stepList
    .map(
      (s) => `
      <tr>
        <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #1e3a8a; width: 60px;">${s.step}</td>
        <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 700; color: #0f172a;">${s.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${s.desc}</div>
        </td>
        <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: ${s.total === 0 ? '#94a3b8' : '#0f172a'}; font-size: 13.5px;">
          ${formatCurrency(s.total)}
        </td>
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
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
          .slip-container { border: 2px dashed #94a3b8; border-radius: 12px; padding: 24px; max-width: 620px; margin: 0 auto; box-sizing: border-box; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
          .logo { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: 1px; }
          .tagline { color: #d97706; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 2px; }
          .title { font-size: 15px; font-weight: 800; margin-top: 6px; letter-spacing: 0.5px; }
          .status { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 800; font-size: 11px; padding: 3px 12px; border-radius: 20px; border: 1px solid #a7f3d0; margin-top: 4px; }
          .grid { display: flex; flex-wrap: wrap; margin-bottom: 14px; background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
          .col { width: 50%; box-sizing: border-box; padding: 4px 0; font-size: 12.5px; color: #334155; }
          .freight-box { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .freight-label { font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
          .freight-formula { font-size: 12px; color: #3b82f6; font-weight: 600; margin-top: 2px; }
          .freight-amount { font-size: 20px; font-weight: 900; color: #1e3a8a; }
          .section-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12.5px; }
          .table th { background: #f1f5f9; padding: 7px 8px; text-align: left; border-bottom: 1.5px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; }
          .summary-box { background: #f8fafc; border-radius: 8px; padding: 14px 16px; margin-top: 16px; border: 1px solid #e2e8f0; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; color: #334155; }
          .row.highlight { font-weight: 900; font-size: 16px; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 8px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11.5px; }
        </style>
      </head>
      <body>
        <div class="slip-container">
          <div class="header">
            <div class="logo">KSP TRANSPORT</div>
            <div class="tagline">Logistics & Fleet Transport Services</div>
            <div class="title">TRIP SETTLEMENT SLIP</div>
            <div><span class="status">VERIFIED</span></div>
          </div>

          <div class="grid">
            <div class="col"><strong>Date:</strong> ${tripDate}</div>
            <div class="col"><strong>Party:</strong> ${trip.party_name || '—'}</div>
            <div class="col"><strong>Lorry Number:</strong> ${trip.lorry_number || '—'}</div>
            <div class="col"><strong>Driver:</strong> ${trip.driver_name || '—'}</div>
            <div class="col" style="width: 100%;"><strong>Route:</strong> ${trip.from_location} → ${trip.to_location}</div>
          </div>

          <!-- 1. TOTAL FREIGHT AMOUNT (Displayed above Driver Expenses) -->
          <div class="freight-box">
            <div>
              <div class="freight-label">TOTAL FREIGHT AMOUNT</div>
              ${
                goodsWeight > 0 && freightRate > 0
                  ? `<div class="freight-formula">${goodsWeight} Tons × ₹${freightRate}/Ton</div>`
                  : ''
              }
            </div>
            <div class="freight-amount">${formatCurrency(totalFreight)}</div>
          </div>

          <!-- 2. Step-by-Step Driver Expenses Breakdown -->
          <div class="section-title">DRIVER EXPENSES (STEP-BY-STEP BREAKDOWN)</div>
          <table class="table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Expense Category & Details</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${stepRows}
              <tr style="background: #f8fafc; font-weight: 800;">
                <td colspan="2" style="padding: 10px 8px; border-top: 1.5px solid #0f172a; font-size: 12px; text-transform: uppercase;">TOTAL DRIVER EXPENSES:</td>
                <td style="padding: 10px 8px; border-top: 1.5px solid #0f172a; text-align: right; font-size: 14px; color: #d97706;">${formatCurrency(totalExpenses)}</td>
              </tr>
            </tbody>
          </table>

          <!-- 3. Settlement Calculation Summary (No Total Freight down here; only expenses, advance, and net balance) -->
          <div class="summary-box">
            <div class="row">
              <span>Total Driver Expenses:</span>
              <strong style="color: #d97706;">${formatCurrency(totalExpenses)}</strong>
            </div>
            <div class="row">
              <span>Less: Advance Paid to Driver:</span>
              <strong>(-) ${formatCurrency(advancePaid)}</strong>
            </div>
            <div class="row highlight">
              <span>Net Balance to Driver:</span>
              <span style="color: ${balanceToDriver >= 0 ? '#15803d' : '#b91c1c'};">
                ${balanceToDriver >= 0 ? '+' : ''}${formatCurrency(balanceToDriver)}
                <span style="font-size: 11px; font-weight: 700; color: #64748b;">(${balanceToDriver >= 0 ? 'Payable' : 'Recoverable'})</span>
              </span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div style="height: 28px;"></div>
              <div>_________________________</div>
              <div style="margin-top: 2px;"><strong>Driver's Signature</strong></div>
            </div>
            <div style="text-align: right;">
              <div style="height: 28px;"></div>
              <div>_________________________</div>
              <div style="margin-top: 2px;"><strong>Authorized Signatory (KSP)</strong></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
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
