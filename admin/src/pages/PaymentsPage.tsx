import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, History, Trash2, Download, Printer, Calendar, RefreshCw, Clock, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { tripService, paymentService, partyService, vehicleService, routeService } from '../services/adminService';
import { Trip, TripPayment, Party, Vehicle, Route } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';
import { OverduePaymentAlertModal } from '../components/Common/OverduePaymentAlertModal';

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
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

function getThisWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(start), to: fmt(end) };
}

export const PaymentsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Overdue payment alert
  const [isOverdueAlertOpen, setIsOverdueAlertOpen] = useState(false);

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [paymentsList, setPaymentsList] = useState<TripPayment[]>([]);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  const loadLookups = async () => {
    try {
      const [pRes, vRes, rRes] = await Promise.all([
        partyService.getParties({ limit: 200, status: 'ACTIVE' }),
        vehicleService.getVehicles({ limit: 200, status: 'ACTIVE' }),
        routeService.getRoutes({ limit: 500, status: 'ACTIVE' }),
      ]);
      setParties(pRes.data.items || (Array.isArray(pRes.data) ? pRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setRoutes(rRes.data.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await tripService.getTrips({
        page,
        limit: 10,
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setTrips(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load trips', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, partyFilter, vehicleFilter, routeFilter, fromDate, toDate]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleThisWeekClick = () => {
    if (isThisWeekActive) {
      setFromDate('');
      setToDate('');
    } else {
      setFromDate(thisWeek.from);
      setToDate(thisWeek.to);
    }
    setPage(1);
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setPartyFilter('');
    setVehicleFilter('');
    setRouteFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const openPaymentModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setReceivedAmount(String(trip.balance_due ?? trip.total_freight));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormError('');
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = async (trip: Trip) => {
    setSelectedTrip(trip);
    try {
      const res = await paymentService.getTripPayments(trip.id);
      setPaymentsList(res.data);
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error('Failed to load payment history', err);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Are you sure you want to delete this payment receipt?')) return;
    try {
      await paymentService.deletePayment(paymentId);
      if (selectedTrip) {
        const res = await paymentService.getTripPayments(selectedTrip.id);
        setPaymentsList(res.data);
      }
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment receipt.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    const amount = parseFloat(receivedAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid received payment amount > 0.');
      return;
    }

    const currentBalance = parseFloat(String(selectedTrip.balance_due ?? selectedTrip.total_freight));
    if (amount > currentBalance + 0.01) {
      setFormError(`Payment amount cannot exceed balance due of ₹${currentBalance.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await paymentService.addPayment(selectedTrip.id, {
        received_amount: amount,
        payment_date: paymentDate,
        notes: notes || undefined,
      });

      setIsPaymentModalOpen(false);
      setSelectedTrip(null);
      loadTrips();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculatePreviewBalance = () => {
    if (!selectedTrip) return 0;
    const currentBalance = parseFloat(String(selectedTrip.balance_due ?? selectedTrip.total_freight));
    const paid = parseFloat(receivedAmount) || 0;
    return Math.max(0, currentBalance - paid);
  };

  // Full CSV Export of all matching records
  const handleDownloadFiltered = async () => {
    try {
      setIsDownloading(true);
      const res = await tripService.getTrips({
        page: 1,
        limit: Math.max(total, 5000),
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      const items = res.data.items || [];
      const sumFreight = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_freight)) || 0), 0);
      const sumReceived = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_received || 0)) || 0), 0);
      const sumBalanceDue = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.balance_due ?? t.total_freight)) || 0), 0);

      const rows: (string | number)[][] = items.map((t, idx) => [
        idx + 1,
        `#${t.id}`,
        formatDateDMY(t.trip_date),
        t.party_name || '',
        t.to_location || t.from_location || '',
        t.lorry_number || '',
        (parseFloat(String(t.total_freight)) || 0).toFixed(2),
        (parseFloat(String(t.total_received || 0)) || 0).toFixed(2),
        (parseFloat(String(t.balance_due ?? t.total_freight)) || 0).toFixed(2),
        Number(t.balance_due ?? t.total_freight) <= 0
          ? 'Fully Paid'
          : Number(t.total_received) > 0
          ? 'Partially Paid'
          : 'Pending',
        t.status || '',
      ]);

      // Blank separator and TOTAL row
      rows.push(['', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['TOTAL', `Total: ${items.length} Trips`, '', '', '', '', sumFreight.toFixed(2), sumReceived.toFixed(2), sumBalanceDue.toFixed(2), '', '']);

      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'All';
      downloadCSV(
        `Party_Payments_${dateTag}.csv`,
        [
          'S.No',
          'Trip ID',
          'Date',
          'Party Name',
          'Unit / Destination',
          'Lorry Number',
          'Total Freight (INR)',
          'Received Amount (INR)',
          'Balance Due (INR)',
          'Payment Status',
          'Trip Status',
        ],
        rows
      );
    } catch (err) {
      console.error('Failed to download payments CSV', err);
      alert('Failed to download CSV report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportExcel = async () => {
    if (total === 0 && trips.length === 0) {
      alert('No payment records found to export.');
      return;
    }

    try {
      setIsExportingExcel(true);
      const res = await tripService.getTrips({
        page: 1,
        limit: Math.max(total, 5000),
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      const items = res.data.items || [];
      if (items.length === 0) {
        alert('No payment records match the selected filters.');
        return;
      }

      const sumFreight = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_freight)) || 0), 0);
      const sumReceived = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_received || 0)) || 0), 0);
      const sumBalanceDue = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.balance_due ?? t.total_freight)) || 0), 0);

      const exportRows: any[] = items.map((t: Trip, idx: number) => ({
        'S.No': idx + 1,
        'Trip ID': `#${t.id}`,
        'Date': formatDateDMY(t.trip_date),
        'Party Name': t.party_name || '',
        'Unit / Destination': t.to_location || t.from_location || '',
        'Lorry Number': t.lorry_number || '',
        'Total Freight (₹)': parseFloat(String(t.total_freight)) || 0,
        'Received Amount (₹)': parseFloat(String(t.total_received || 0)) || 0,
        'Balance Due (₹)': parseFloat(String(t.balance_due ?? t.total_freight)) || 0,
        'Payment Status': Number(t.balance_due ?? t.total_freight) <= 0
          ? 'Fully Paid'
          : Number(t.total_received) > 0
          ? 'Partially Paid'
          : 'Pending',
        'Trip Status': t.status || '',
      }));

      // Blank separator row
      exportRows.push({
        'S.No': '' as any,
        'Trip ID': '',
        'Date': '',
        'Party Name': '',
        'Unit / Destination': '',
        'Lorry Number': '',
        'Total Freight (₹)': '' as any,
        'Received Amount (₹)': '' as any,
        'Balance Due (₹)': '' as any,
        'Payment Status': '',
        'Trip Status': '',
      });

      // TOTAL SUMMARY Row
      exportRows.push({
        'S.No': 'TOTAL' as any,
        'Trip ID': `Total Count: ${items.length} Trips`,
        'Date': '',
        'Party Name': '',
        'Unit / Destination': '',
        'Lorry Number': '',
        'Total Freight (₹)': sumFreight,
        'Received Amount (₹)': sumReceived,
        'Balance Due (₹)': sumBalanceDue,
        'Payment Status': '',
        'Trip Status': '',
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 12 }, // Trip ID
        { wch: 14 }, // Date
        { wch: 28 }, // Party Name
        { wch: 22 }, // Unit / Destination
        { wch: 16 }, // Lorry Number
        { wch: 18 }, // Total Freight
        { wch: 18 }, // Received Amount
        { wch: 18 }, // Balance Due
        { wch: 16 }, // Payment Status
        { wch: 14 }, // Trip Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Party Payments');

      // Secondary Summary Sheet
      const selectedPartyName = partyFilter ? parties.find((p) => String(p.id) === String(partyFilter))?.name || 'Selected' : 'All Parties';
      const selectedVehicleNo = vehicleFilter ? vehicles.find((v) => String(v.id) === String(vehicleFilter))?.lorry_number || 'Selected' : 'All Vehicles';
      const summaryRows = [
        { 'Summary Field': 'Report Name', 'Value': 'Party Payments Ledger Report' },
        { 'Summary Field': 'Total Trips / Invoices', 'Value': items.length },
        { 'Summary Field': 'Total Freight Amount (₹)', 'Value': sumFreight },
        { 'Summary Field': 'Total Received Amount (₹)', 'Value': sumReceived },
        { 'Summary Field': 'Total Balance Due (₹)', 'Value': sumBalanceDue },
        { 'Summary Field': 'Party Filter', 'Value': selectedPartyName },
        { 'Summary Field': 'Vehicle Filter', 'Value': selectedVehicleNo },
        { 'Summary Field': 'Payment Status Filter', 'Value': statusFilter || 'All Statuses' },
        { 'Summary Field': 'Date Range', 'Value': fromDate || toDate ? `${fromDate || 'Start'} to ${toDate || 'End'}` : 'All Dates' },
        { 'Summary Field': 'Export Timestamp', 'Value': new Date().toLocaleString('en-IN') },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 30 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `KSP_Party_Payments_${dateTag}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export payments to Excel', err);
      alert(err.message || 'Failed to export payments to Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrintPayments = async () => {
    if (total === 0 && trips.length === 0) {
      alert('No payment records to print.');
      return;
    }

    try {
      setIsPrinting(true);
      const res = await tripService.getTrips({
        page: 1,
        limit: Math.max(total, 5000),
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      const items = res.data.items || [];
      if (items.length === 0) {
        alert('No payment records match the selected filters to print.');
        return;
      }

      const sumFreight = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_freight)) || 0), 0);
      const sumReceived = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.total_received || 0)) || 0), 0);
      const sumBalanceDue = items.reduce((acc: number, t: Trip) => acc + (parseFloat(String(t.balance_due ?? t.total_freight)) || 0), 0);

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Logistics - Party Payments Ledger</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 11.5px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .kpi-highlight .kpi-value { color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
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
    .badge-danger { background: #fee2e2; color: #991b1b; }
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
    <button class="print-btn" onclick="window.print()">Print Ledger / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
      <div class="report-subtitle">PARTY FREIGHT PAYMENTS &amp; BALANCE LEDGER REPORT</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; font-size: 13px; color: #0f172a;">Total Records: ${items.length}</div>
      <p class="meta-text" style="margin-top: 4px;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">S.No</th>
        <th style="width: 65px;">Trip ID</th>
        <th style="width: 80px;">Date</th>
        <th>Party Name</th>
        <th>Unit / Destination</th>
        <th style="width: 90px;">Lorry No</th>
        <th class="num" style="width: 95px;">Freight (₹)</th>
        <th class="num" style="width: 95px;">Received (₹)</th>
        <th class="num" style="width: 95px;">Balance (₹)</th>
        <th class="center" style="width: 90px;">Payment Status</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((t: Trip, idx: number) => {
        const bal = parseFloat(String(t.balance_due ?? t.total_freight)) || 0;
        const rec = parseFloat(String(t.total_received || 0)) || 0;
        let badgeClass = 'badge-pending';
        let statusText = 'Pending';
        if (bal <= 0) {
          badgeClass = 'badge-paid';
          statusText = 'Fully Paid';
        } else if (rec > 0) {
          badgeClass = 'badge-partial';
          statusText = 'Partially Paid';
        }

        return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong>#${t.id}</strong></td>
          <td>${formatDateDMY(t.trip_date)}</td>
          <td><strong>${t.party_name || '-'}</strong></td>
          <td>${t.to_location || t.from_location || '-'}</td>
          <td><strong>${t.lorry_number || '-'}</strong></td>
          <td class="num">₹${(parseFloat(String(t.total_freight)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num" style="color:#15803d; font-weight:600;">₹${rec.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num" style="color:${bal > 0 ? '#b91c1c' : '#15803d'}; font-weight:700;">₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="center"><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
        `;
      }).join('')}
      <tr class="footer-row">
        <td class="center">TOTAL</td>
        <td colspan="5"><strong>Total Count: ${items.length} Trips</strong></td>
        <td class="num"><strong>₹${sumFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="num" style="color:#15803d;"><strong>₹${sumReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="num" style="color:${sumBalanceDue > 0 ? '#b91c1c' : '#15803d'};"><strong>₹${sumBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="center"><strong>${items.length} Trips</strong></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP</span>
    <span>Party Freight Payments Ledger Record</span>
  </div>
</body>
</html>
      `;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        alert('Please allow popups to print report.');
        return;
      }
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } catch (err: any) {
      console.error('Failed to print party payments', err);
      alert('Failed to generate print document.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Single-row CSV export
  const handleDownloadSingleTrip = (t: Trip) => {
    const filename = `Party_Payment_Trip_${t.id}_${(t.party_name || 'party').replace(/[^a-zA-Z0-9]/g, '_')}_${formatDateDMY(t.trip_date)}.csv`;
    downloadCSV(
      filename,
      [
        'Trip ID',
        'Date',
        'Party Name',
        'Unit / Destination',
        'Lorry Number',
        'Total Freight (INR)',
        'Received Amount (INR)',
        'Balance Due (INR)',
        'Payment Status',
        'Trip Status',
      ],
      [[
        `#${t.id}`,
        formatDateDMY(t.trip_date),
        t.party_name || '',
        t.to_location || t.from_location || '',
        t.lorry_number || '',
        (parseFloat(String(t.total_freight)) || 0).toFixed(2),
        (parseFloat(String(t.total_received || 0)) || 0).toFixed(2),
        (parseFloat(String(t.balance_due ?? t.total_freight)) || 0).toFixed(2),
        Number(t.balance_due ?? t.total_freight) <= 0
          ? 'Fully Paid'
          : Number(t.total_received) > 0
          ? 'Partially Paid'
          : 'Pending',
        t.status || '',
      ]]
    );
  };

  const columns: Column<Trip>[] = [
    { header: 'Trip ID', accessor: (t) => `#${t.id}` },
    { header: 'Date', accessor: (t) => formatDateDMY(t.trip_date) },
    { header: 'Party Name', accessor: 'party_name', render: (t) => <strong>{t.party_name}</strong> },
    {
      header: 'Unit Name',
      render: (t) => (
        <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
          {t.to_location || t.from_location}
        </span>
      ),
    },
    { header: 'Total Freight', render: (t) => formatCurrency(t.total_freight) },
    {
      header: 'Received Amount',
      render: (t) => <strong style={{ color: 'var(--success-700)' }}>{formatCurrency(t.total_received || 0)}</strong>,
    },
    {
      header: 'Balance Due',
      render: (t) => (
        <strong style={{ color: (t.balance_due || 0) > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
          {formatCurrency(t.balance_due ?? t.total_freight)}
        </strong>
      ),
    },
    { header: 'Status', accessor: 'status', render: (t) => <StatusBadge status={t.status} /> },
    {
      header: 'Actions',
      render: (t) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(t.balance_due ?? t.total_freight) > 0 && t.status !== 'CANCELLED' && (
            <button onClick={() => openPaymentModal(t)} className="btn btn-primary btn-sm" title="Collect Payment">
              <CreditCard size={14} /> Collect
            </button>
          )}
          <button onClick={() => openHistoryModal(t)} className="btn btn-outline btn-sm" title="Payment History">
            <History size={14} /> History
          </button>
          <button
            onClick={() => handleDownloadSingleTrip(t)}
            className="btn btn-outline btn-sm"
            style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Download this record (CSV)"
          >
            <Download size={13} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>CSV</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Overdue Payment Alert Modal ───────────────────────── */}
      <OverduePaymentAlertModal
        isOpenManually={isOverdueAlertOpen || undefined}
        onCloseManual={() => setIsOverdueAlertOpen(false)}
      />
      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Party Payments</h2>
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
              Total: {total} Records
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px', marginBottom: 0 }}>
            Record customer freight payments, view balance dues &amp; transaction ledger
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsOverdueAlertOpen(true)}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#d97706', color: '#b45309' }}
            title="View overdue payments (pending 30+ days)"
          >
            <Clock size={16} /> Overdue Alerts
          </button>
        </div>
      </div>

      {/* ── Professional Unified Filter Toolbar (Matching Report Master) ─── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Top Control Line: Date Range + This Week Quick Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
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
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleThisWeekClick}
            className={`btn btn-sm ${isThisWeekActive ? 'btn-primary' : 'btn-outline'}`}
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px',
              flexShrink: 0,
            }}
            title="Filter by current week"
          >
            <Calendar size={14} />
            This Week
          </button>
        </div>

        {/* Bottom Control Line: Entity Filters (Party, Truck, Unit, Payment Status, Reset) */}
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
          <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={partyFilter}
              onChange={(e) => {
                setPartyFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Truck Wise */}
          <div style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={vehicleFilter}
              onChange={(e) => {
                setVehicleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Vehicle Numbers</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lorry_number}
                </option>
              ))}
            </select>
          </div>

          {/* Party Delivery Unit (Route) Filter */}
          <div style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={routeFilter}
              onChange={(e) => {
                setRouteFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Units</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.to_location}{r.party_name ? ` (${r.party_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div style={{ flex: '1 1 170px', minWidth: '150px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Payment Statuses</option>
              <option value="PAYMENT_PENDING">Pending Payments</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="SETTLED">Fully Settled</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          <button
            type="button"
            onClick={resetFilters}
            className="btn btn-outline"
            style={{ height: '38px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Reset all filters"
          >
            <RefreshCw size={14} /> Reset
          </button>

          {/* Print & Download Options Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrintPayments}
              disabled={isPrinting}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 600,
                height: '38px',
                padding: '0 12px',
                fontSize: '12.5px',
              }}
              title="Direct print party payments audit report"
            >
              {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {isPrinting ? 'Preparing...' : 'Print'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: '#10b981',
                color: '#059669',
                background: '#ecfdf5',
                fontWeight: 600,
                height: '38px',
                padding: '0 12px',
                fontSize: '12.5px',
              }}
              title="Download party payments as an Excel spreadsheet with total summary"
            >
              {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {isExportingExcel ? 'Exporting...' : 'Excel'}
            </button>
            <button
              onClick={handleDownloadFiltered}
              disabled={isDownloading}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '38px', padding: '0 10px', fontSize: '12.5px' }}
              title="Download party payments as CSV"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {(() => {
        const pageTotalFreight = trips.reduce((acc, t) => acc + (parseFloat(String(t.total_freight)) || 0), 0);
        const pageTotalReceived = trips.reduce((acc, t) => acc + (parseFloat(String(t.total_received || 0)) || 0), 0);
        const pageTotalBalance = trips.reduce((acc, t) => acc + (parseFloat(String(t.balance_due ?? t.total_freight)) || 0), 0);

        return (
          <div className="card">
            <DataTable
              columns={columns}
              data={trips}
              isLoading={isLoading}
              total={total}
              page={page}
              limit={10}
              onPageChange={setPage}
              footer={
                trips.length > 0 ? (
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>TOTAL</td>
                    <td style={{ fontWeight: 700 }}>Total: {total} Trips</td>
                    <td colSpan={3}></td>
                    <td style={{ fontWeight: 800, color: 'var(--accent-hover, #2563eb)' }}>
                      {formatCurrency(pageTotalFreight)}
                    </td>
                    <td style={{ color: 'var(--success-700, #15803d)', fontWeight: 800 }}>
                      {formatCurrency(pageTotalReceived)}
                    </td>
                    <td style={{ fontWeight: 800, color: pageTotalBalance > 0 ? 'var(--danger-700, #b91c1c)' : 'var(--success-700, #15803d)' }}>
                      {formatCurrency(pageTotalBalance)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                        {total} Records
                      </span>
                    </td>
                    <td></td>
                  </tr>
                ) : undefined
              }
            />
          </div>
        );
      })()}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Party Payment for Trip #${selectedTrip?.id}`}
        maxWidth="600px"
      >
        {selectedTrip && (
          <div>
            {formError && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            {/* Trip Context Card */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Party:</span>
                <strong>{selectedTrip.party_name}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Unit / Destination:</span>
                <strong>{selectedTrip.to_location || selectedTrip.from_location}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Freight Billed:</span>
                <strong>{formatCurrency(selectedTrip.total_freight)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Already Received:</span>
                <strong style={{ color: 'var(--success-700)' }}>{formatCurrency(selectedTrip.total_received || 0)}</strong>
              </div>
              <div className="slip-row" style={{ borderTop: '1px solid var(--border-medium)', paddingTop: '8px', marginTop: '6px' }}>
                <span>Current Balance Due:</span>
                <strong style={{ color: 'var(--danger-700)', fontSize: '15px' }}>
                  {formatCurrency(selectedTrip.balance_due ?? selectedTrip.total_freight)}
                </strong>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <DateField
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Received Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    required
                    placeholder="Enter received payment"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Notes / Reference No.</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Bank NEFT #123456 or Cash receipt"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Real-time Calculation Summary */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#fff',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
                    Remaining Balance Due After Payment
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                    {calculatePreviewBalance() === 0 ? 'Full Payment — Status will be SETTLED' : 'Partial Payment'}
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>
                  {formatCurrency(calculatePreviewBalance())}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Payment History for Trip #${selectedTrip?.id}`}
        maxWidth="650px"
      >
        <div>
          {paymentsList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No payments recorded yet for this trip.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Remaining</th>
                    <th>Collected By</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateDMY(p.payment_date)}</td>
                      <td style={{ color: 'var(--success-700)', fontWeight: 700 }}>
                        {formatCurrency(p.received_amount)}
                      </td>
                      <td>{formatCurrency(p.balance_due)}</td>
                      <td>{p.created_by_name || 'Admin'}</td>
                      <td>{p.notes || '—'}</td>
                      <td>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--danger-700)', padding: '4px 8px' }}
                          title="Delete payment record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
