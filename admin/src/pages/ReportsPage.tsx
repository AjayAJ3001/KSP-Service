import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer, Download, RefreshCw, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { reportService, partyService, driverService, vehicleService, ownerService, unitService } from '../services/adminService';
import { Party, Driver, Vehicle, Owner, Unit } from '../types';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';
import { useAuth } from '../context/AuthContext';
import { PRINT_BRAND_CSS, printBrandLockup } from '../utils/printBrand';

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtCur(val: number | string) {
  return (parseFloat(String(val)) || 0).toFixed(2);
}

function formatCurrency(val: number | string) {
  const num = parseFloat(String(val)) || 0;
  return `${String.fromCharCode(8377)}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseJsonList(val: any): any[] {
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
}

function printInr(val: any) {
  return (parseFloat(String(val)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function driverExpenseBalance(t: any) {
  const total = parseFloat(String(t.total_expenses || 0)) || 0;
  const toPay = Math.max(0, parseFloat(String(t.need_to_pay || 0)) || 0);
  const settled = Math.max(0, total - toPay);
  const inHand = Math.max(0, parseFloat(String(t.in_hand || 0)) || 0);
  return { total, toPay, settled, inHand };
}

function driverExpenseStatus(t: any) {
  const amt = parseFloat(String(t.total_expenses || 0)) || 0;
  if (amt <= 0) return 'NO_EXPENSE';
  const settle = String(t.settlement_status || '').toUpperCase();
  if (settle === 'SETTLED') return 'SETTLED';
  if (settle === 'VERIFIED') return 'VERIFIED';
  const need = parseFloat(String(t.need_to_pay || 0)) || 0;
  const paid = parseFloat(String(t.driver_cash_paid || 0)) || 0;
  if (paid > 0 && need > 0) return 'PARTIALLY_PAID';
  return 'PENDING';
}

function expenseStatusBadgeHtml(status: string) {
  let cls = 'badge-pending';
  if (status === 'SETTLED') cls = 'badge-paid';
  else if (status === 'VERIFIED' || status === 'PARTIALLY_PAID') cls = 'badge-partial';
  else if (status === 'NO_EXPENSE') cls = 'badge-settled';
  return `<span class="badge ${cls}">${String(status || '').replace(/_/g, ' ')}</span>`;
}

function driverExpensePrintRows(trips: any[]) {
  const rows: string[] = [];
  let sno = 0;
  let total = 0;
  let totalSettled = 0;
  let totalToPay = 0;
  trips.forEach((t) => {
    const items = parseJsonList(t.expense_items);
    const bal = driverExpenseBalance(t);
    const tripTotal = bal.total;
    total += tripTotal;
    totalSettled += bal.settled;
    totalToPay += bal.toPay;
    const expStatus = driverExpenseStatus(t);
    const statusCell = expenseStatusBadgeHtml(expStatus);
    const settledCell = `<td class="num" style="color:#15803d">${printInr(bal.settled)}</td>`;
    const toPayCell = `<td class="num" style="color:${bal.toPay > 0 ? '#b91c1c' : '#15803d'}"><strong>${printInr(bal.toPay)}</strong></td>`;
    if (items.length === 0) {
      if (tripTotal <= 0) return;
      sno += 1;
      rows.push(`
        <tr>
          <td class="center">${sno}</td>
          <td>${formatDateDMY(t.trip_date)}</td>
          <td><strong>${t.lorry_number || '-'}</strong></td>
          <td>${t.driver_name || '-'}</td>
          <td>TOTAL</td>
          <td>—</td>
          <td class="num" style="color:#7c3aed"><strong>${printInr(tripTotal)}</strong></td>
          ${settledCell}
          ${toPayCell}
          <td class="center">${statusCell}</td>
        </tr>`);
      return;
    }
    items.forEach((item: any, idx: number) => {
      sno += 1;
      const amt = parseFloat(String(item.amount || 0)) || 0;
      rows.push(`
        <tr>
          <td class="center">${sno}</td>
          <td>${idx === 0 ? formatDateDMY(t.trip_date) : ''}</td>
          <td>${idx === 0 ? `<strong>${t.lorry_number || '-'}</strong>` : ''}</td>
          <td>${idx === 0 ? (t.driver_name || '-') : ''}</td>
          <td>${item.expense_type || 'OTHER'}</td>
          <td>${item.description || '—'}</td>
          <td class="num" style="color:#7c3aed">${printInr(amt)}</td>
          ${idx === 0 ? settledCell : '<td></td>'}
          ${idx === 0 ? toPayCell : '<td></td>'}
          <td class="center">${idx === 0 ? statusCell : ''}</td>
        </tr>`);
    });
    if (items.length > 1) {
      rows.push(`
        <tr>
          <td></td>
          <td colspan="5" style="text-align:right;font-weight:700;color:#475569">Trip ${t.id} expense total</td>
          <td class="num" style="color:#6d28d9"><strong>${printInr(tripTotal)}</strong></td>
          <td class="num" style="color:#15803d"><strong>${printInr(bal.settled)}</strong></td>
          <td class="num" style="color:${bal.toPay > 0 ? '#b91c1c' : '#15803d'}"><strong>${printInr(bal.toPay)}</strong></td>
          <td></td>
        </tr>`);
    }
  });
  return { rowsHtml: rows.join(''), count: sno, total, totalSettled, totalToPay };
}

function partyPaymentPrintRows(trips: any[]) {
  const rows: string[] = [];
  let sno = 0;
  let totalReceived = 0;
  let totalDue = 0;
  trips.forEach((t) => {
    const items = parseJsonList(t.payment_items);
    const received = parseFloat(String(t.total_received || 0)) || 0;
    const due = parseFloat(String(t.balance_due || 0)) || 0;
    totalReceived += received;
    totalDue += due;
    if (items.length === 0) {
      sno += 1;
      rows.push(`
        <tr>
          <td class="center">${sno}</td>
          <td>${formatDateDMY(t.trip_date)}</td>
          <td><strong>${t.lorry_number || '-'}</strong></td>
          <td>${t.party_name || '-'}</td>
          <td>—</td>
          <td class="num">${printInr(t.total_freight)}</td>
          <td class="num" style="color:#15803d">${printInr(received)}</td>
          <td class="num" style="color:${due > 0 ? '#b91c1c' : '#15803d'}"><strong>${printInr(due)}</strong></td>
          <td>—</td>
        </tr>`);
      return;
    }
    items.forEach((item: any, idx: number) => {
      sno += 1;
      const amt = parseFloat(String(item.received_amount || 0)) || 0;
      const itemDue = parseFloat(String(item.balance_due != null ? item.balance_due : due)) || 0;
      rows.push(`
        <tr>
          <td class="center">${sno}</td>
          <td>${idx === 0 ? formatDateDMY(t.trip_date) : ''}</td>
          <td>${idx === 0 ? `<strong>${t.lorry_number || '-'}</strong>` : ''}</td>
          <td>${idx === 0 ? (t.party_name || '-') : ''}</td>
          <td>${item.payment_date ? formatDateDMY(item.payment_date) : '—'}</td>
          <td class="num">${idx === 0 ? printInr(t.total_freight) : ''}</td>
          <td class="num" style="color:#15803d">${printInr(amt)}</td>
          <td class="num" style="color:${itemDue > 0 ? '#b91c1c' : '#15803d'}">${printInr(itemDue)}</td>
          <td>${item.notes || item.payment_status || '—'}</td>
        </tr>`);
    });
    if (items.length > 1) {
      rows.push(`
        <tr>
          <td></td>
          <td colspan="5" style="text-align:right;font-weight:700;color:#475569">Trip ${t.id} party total</td>
          <td class="num" style="color:#15803d"><strong>${printInr(received)}</strong></td>
          <td class="num" style="color:${due > 0 ? '#b91c1c' : '#15803d'}"><strong>${printInr(due)}</strong></td>
          <td></td>
        </tr>`);
    }
  });
  return { rowsHtml: rows.join(''), count: sno, totalReceived, totalDue };
}

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const isOwnerUser = user?.role === 'OWNER';
  const ownerScopeIds = (user?.ownerIds?.length ? user.ownerIds : (user?.owners || []).map((o) => o.id)).map(Number);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState('');

  const [parties, setParties] = useState<Party[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (isOwnerUser && ownerScopeIds.length === 1 && !ownerId) {
      setOwnerId(String(ownerScopeIds[0]));
    }
  }, [isOwnerUser, ownerScopeIds, ownerId]);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: partyId || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        owner_id: ownerId || undefined,
        unit_id: unitId || undefined,
        status: status || undefined,
      };

      const res = await reportService.getTripReport(params);
      setTripData(res.data);
    } catch (err) {
      console.error('Failed to load trip report', err);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, partyId, driverId, vehicleId, ownerId, unitId, status]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadLookups = async () => {
    try {
      const [p, d, v, o, u] = await Promise.all([
        partyService.getParties({ limit: 200 }),
        driverService.getDrivers({ limit: 200 }),
        vehicleService.getVehicles({ limit: 500 }),
        ownerService.getOwners({ limit: 500 }),
        unitService.getUnits('ACTIVE').catch(() => unitService.getUnits()),
      ]);
      setParties(p.data.items || (Array.isArray(p.data) ? p.data : []));
      setDrivers(d.data.items || (Array.isArray(d.data) ? d.data : []));
      const allVehicles = v.data.items || (Array.isArray(v.data) ? v.data : []);
      const allOwners = o.data.items || (Array.isArray(o.data) ? o.data : []);
      if (isOwnerUser && ownerScopeIds.length) {
        setOwners(allOwners.filter((ow: Owner) => ownerScopeIds.includes(Number(ow.id))));
        setVehicles(allVehicles.filter((veh: Vehicle) => ownerScopeIds.includes(Number(veh.owner_id))));
      } else if (isOwnerUser && (user?.vehicleIds || []).length) {
        setOwners(allOwners);
        setVehicles(allVehicles.filter((veh: Vehicle) => (user?.vehicleIds || []).includes(Number(veh.id))));
      } else {
        setVehicles(allVehicles);
        setOwners(allOwners);
      }
      setUnits(Array.isArray(u.data) ? u.data : (u.data as any)?.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const resetFilters = () => {
    const hadFilter = Boolean(fromDate || toDate || partyId || driverId || vehicleId || ownerId || unitId || status);
    setFromDate('');
    setToDate('');
    setPartyId('');
    setDriverId('');
    setVehicleId('');
    setOwnerId(isOwnerUser && ownerScopeIds.length === 1 ? String(ownerScopeIds[0]) : '');
    setUnitId('');
    setStatus('');
    if (!hadFilter) {
      loadReport();
    }
  };

  // CSV formatters
  const tripHeaders = [
    'Trip ID', 'Trip Date', 'Lorry Number', 'Truck Owner', 'Party Name', 'Driver Name',
    'Route', 'Unit', 'Weight', 'Total Freight (INR)',
    'Driver Advance (INR)', 'Driver Expenses (INR)', 'Expense Settled (INR)', 'Expense To Pay (INR)', 'Driver Expense Status',
    'Need to Pay Driver (INR)', 'Balance in Hand (INR)', 'Driver Cash Paid (INR)',
    'Party Received (INR)', 'Party Balance Due (INR)', 'Status'
  ];
  const tripRow = (t: any) => [
    String(t.id),
    formatDateDMY(t.trip_date),
    t.lorry_number,
    t.owner_name || '-',
    t.party_name,
    t.driver_name || '',
    `${t.from_location} -> ${t.to_location}`,
    t.unit_name || '',
    String(t.goods_weight || 0),
    fmtCur(t.total_freight),
    fmtCur(t.manager_advance ?? t.advance_paid),
    fmtCur(t.total_expenses),
    fmtCur(driverExpenseBalance(t).settled),
    fmtCur(driverExpenseBalance(t).toPay),
    driverExpenseStatus(t).replace(/_/g, ' '),
    fmtCur(t.need_to_pay),
    fmtCur(t.in_hand),
    fmtCur(t.driver_cash_paid),
    fmtCur(t.total_received),
    fmtCur(t.balance_due),
    t.status
  ];

  const totalTripsCount = tripData.trips.length;
  const totalGoodsWeight = tripData.trips.reduce((sum, t) => sum + (Number(t.goods_weight) || 0), 0);
  const totalFreightAmount = tripData.trips.reduce((sum, t) => sum + (Number(t.total_freight) || 0), 0);
  const totalAdvancePaid = tripData.trips.reduce((sum, t) => sum + (Number(t.advance_paid) || 0), 0);
  const totalReceivedAmount = tripData.trips.reduce((sum, t) => sum + (Number(t.total_received) || 0), 0);
  const totalBalanceDueAmount = tripData.trips.reduce((sum, t) => sum + (Number(t.balance_due) || 0), 0);
  const totalDriverExpenses = tripData.trips.reduce((sum, t) => sum + (Number(t.total_expenses) || 0), 0);
  const totalDriverAdvance = tripData.trips.reduce((sum, t) => sum + (Number(t.manager_advance ?? t.advance_paid) || 0), 0);
  const totalNeedToPay = tripData.trips.reduce((sum, t) => sum + (Number(t.need_to_pay) || 0), 0);
  const totalInHand = tripData.trips.reduce((sum, t) => sum + (Number(t.in_hand) || 0), 0);

  const handleExportExcel = () => {
    if (tripData.trips.length === 0) {
      alert('No trip records to export.');
      return;
    }

    try {
      setIsExportingExcel(true);
      const excelRows: any[] = tripData.trips.map((t, idx) => ({
        'S.No': idx + 1,
        'Trip ID': `TRIP-${t.id}`,
        'Trip Date': formatDateDMY(t.trip_date),
        'Lorry Number': t.lorry_number || '-',
        'Truck Owner': t.owner_name || '-',
        'Party Name': t.party_name || '-',
        'Route / Destination': `${t.from_location || ''} -> ${t.to_location || ''}`,
        'Driver Name': t.driver_name || '-',
        'Goods Weight': Number(t.goods_weight || 0),
        'Unit': t.unit_name || 'Tons',
        'Freight Rate (Rs)': Number(t.freight_rate || 0),
        'Total Freight (Rs)': Number(t.total_freight || 0),
        'Driver Advance (Rs)': Number(t.manager_advance ?? t.advance_paid) || 0,
        'Driver Expenses (Rs)': Number(t.total_expenses || 0),
        'Expense Settled (Rs)': driverExpenseBalance(t).settled,
        'Expense To Pay (Rs)': driverExpenseBalance(t).toPay,
        'Driver Expense Status': driverExpenseStatus(t).replace(/_/g, ' '),
        'Need to Pay Driver (Rs)': Number(t.need_to_pay || 0),
        'Balance in Hand (Rs)': Number(t.in_hand || 0),
        'Driver Cash Paid (Rs)': Number(t.driver_cash_paid || 0),
        'Party Received (Rs)': Number(t.total_received || 0),
        'Party Balance Due (Rs)': Number(t.balance_due || 0),
        'Status': t.status,
      }));

      // Add a blank separator row
      excelRows.push({});

      excelRows.push({
        'S.No': '',
        'Trip ID': 'TOTAL SUMMARY',
        'Trip Date': `Total Trips: ${totalTripsCount}`,
        'Lorry Number': `Count: ${totalTripsCount}`,
        'Party Name': '',
        'Route / Destination': '',
        'Driver Name': '',
        'Goods Weight': Number(totalGoodsWeight.toFixed(3)),
        'Unit': 'Total MT',
        'Freight Rate (Rs)': '',
        'Total Freight (Rs)': Number(totalFreightAmount.toFixed(2)),
        'Driver Advance (Rs)': Number(totalDriverAdvance.toFixed(2)),
        'Driver Expenses (Rs)': Number(totalDriverExpenses.toFixed(2)),
        'Need to Pay Driver (Rs)': Number(totalNeedToPay.toFixed(2)),
        'Balance in Hand (Rs)': Number(totalInHand.toFixed(2)),
        'Party Received (Rs)': Number(totalReceivedAmount.toFixed(2)),
        'Party Balance Due (Rs)': Number(totalBalanceDueAmount.toFixed(2)),
        'Status': `Total: ${totalTripsCount} Trips`,
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 14 }, // Trip ID
        { wch: 22 }, // Trip Date / Count
        { wch: 16 }, // Lorry Number
        { wch: 26 }, // Party Name
        { wch: 26 }, // Route / Destination
        { wch: 20 }, // Driver Name
        { wch: 16 }, // Goods Weight
        { wch: 12 }, // Unit
        { wch: 18 }, // Freight Rate
        { wch: 20 }, // Total Freight
        { wch: 18 }, // Advance Paid
        { wch: 18 }, // Received
        { wch: 18 }, // Balance Due
        { wch: 20 }, // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dispatch Report');

      // Create Executive Summary Sheet
      const selectedParty = partyId ? parties.find((p) => String(p.id) === String(partyId))?.name : 'All';
      const selectedTruck = vehicleId ? vehicles.find((v) => String(v.id) === String(vehicleId))?.lorry_number : 'All';
      const selectedDriver = driverId ? drivers.find((d) => String(d.id) === String(driverId))?.name : 'All';
      const selectedUnit = unitId ? units.find((u) => String(u.id) === String(unitId))?.name : 'All';

      const summaryRows = [
        { 'Summary Field': 'TOTAL TRIPS COUNT', 'Value': `${totalTripsCount} Trips` },
        { 'Summary Field': 'Total Goods Weight', 'Value': `${totalGoodsWeight.toFixed(3)} MT/Tons` },
        { 'Summary Field': 'Total Freight Amount', 'Value': `₹${totalFreightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Total Advance Paid to Drivers', 'Value': `₹${totalDriverAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Total Driver Expenses', 'Value': `₹${totalDriverExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Need to Pay Drivers', 'Value': `₹${totalNeedToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Advance Balance in Hand', 'Value': `₹${totalInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Total Amount Received from Parties', 'Value': `₹${totalReceivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Total Balance Due from Parties', 'Value': `₹${totalBalanceDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { 'Summary Field': 'Party Filter', 'Value': selectedParty || 'All' },
        { 'Summary Field': 'Lorry Filter', 'Value': selectedTruck || 'All' },
        { 'Summary Field': 'Driver Filter', 'Value': selectedDriver || 'All' },
        { 'Summary Field': 'Unit Filter', 'Value': selectedUnit || 'All' },
        { 'Summary Field': 'Status Filter', 'Value': status || 'All' },
        { 'Summary Field': 'Date Range', 'Value': (fromDate || toDate) ? `${fromDate || 'Start'} to ${toDate || 'End'}` : 'All Dates' },
        { 'Summary Field': 'Export Timestamp', 'Value': new Date().toLocaleString('en-IN') },
      ];
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
      summaryWorksheet['!cols'] = [{ wch: 35 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `KSP_Dispatch_Report_${dateTag}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export report to Excel', err);
      alert(err.message || 'Failed to export report to Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrintReport = () => {
    if (tripData.trips.length === 0) {
      alert('No trip records matching current filters to download/print.');
      return;
    }

    try {
      setIsPrinting(true);
      const expensePrint = driverExpensePrintRows(tripData.trips);
      const paymentPrint = partyPaymentPrintRows(tripData.trips);

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Logistics - Trip Dispatch Report</title>
  <style>
    ${PRINT_BRAND_CSS}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 11.5px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 3px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .kpi-highlight .kpi-value { color: #1d4ed8; }
    .section-title { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin: 18px 0 8px; padding: 6px 10px; background: #f1f5f9; border-left: 4px solid #2563eb; }
    .section-title.exp { border-left-color: #7c3aed; }
    .section-title.pay { border-left-color: #15803d; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 7px 8px; font-size: 10.5px; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .footer-row td { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-align: center; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-pending { background: #fef9c3; color: #854d0e; }
    .badge-partial { background: #e0e7ff; color: #3730a3; }
    .badge-settled { background: #f1f5f9; color: #475569; }
    .badge-cancel { background: #fee2e2; color: #991b1b; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Report / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      ${printBrandLockup()}
      <div class="report-subtitle">FREIGHT DISPATCH AUDIT — TRIPS, DRIVER EXPENSES &amp; PARTY PAYMENTS</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; font-size: 13px; color: #0f172a;">Total Trips: ${totalTripsCount}</div>
      <p class="meta-text" style="margin-top: 4px;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
  <div class="section-title">1. Trip Dispatch</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">S.No</th>
        <th style="width: 70px;">Date</th>
        <th style="width: 85px;">Lorry No</th>
        <th style="width: 95px;">Truck Owner</th>
        <th>Party Name</th>
        <th>Route / Destination</th>
        <th>Driver</th>
        <th class="num" style="width: 70px;">Weight</th>
        <th class="num" style="width: 90px;">Freight (₹)</th>
        <th class="center" style="width: 80px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tripData.trips.map((t, idx) => {
        let badgeClass = 'badge-settled';
        if (t.status === 'SETTLED') badgeClass = 'badge-settled';
        else if (t.status === 'PAYMENT_PENDING') badgeClass = 'badge-pending';
        else if (t.status === 'PARTIALLY_PAID') badgeClass = 'badge-partial';
        else if (t.status === 'CANCELLED') badgeClass = 'badge-cancel';

        return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${formatDateDMY(t.trip_date)}</td>
          <td><strong>${t.lorry_number}</strong></td>
          <td>${t.owner_name || '-'}</td>
          <td>${t.party_name}</td>
          <td>${t.from_location} &rarr; ${t.to_location}</td>
          <td>${t.driver_name || '-'}</td>
          <td class="num">${Number(t.goods_weight || 0).toFixed(2)} ${t.unit_name || 'Tons'}</td>
          <td class="num"><strong>${Number(t.total_freight || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td class="center"><span class="badge ${badgeClass}">${t.status}</span></td>
        </tr>
        `;
      }).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL</td>
        <td colspan="5"><strong>Total Count: ${totalTripsCount} Trips</strong></td>
        <td class="num"><strong>${totalGoodsWeight.toFixed(2)} MT</strong></td>
        <td class="num"><strong>₹${totalFreightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="center"><strong>${totalTripsCount} Trips</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title exp">2. Driver Expenses</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:35px;">S.No</th>
        <th style="width:80px;">Trip Date</th>
        <th style="width:90px;">Lorry</th>
        <th>Driver</th>
        <th>Expense Type</th>
        <th>Description</th>
        <th class="num" style="width:90px;">Amount (₹)</th>
        <th class="num" style="width:90px;">Settled (₹)</th>
        <th class="num" style="width:90px;">To Pay (₹)</th>
        <th class="center" style="width:90px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${expensePrint.rowsHtml || `<tr><td colspan="10" class="center" style="color:#94a3b8;padding:14px;">No driver expenses for these trips.</td></tr>`}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL</td>
        <td colspan="4"><strong>Driver expenses: ${expensePrint.count} line(s)</strong></td>
        <td class="num"><strong>₹${printInr(expensePrint.total)}</strong></td>
        <td class="num"><strong>₹${printInr(expensePrint.totalSettled)}</strong></td>
        <td class="num"><strong>₹${printInr(expensePrint.totalToPay)}</strong></td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title pay">3. Party Payments</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:35px;">S.No</th>
        <th style="width:80px;">Trip Date</th>
        <th style="width:90px;">Lorry</th>
        <th>Party Name</th>
        <th style="width:90px;">Paid Date</th>
        <th class="num" style="width:95px;">Freight (₹)</th>
        <th class="num" style="width:95px;">Received (₹)</th>
        <th class="num" style="width:95px;">Balance (₹)</th>
        <th>Notes / Status</th>
      </tr>
    </thead>
    <tbody>
      ${paymentPrint.rowsHtml || `<tr><td colspan="9" class="center" style="color:#94a3b8;padding:14px;">No party payments for these trips.</td></tr>`}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL</td>
        <td colspan="4"><strong>Party payment lines: ${paymentPrint.count}</strong></td>
        <td class="num"><strong>₹${printInr(paymentPrint.totalReceived)}</strong></td>
        <td class="num"><strong>₹${printInr(paymentPrint.totalDue)}</strong></td>
        <td></td>
      </tr>
    </tbody>
  </table>
  
  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP</span>
    <span>Trip Dispatch Report Audit Record</span>
  </div>
</body>
</html>
      `;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        alert('Please allow pop-ups for this website to print.');
        setIsPrinting(false);
        return;
      }
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
    } catch (err: any) {
      console.error('Failed to print report', err);
      alert(err.message || 'Failed to print report.');
    } finally {
      setIsPrinting(false);
    }
  };

  const downloadFullReport = () => {
    const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'All';
    downloadCSV(`Trips_Dispatch_Report_${dateTag}.csv`, tripHeaders, tripData.trips.map(tripRow));
  };

  const downloadSingleTripCSV = (t: any) => {
    const filename = `Trip_${t.id}_${t.lorry_number}_${formatDateDMY(t.trip_date)}.csv`;
    downloadCSV(filename, tripHeaders, [tripRow(t)]);
  };

  const handlePrintSingleTrip = (trip: any) => {
    const expensePrint = driverExpensePrintRows([trip]);
    const paymentPrint = partyPaymentPrintRows([trip]);
    const singleTripHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Trip Voucher #${trip.id} - ${trip.lorry_number}</title>
  <style>
    ${PRINT_BRAND_CSS}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #fff; font-size: 13px; }
    @page { size: portrait; margin: 12mm; }
    .card { border: 2px solid #0f172a; border-radius: 8px; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .sub { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .row-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 6px 0; }
    .label { color: #64748b; font-weight: 600; }
    .val { font-weight: 700; color: #0f172a; }
    .totals-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
    .grand { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px solid #94a3b8; padding-top: 8px; margin-top: 4px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin: 16px 0 8px; padding: 6px 10px; background: #f1f5f9; border-left: 4px solid #2563eb; }
    .section-title.exp { border-left-color: #7c3aed; }
    .section-title.pay { border-left-color: #15803d; }
    table.detail { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    table.detail th { background: #0f172a; color: #fff; text-align: left; padding: 6px 8px; }
    table.detail td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    table.detail .num { text-align: right; }
    table.detail .footer-row td { background: #f1f5f9; font-weight: 800; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
    .sig-line { border-top: 1px solid #0f172a; width: 180px; text-align: center; font-size: 11px; padding-top: 6px; color: #475569; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    @media print { .print-btn-bar { display: none !important; } }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="btn" onclick="window.print()">Print Voucher</button>
    <button class="btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>
  <div class="card">
    <div class="header">
      ${printBrandLockup()}
      <div class="sub">OFFICIAL FREIGHT DISPATCH VOUCHER / CHALLAN</div>
      <div style="margin-top: 6px; font-size: 12px; font-weight: 700; color: #2563eb;">Trip Reference #TRIP-${trip.id}</div>
    </div>
    <div class="grid">
      <div class="row-item"><span class="label">Trip Date:</span><span class="val">${formatDateDMY(trip.trip_date)}</span></div>
      <div class="row-item"><span class="label">Lorry Number:</span><span class="val">${trip.lorry_number}</span></div>
      <div class="row-item"><span class="label">Party Name:</span><span class="val">${trip.party_name}</span></div>
      <div class="row-item"><span class="label">Driver Name:</span><span class="val">${trip.driver_name || '-'}</span></div>
      <div class="row-item"><span class="label">Route / Destination:</span><span class="val">${trip.from_location || ''} &rarr; ${trip.to_location || ''}</span></div>
      <div class="row-item"><span class="label">Status:</span><span class="val">${trip.status}</span></div>
      <div class="row-item"><span class="label">Goods Weight:</span><span class="val">${trip.goods_weight || 0} ${trip.unit_name || 'Tons'}</span></div>
      <div class="row-item"><span class="label">Freight Rate:</span><span class="val">₹${parseFloat(String(trip.freight_rate || 0)).toLocaleString('en-IN')}/${trip.unit_name || 'T'}</span></div>
    </div>

    <div class="totals-box">
      <div class="totals-row"><span>Total Freight Billed:</span><strong>₹${parseFloat(String(trip.total_freight || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
      <div class="totals-row"><span>Driver Advance:</span><strong>₹${(parseFloat(String(trip.manager_advance ?? trip.advance_paid)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
      <div class="totals-row"><span>Need to Pay Driver:</span><strong style="color:#b91c1c">₹${parseFloat(String(trip.need_to_pay || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
      <div class="totals-row"><span>Balance in Hand:</span><strong style="color:#15803d">₹${parseFloat(String(trip.in_hand || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
    </div>

    <div class="section-title exp">Driver Expenses</div>
    <table class="detail">
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>Description</th>
          <th class="num">Amount (₹)</th>
          <th class="num">Settled (₹)</th>
          <th class="num">To Pay (₹)</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          const items = parseJsonList(trip.expense_items);
          const statusHtml = expenseStatusBadgeHtml(driverExpenseStatus(trip));
          const bal = driverExpenseBalance(trip);
          if (items.length === 0) {
            const amt = parseFloat(String(trip.total_expenses || 0)) || 0;
            if (amt <= 0) return `<tr><td colspan="7" style="text-align:center;color:#94a3b8">No driver expenses.</td></tr>`;
            return `<tr><td>1</td><td>TOTAL</td><td>—</td><td class="num" style="color:#7c3aed">₹${printInr(amt)}</td><td class="num" style="color:#15803d">₹${printInr(bal.settled)}</td><td class="num" style="color:${bal.toPay > 0 ? '#b91c1c' : '#15803d'}">₹${printInr(bal.toPay)}</td><td class="center">${statusHtml}</td></tr>`;
          }
          return items.map((item: any, idx: number) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.expense_type || 'OTHER'}</td>
              <td>${item.description || '—'}</td>
              <td class="num" style="color:#7c3aed">₹${printInr(item.amount)}</td>
              <td class="num">${idx === 0 ? `₹${printInr(bal.settled)}` : ''}</td>
              <td class="num">${idx === 0 ? `₹${printInr(bal.toPay)}` : ''}</td>
              <td class="center">${idx === 0 ? statusHtml : ''}</td>
            </tr>`).join('');
        })()}
        <tr class="footer-row">
          <td colspan="3">Total Driver Expenses / Settled / To Pay</td>
          <td class="num">₹${printInr(expensePrint.total)}</td>
          <td class="num">₹${printInr(expensePrint.totalSettled)}</td>
          <td class="num">₹${printInr(expensePrint.totalToPay)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="section-title pay">Party Payments</div>
    <table class="detail">
      <thead>
        <tr>
          <th>#</th>
          <th>Paid Date</th>
          <th>Notes / Status</th>
          <th class="num">Received (₹)</th>
          <th class="num">Balance (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          const items = parseJsonList(trip.payment_items);
          if (items.length === 0) {
            return `<tr>
              <td class="center">1</td>
              <td>—</td>
              <td>Trip total</td>
              <td class="num" style="color:#15803d">₹${printInr(trip.total_received)}</td>
              <td class="num" style="color:${Number(trip.balance_due) > 0 ? '#b91c1c' : '#15803d'}">₹${printInr(trip.balance_due)}</td>
            </tr>`;
          }
          return items.map((item: any, idx: number) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.payment_date ? formatDateDMY(item.payment_date) : '—'}</td>
              <td>${item.notes || item.payment_status || '—'}</td>
              <td class="num" style="color:#15803d">₹${printInr(item.received_amount)}</td>
              <td class="num">₹${printInr(item.balance_due)}</td>
            </tr>`).join('');
        })()}
        <tr class="footer-row">
          <td colspan="3">Total Party Received / Balance Due</td>
          <td class="num">₹${printInr(paymentPrint.totalReceived)}</td>
          <td class="num">₹${printInr(paymentPrint.totalDue)}</td>
        </tr>
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig-line">Driver's Signature</div>
      <div class="sig-line">Prepared By (Manager)</div>
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(singleTripHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
  };

  return (
    <div>
      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Trip Dispatch Report</h2>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#1d4ed8',
                background: '#eff6ff',
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
              }}
            >
              Total: {totalTripsCount} Trips
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Trip details with driver, expenses, driver payment and party collection
          </p>
        </div>
      </div>

      {/* ── Professional Unified Filter Toolbar ─────────────────────────── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Top Control Line: Date Range + Action Buttons (Reset, Excel, Download, CSV) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>
              Filter by Date:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={resetFilters}
            className="btn btn-outline"
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
            title="Reset all filters"
          >
            <RefreshCw size={14} /> Reset
          </button>

          {/* Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#10b981',
              color: '#059669',
              background: '#ecfdf5',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              flexShrink: 0,
            }}
            title="Download report as an Excel spreadsheet with totals"
          >
            {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {isExportingExcel ? 'Exporting...' : 'Excel'}
          </button>

          {/* Print (Direct Print Option) */}
          <button
            type="button"
            onClick={handlePrintReport}
            disabled={isPrinting}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#3b82f6',
              color: '#1d4ed8',
              background: '#eff6ff',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              flexShrink: 0,
            }}
            title="Direct print trip dispatch audit report"
          >
            {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {isPrinting ? 'Preparing...' : 'Print'}
          </button>

          {/* CSV */}
          <button
            type="button"
            onClick={downloadFullReport}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#64748b',
              color: '#334155',
              background: '#f8fafc',
              fontWeight: 600,
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              flexShrink: 0,
            }}
            title="Download report as CSV"
          >
            <Download size={14} /> CSV
          </button>
        </div>

        {/* Bottom Control Line: Entity Filters (Party, Truck, Unit, Driver, Status) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '14px',
          }}
        >
          {/* Party Wise */}
          <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
            >
              <option value="">All Parties</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {!isOwnerUser && (
          <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
            >
              <option value="">All Truck Owners</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.mobile_number ? `(${o.mobile_number})` : ''}
                </option>
              ))}
            </select>
          </div>
          )}

          {/* Truck Wise */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">{isOwnerUser ? 'My Trucks' : 'All Trucks'}</option>
              {vehicles
                .filter(v => {
                  if (isOwnerUser && ownerScopeIds.length && !ownerScopeIds.includes(Number(v.owner_id))) return false;
                  if (ownerId && String(v.owner_id) !== String(ownerId)) return false;
                  return true;
                })
                .map(v => (
                  <option key={v.id} value={v.id}>
                    {v.lorry_number} {v.owner_name ? `• ${v.owner_name}` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Unit Wise */}
          <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
            >
              <option value="">All Units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Driver Wise */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="SETTLED">Settled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Trips Table ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lorry</th>
                <th>Driver</th>
                <th>Party</th>
                <th>Route / Destination</th>
                <th>Unit &amp; Weight</th>
                <th style={{ textAlign: 'right' }}>Freight</th>
                <th>Driver Expenses</th>
                <th>Driver Payment</th>
                <th style={{ textAlign: 'right' }}>Party Received</th>
                <th style={{ textAlign: 'right' }}>Party Balance</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading trip report records...
                  </td>
                </tr>
              ) : tripData.trips.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No trip records match the selected report criteria.
                  </td>
                </tr>
              ) : (
                tripData.trips.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateDMY(t.trip_date)}</td>
                    <td>
                      <strong>{t.lorry_number}</strong>
                      {t.owner_name && (
                        <div style={{ marginTop: '2px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#4338ca', background: '#e0e7ff', padding: '1px 5px', borderRadius: '3px', border: '1px solid #c7d2fe' }}>
                            🏢 {t.owner_name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{t.driver_name || '—'}</strong>
                    </td>
                    <td>{t.party_name}</td>
                    <td style={{ fontSize: '13px' }}>{t.from_location} &rarr; {t.to_location}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.goods_weight} {t.unit_name || 'Tons'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.total_freight)}</td>
                    <td>
                      {(() => {
                        const bal = driverExpenseBalance(t);
                        return (
                          <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 132, textAlign: 'right' }}>
                            <span>Expenses: <strong style={{ color: '#6d28d9' }}>{formatCurrency(bal.total)}</strong></span>
                            <span style={{ color: '#15803d' }}>Settled: <strong>{formatCurrency(bal.settled)}</strong></span>
                            <span style={{ color: bal.toPay > 0 ? '#b91c1c' : '#15803d' }}>To Pay: <strong>{formatCurrency(bal.toPay)}</strong></span>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                              <StatusBadge status={driverExpenseStatus(t)} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
                        <span>Advance: <strong>{formatCurrency(t.manager_advance ?? t.advance_paid)}</strong></span>
                        {Number(t.need_to_pay) > 0 && (
                          <span style={{ color: '#b91c1c' }}>Need to Pay: <strong>{formatCurrency(t.need_to_pay)}</strong></span>
                        )}
                        {Number(t.in_hand) > 0 && (
                          <span style={{ color: '#047857' }}>In Hand: <strong>{formatCurrency(t.in_hand)}</strong></span>
                        )}
                        {Number(t.driver_cash_paid) > 0 && (
                          <span>Driver paid: <strong>{formatCurrency(t.driver_cash_paid)}</strong></span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--success-700)', fontWeight: 600 }}>{formatCurrency(t.total_received)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: Number(t.balance_due) > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
                      {formatCurrency(t.balance_due)}
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={t.status} /></td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintSingleTrip(t)}
                          className="btn btn-outline btn-sm"
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#1d4ed8',
                            borderColor: '#bfdbfe',
                            background: '#eff6ff',
                          }}
                          title="Direct print trip voucher"
                        >
                          <Printer size={13} />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSingleTripCSV(t)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Download this trip (CSV)"
                        >
                          <Download size={13} />
                          <span>CSV</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {tripData.trips.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                  <td colSpan={5} style={{ padding: '12px 14px' }}>
                    <strong>TOTAL ({totalTripsCount} Trips)</strong>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {totalGoodsWeight.toFixed(2)} Tons
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-hover, #2563eb)' }}>
                    {formatCurrency(totalFreightAmount)}
                  </td>
                  <td style={{ fontWeight: 800, color: '#6d28d9' }}>
                    {formatCurrency(totalDriverExpenses)}
                    <div style={{ fontSize: 11, color: '#15803d' }}>Settled {formatCurrency(Math.max(0, totalDriverExpenses - totalNeedToPay))}</div>
                    <div style={{ fontSize: 11, color: '#b91c1c' }}>To Pay {formatCurrency(totalNeedToPay)}</div>
                  </td>
                  <td style={{ fontWeight: 800 }}>
                    Adv {formatCurrency(totalDriverAdvance)}
                    <div style={{ fontSize: 11, color: '#b91c1c' }}>Pay {formatCurrency(totalNeedToPay)}</div>
                    <div style={{ fontSize: 11, color: '#047857' }}>Hand {formatCurrency(totalInHand)}</div>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--success-700, #15803d)', fontWeight: 800 }}>
                    {formatCurrency(totalReceivedAmount)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: totalBalanceDueAmount > 0 ? 'var(--danger-700, #b91c1c)' : 'var(--success-700, #15803d)' }}>
                    {formatCurrency(totalBalanceDueAmount)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>
                    {totalTripsCount} Trips
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
