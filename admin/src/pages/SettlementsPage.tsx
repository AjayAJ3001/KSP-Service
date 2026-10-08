import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle, Printer, Eye, PlusCircle, Trash2,
  Banknote, Smartphone, Clock, IndianRupee, History, Download, Share2,
  Calendar, RefreshCw, FileSpreadsheet, Database, Search,
} from 'lucide-react';
import { settlementService, tripService, driverService, vehicleService, partyService } from '../services/adminService';
import { Settlement, Trip, DriverSettlementPayment, Driver, Vehicle, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

function getThisWeekRange() {
  const today = new Date();
  const day = today.getDay();
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

export const SettlementsPage: React.FC = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [unsettledTrips, setUnsettledTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Lookups
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [selectedTripToSettle, setSelectedTripToSettle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Pay Driver Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Settlement | null>(null);
  const [payMode, setPayMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Payment History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<DriverSettlementPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search & Excel Export with Local Storage tracking
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false);
  const [localExports, setLocalExports] = useState<any[]>([]);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [dRes, vRes, pRes] = await Promise.all([
        driverService.getDrivers({ limit: 200 }),
        vehicleService.getVehicles({ limit: 200 }),
        partyService.getParties({ limit: 200 }),
      ]);
      setDrivers(dRes.data.items || (Array.isArray(dRes.data) ? dRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setParties(pRes.data.items || (Array.isArray(pRes.data) ? pRes.data : []));
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    loadSettlements();
    loadUnsettledTrips();
  }, [page, statusFilter, driverFilter, vehicleFilter, partyFilter, fromDate, toDate, searchTerm]);

  const loadSettlements = async () => {
    try {
      setIsLoading(true);
      const res = await settlementService.getSettlements({
        page,
        limit: 10,
        status: statusFilter || undefined,
        driver_id: driverFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        party_id: partyFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: searchTerm || undefined,
      });
      setSettlements(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load settlements', err);
    } finally {
      setIsLoading(false);
    }
  };

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
    setStatusFilter('');
    setDriverFilter('');
    setVehicleFilter('');
    setPartyFilter('');
    setSearchTerm('');
    setPage(1);
  };

  // ── Download Excel Option & Save Record into Local Storage ──
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      // Fetch all matching records for the current filter criteria
      const res = await settlementService.getSettlements({
        page: 1,
        limit: 10000,
        status: statusFilter || undefined,
        driver_id: driverFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        party_id: partyFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: searchTerm || undefined,
      });

      const items: Settlement[] = res.data.items || [];
      if (items.length === 0) {
        alert('No settlement records found matching your filters to export.');
        setIsExportingExcel(false);
        return;
      }

      // Format data rows for executive Excel sheet
      const excelRows = items.map((s) => ({
        'Settlement ID': `SET-${s.id}`,
        'Trip ID': `TRIP-${s.trip_id}`,
        'Trip Date': s.trip_date ? s.trip_date.slice(0, 10) : '-',
        'Lorry Number': s.lorry_number || '-',
        'Driver Name': s.driver_name || '-',
        'Driver Mobile': s.driver_mobile || '-',
        'Party Name': s.party_name || '-',
        'From Location': s.from_location || '-',
        'To Location': s.to_location || '-',
        'Goods Weight (MT)': Number(s.goods_weight || 0),
        'Freight Rate (Rs)': Number(s.freight_rate || 0),
        'Total Freight (Rs)': Number(s.total_freight || 0),
        'Advance Paid (Rs)': Number(s.advance_paid || 0),
        'Total Expenses (Rs)': Number(s.total_expenses || 0),
        'Balance Payable (Rs)': Number(s.balance_to_driver || 0),
        'Settlement Status': s.settlement_status,
        'Payment Mode': s.payment_mode || '-',
        'Payment Date': s.payment_date ? s.payment_date.slice(0, 10) : '-',
        'Paid Amount (Rs)': Number(s.paid_amount || 0),
        'Reference No / UTR': s.reference_no || '-',
        'Settled By': s.settled_by_name || '-',
        'Notes': s.notes || '-',
        'Created At': s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : '-',
      }));

      // Generate Worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // Auto Column Widths
      worksheet['!cols'] = [
        { wch: 15 }, // Settlement ID
        { wch: 12 }, // Trip ID
        { wch: 14 }, // Trip Date
        { wch: 16 }, // Lorry Number
        { wch: 22 }, // Driver Name
        { wch: 15 }, // Driver Mobile
        { wch: 24 }, // Party Name
        { wch: 20 }, // From Location
        { wch: 20 }, // To Location
        { wch: 18 }, // Goods Weight
        { wch: 16 }, // Freight Rate
        { wch: 18 }, // Total Freight
        { wch: 18 }, // Advance Paid
        { wch: 18 }, // Total Expenses
        { wch: 20 }, // Balance Payable
        { wch: 18 }, // Status
        { wch: 15 }, // Payment Mode
        { wch: 15 }, // Payment Date
        { wch: 16 }, // Paid Amount
        { wch: 22 }, // Reference No
        { wch: 20 }, // Settled By
        { wch: 25 }, // Notes
        { wch: 22 }, // Created At
      ];

      // Create Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Settlements');

      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `KSP_Settlements_Export_${dateTag}.xlsx`;

      // 1. Trigger download to local drive / downloads folder (local storage)
      XLSX.writeFile(workbook, filename);

      // 2. Save export record and summary metadata to browser LocalStorage
      const selectedTruck = vehicleFilter ? vehicles.find(v => String(v.id) === String(vehicleFilter))?.lorry_number : 'All';
      const selectedDriver = driverFilter ? drivers.find(d => String(d.id) === String(driverFilter))?.name : 'All';
      const selectedParty = partyFilter ? parties.find(p => String(p.id) === String(partyFilter))?.name : 'All';

      const exportLog = {
        id: Date.now().toString(),
        filename,
        saved_at: new Date().toLocaleString('en-IN'),
        timestamp: new Date().toISOString(),
        record_count: items.length,
        filters_used: {
          fromDate: fromDate || 'All',
          toDate: toDate || 'All',
          status: statusFilter || 'All',
          lorry: selectedTruck,
          driver: selectedDriver,
          party: selectedParty,
          search: searchTerm || 'None',
        },
        totals: {
          freight: items.reduce((sum, r) => sum + Number(r.total_freight || 0), 0),
          expenses: items.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0),
          balance: items.reduce((sum, r) => sum + Number(r.balance_to_driver || 0), 0),
          paid: items.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0),
        }
      };

      try {
        const stored = JSON.parse(localStorage.getItem('ksp_settlements_excel_history') || '[]');
        const updated = [exportLog, ...stored].slice(0, 30);
        localStorage.setItem('ksp_settlements_excel_history', JSON.stringify(updated));

        // Save last snapshot data to local storage
        localStorage.setItem('ksp_last_settlements_excel_data', JSON.stringify({
          filename,
          saved_at: new Date().toISOString(),
          record_count: items.length,
          preview: excelRows.slice(0, 50),
        }));
      } catch (storageErr) {
        console.warn('LocalStorage error:', storageErr);
      }

      setExcelNotice(`Excel downloaded successfully to your computer & saved to Local Storage (${items.length} records).`);
      setTimeout(() => setExcelNotice(null), 6000);
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      alert(err.message || 'Error occurred while exporting Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const openLocalStorageHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem('ksp_settlements_excel_history') || '[]');
      setLocalExports(history);
    } catch {
      setLocalExports([]);
    }
    setIsLocalStorageModalOpen(true);
  };

  const clearLocalStorageHistory = () => {
    if (window.confirm('Are you sure you want to clear your local storage Excel export history?')) {
      localStorage.removeItem('ksp_settlements_excel_history');
      localStorage.removeItem('ksp_last_settlements_excel_data');
      setLocalExports([]);
    }
  };

  const loadUnsettledTrips = async () => {
    try {
      const res = await tripService.getTrips({ limit: 100 });
      // Show trips not yet settled
      const eligible = res.data.items.filter((t) => t.status !== 'SETTLED' && t.status !== 'CANCELLED');
      setUnsettledTrips(eligible);
    } catch (err) {
      console.error('Failed to load unsettled trips', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripToSettle) return;

    try {
      setIsSubmitting(true);
      await settlementService.generateSettlement(parseInt(selectedTripToSettle));
      setIsGenerateModalOpen(false);
      setSelectedTripToSettle('');
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to generate settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (id: number) => {
    if (!confirm('Are you sure you want to mark this settlement as VERIFIED?')) return;
    try {
      await settlementService.verifySettlement(id);
      loadSettlements();
    } catch (err: any) {
      alert(err.message || 'Failed to verify settlement.');
    }
  };

  const handleDeleteSettlement = async (settlement: Settlement) => {
    if (!confirm(`Are you sure you want to delete Settlement #${settlement.id} for Trip #${settlement.trip_id}?`)) return;
    try {
      await settlementService.deleteSettlement(settlement.id);
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete settlement.');
    }
  };

  const openSlipModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setIsSlipModalOpen(true);
  };

  const openPayModal = (settlement: Settlement) => {
    setPayTarget(settlement);
    setPayAmount(Math.abs(parseFloat(String(settlement.balance_to_driver || 0))).toFixed(2));
    setPayMode('CASH');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayNotes('');
    setPayError('');
    setIsPayModalOpen(true);
  };

  const handlePayDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPayError('Please enter a valid amount.'); return; }
    setPayError('');
    try {
      setIsPaying(true);
      await settlementService.settlePayment(payTarget.id, {
        payment_mode: payMode,
        payment_date: payDate,
        paid_amount: amount,
        reference_no: payRef || undefined,
        notes: payNotes || undefined,
      });
      setIsPayModalOpen(false);
      loadSettlements();
    } catch (err: any) {
      setPayError(err.response?.data?.message || err.message || 'Failed to record payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const openHistoryModal = async (settlement: Settlement) => {
    setPayTarget(settlement);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await settlementService.getSettlementPayments(settlement.id);
      setPaymentHistory(res.data || []);
    } catch { setPaymentHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById('printable-settlement-slip');
    if (!el || !selectedSettlement) return;
    try {
      setIsDownloading(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      const finalH = imgH > pageH - 20 ? pageH - 20 : imgH;
      pdf.addImage(imgData, 'PNG', 10, 10, imgW, finalH);
      pdf.save(`KSP-Settlement-${selectedSettlement.id}-Trip${selectedSettlement.trip_id}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const buildChallanHtml = (s: Settlement): string => {
    const isSettled = s.settlement_status === 'SETTLED';
    const tripDate = s.trip_date ? formatDateDMY(s.trip_date) : '—';
    const payDate = s.payment_date ? formatDateDMY(s.payment_date) : '';
    const netPayable = parseFloat(String(s.balance_to_driver || 0));
    const isPositive = netPayable >= 0;

    const expenseRows = (s.expense_items && s.expense_items.length > 0)
      ? s.expense_items.map((item, idx) => `
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
            <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px;">${formatCurrency(s.total_expenses)}</td>
          </tr>
        `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KSP Settlement Challan #${s.id} - Trip #${s.trip_id}</title>
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
              <strong>Voucher #:</strong> SETTLE-${s.id}<br />
              <strong>Trip Ref:</strong> #TRIP-${s.trip_id}<br />
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
        <td class="info-val"><span class="plate-box">${s.lorry_number}</span></td>
        <td class="info-label">Party / Consignor</td>
        <td class="info-val">${s.party_name}</td>
      </tr>
      <tr>
        <td class="info-label">Driver Name</td>
        <td class="info-val">${s.driver_name}</td>
        <td class="info-label">Destination / Unit</td>
        <td class="info-val">${s.to_location || s.from_location || '—'}</td>
      </tr>
      <tr>
        <td class="info-label">Trip Dispatch Date</td>
        <td class="info-val">${tripDate}</td>
        <td class="info-label">Settlement Mode</td>
        <td class="info-val">${s.payment_mode || (isSettled ? 'CASH' : 'PENDING')}</td>
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
          <td style="text-align: right; padding: 7px 8px; font-size: 12.5px; color: #b45309;">${formatCurrency(s.total_expenses)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px;">
      2. Final Settlement Account Statement
    </div>
    <div class="calc-box">
      <div class="calc-row">
        <span>Total Gross Freight Billed:</span>
        <strong>${formatCurrency(s.total_freight)}</strong>
      </div>
      <div class="calc-row">
        <span>Less: Total Driver Expenses Incurred:</span>
        <strong style="color: #b45309;">(-) ${formatCurrency(s.total_expenses)}</strong>
      </div>
      <div class="calc-row">
        <span>Less: Trip Advance Already Paid to Driver:</span>
        <strong style="color: #475569;">(-) ${formatCurrency(s.advance_paid)}</strong>
      </div>
      <div class="calc-row highlight">
        <span>NET BALANCE PAYABLE TO DRIVER:</span>
        <span>${isPositive ? '+' : ''}${formatCurrency(s.balance_to_driver)}</span>
      </div>
    </div>

    ${isSettled && s.payment_mode ? `
      <div class="discharge-box">
        <div class="discharge-title">✔ OFFICIAL DISBURSEMENT RECEIPT</div>
        <div style="line-height: 1.6;">
          Paid Amount: <strong>${formatCurrency(s.paid_amount || s.balance_to_driver)}</strong> via <strong>${s.payment_mode}</strong>
          ${s.payment_date ? ` · Paid on <strong>${formatDateDMY(s.payment_date)}</strong>` : ''}
          ${s.reference_no ? ` · Ref/UTR: <strong>${s.reference_no}</strong>` : ''}
          ${s.settled_by_name ? ` · Authorized &amp; Disbursed by: <strong>${s.settled_by_name}</strong>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="declaration">
      <strong>Declaration &amp; Acknowledgment:</strong>
      Certified that all vehicle fuel, driver allowances, unloading/loading dues and miscellaneous expenses for Trip #${s.trip_id} have been verified against original vouchers and settled in full. The driver acknowledges receipt of the net amount without further claims.
    </div>

    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-line"></div>
          <div class="sig-title">Driver's Signature</div>
          <div class="sig-sub">Name: <strong>${s.driver_name}</strong></div>
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

  const handlePrint = () => {
    if (!selectedSettlement) return;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) { window.print(); return; }
    printWindow.document.write(buildChallanHtml(selectedSettlement));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 350);
  };

  const handleShare = async () => {
    const el = document.getElementById('printable-settlement-slip');
    if (!el || !selectedSettlement) return;
    try {
      setIsDownloading(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      const finalH = imgH > pageH - 20 ? pageH - 20 : imgH;
      pdf.addImage(imgData, 'PNG', 10, 10, imgW, finalH);
      const blob = pdf.output('blob');
      const file = new File([blob], `KSP-Settlement-${selectedSettlement.id}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `KSP Settlement #${selectedSettlement.id}`,
          text: `Trip Settlement for ${selectedSettlement.driver_name} — ${selectedSettlement.lorry_number}`,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `KSP Settlement #${selectedSettlement.id}`,
          text: `Trip Settlement for ${selectedSettlement.driver_name} — ${selectedSettlement.lorry_number}`,
        });
      } else {
        // Fallback: download the file
        pdf.save(`KSP-Settlement-${selectedSettlement.id}-Trip${selectedSettlement.trip_id}.pdf`);
        alert('Sharing not supported on this device. PDF downloaded instead.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Share failed', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const payModeIcon = (mode: string) => {
    if (mode === 'UPI') return <Smartphone size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#7c3aed' }} />;
    if (mode === 'CASH') return <Banknote size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#15803d' }} />;
    return <IndianRupee size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#1e40af' }} />;
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: Column<Settlement>[] = [
    {
      header: 'Settlement ID',
      accessor: (s) => <strong>#{s.id}</strong>,
    },
    {
      header: 'Trip & Lorry',
      accessor: 'lorry_number',
      render: (s) => (
        <div>
          <strong>Trip #{s.trip_id}</strong> — {s.lorry_number}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {s.driver_name} | <span style={{ fontWeight: 600, color: '#1e40af' }}>{s.to_location || s.from_location}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Trip Date',
      accessor: (s) => (s.trip_date ? formatDateDMY(s.trip_date) : '—'),
    },
    { header: 'Total Freight', render: (s) => formatCurrency(s.total_freight) },
    { header: 'Total Expenses', render: (s) => formatCurrency(s.total_expenses) },
    { header: 'Advance Paid', render: (s) => formatCurrency(s.advance_paid) },
    {
      header: 'Balance to Driver',
      render: (s) => (
        <strong style={{ color: s.balance_to_driver >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
          {formatCurrency(s.balance_to_driver)}
        </strong>
      ),
    },
    {
      header: 'Payment',
      render: (s) => (
        s.settlement_status === 'SETTLED' && s.payment_mode ? (
          <span style={{ fontSize: '12px' }}>
            {payModeIcon(s.payment_mode)}
            <span style={{ fontWeight: 600 }}>{s.payment_mode}</span>
            {s.payment_date && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{formatDateDMY(s.payment_date)}</div>}
          </span>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
      ),
    },
    { header: 'Status', accessor: 'settlement_status', render: (s) => <StatusBadge status={s.settlement_status} /> },
    {
      header: 'Actions',
      render: (s) => (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <button onClick={() => openSlipModal(s)} className="btn btn-outline btn-sm" title="View Settlement Slip">
            <Eye size={13} /> Slip
          </button>
          {(s.settlement_status === 'PENDING' || s.settlement_status === 'VERIFIED') && (
            <button
              onClick={() => openPayModal(s)}
              className="btn btn-sm"
              title="Pay Driver"
              style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              <IndianRupee size={13} /> Pay Driver
            </button>
          )}
          <button
            onClick={() => handleDeleteSettlement(s)}
            className="btn btn-danger btn-sm"
            title="Delete Settlement"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Trip Settlements</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Generate final trip settlement slips, audit driver balances, export Excel reports & print settlement vouchers
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={openLocalStorageHistory}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="View settlements Excel export logs stored in local storage"
          >
            <Database size={15} /> Local Storage Logs
          </button>
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
            }}
            title="Download filtered settlement records as an Excel spreadsheet and save to local storage"
          >
            <FileSpreadsheet size={16} />
            {isExportingExcel ? 'Exporting Excel...' : 'Download Excel'}
          </button>
          <button onClick={() => setIsGenerateModalOpen(true)} className="btn btn-primary">
            <PlusCircle size={18} /> Settle Trip
          </button>
        </div>
      </div>

      {excelNotice && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CheckCircle size={18} color="#059669" />
          <span>{excelNotice}</span>
        </div>
      )}

      <div className="card">
        {/* ── Professional Filter Toolbar (Date, Status, Truck, Driver, Party, Search) ─── */}
        <div style={{ padding: '16px 18px', background: 'var(--surface-color, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', marginBottom: '18px' }}>
          {/* Top Control Line: Date Range & This Week */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>
                Filter by Date:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <DateField
                style={{ width: '155px', height: '36px' }}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <DateField
                style={{ width: '155px', height: '36px' }}
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
                height: '36px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '6px',
                flexShrink: 0,
              }}
              title="Filter by current week"
            >
              <Calendar size={13} /> This Week
            </button>
          </div>

          {/* Bottom Control Line: Status, Truck, Driver, Party, Search, Reset */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              paddingTop: '12px',
            }}
          >
            {/* Status Dropdown */}
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <select
                className="form-control form-select"
                style={{ width: '100%', height: '36px', fontSize: '13px' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="SETTLED">SETTLED</option>
              </select>
            </div>

            {/* Truck Dropdown */}
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <select
                className="form-control form-select"
                style={{ width: '100%', height: '36px', fontSize: '13px' }}
                value={vehicleFilter}
                onChange={(e) => {
                  setVehicleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Trucks / Lorries</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.lorry_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Dropdown */}
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <select
                className="form-control form-select"
                style={{ width: '100%', height: '36px', fontSize: '13px' }}
                value={driverFilter}
                onChange={(e) => {
                  setDriverFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Drivers</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Party Dropdown */}
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <select
                className="form-control form-select"
                style={{ width: '100%', height: '36px', fontSize: '13px' }}
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

            {/* Keyword Search */}
            <div style={{ flex: '1 1 180px', minWidth: '160px', position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search Lorry, Driver, ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{ height: '36px', fontSize: '13px', paddingLeft: '32px' }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-outline"
              style={{
                height: '36px',
                padding: '0 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Reset all filters"
            >
              <RefreshCw size={13} /> Reset
            </button>

            {/* Quick Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="btn btn-outline"
              style={{
                height: '36px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#059669',
                borderColor: '#10b981',
                background: '#f0fdf4',
              }}
              title="Download filtered settlements to Excel & record in Local Storage"
            >
              <FileSpreadsheet size={14} /> {isExportingExcel ? 'Exporting...' : 'Excel'}
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={settlements}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* Settle Trip Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Trip Settlement"
      >
        <form onSubmit={handleGenerate}>
          <div className="form-group">
            <label className="form-label">Select Trip to Settle *</label>
            <select
              className="form-control form-select"
              required
              value={selectedTripToSettle}
              onChange={(e) => setSelectedTripToSettle(e.target.value)}
            >
              <option value="">-- Choose a Trip --</option>
              {unsettledTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  Trip #{t.id} — {t.lorry_number} ({t.driver_name}) | {t.party_name} | {formatCurrency(t.total_freight)}
                </option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Settling this trip will automatically tally all recorded driver expenses, deduct the trip advance, and create an official verified settlement voucher.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsGenerateModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !selectedTripToSettle}>
              {isSubmitting ? 'Calculating...' : 'Generate Settlement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Driver Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Pay Driver Settlement"
        maxWidth="480px"
      >
        {payTarget && (
          <form onSubmit={handlePayDriver}>
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #86efac',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '13px', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>
                Settlement #{payTarget.id} — Trip #{payTarget.trip_id}
              </div>
              <div style={{ fontSize: '13px', color: '#374151' }}>
                <strong>{payTarget.driver_name}</strong> &nbsp;|&nbsp; {payTarget.lorry_number}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Balance to pay: <strong style={{ color: '#15803d', fontSize: '16px' }}>{formatCurrency(payTarget.balance_to_driver)}</strong>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '10px' }}>Payment Mode *</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPayMode(mode)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: payMode === mode ? '2px solid var(--primary-600, #2563eb)' : '2px solid #e5e7eb',
                      background: payMode === mode ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: payMode === mode ? 700 : 500,
                      fontSize: '13px',
                      color: payMode === mode ? '#1d4ed8' : '#374151',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode === 'CASH' && <Banknote size={22} color={payMode === 'CASH' ? '#15803d' : '#9ca3af'} />}
                    {mode === 'UPI' && <Smartphone size={22} color={payMode === 'UPI' ? '#7c3aed' : '#9ca3af'} />}
                    {mode === 'BANK_TRANSFER' && <IndianRupee size={22} color={payMode === 'BANK_TRANSFER' ? '#1e40af' : '#9ca3af'} />}
                    {mode === 'CASH' ? 'Cash' : mode === 'UPI' ? 'UPI' : 'Bank Transfer'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Amount to Pay (₹) *</label>
              <input
                type="number"
                className="form-control"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                min="0.01"
                step="0.01"
                required
                placeholder="Enter amount"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                className="form-control"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
              />
            </div>

            {(payMode === 'UPI' || payMode === 'BANK_TRANSFER') && (
              <div className="form-group">
                <label className="form-label">
                  {payMode === 'UPI' ? 'UPI Transaction ID / Reference (optional)' : 'Bank Reference No. (optional)'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder={payMode === 'UPI' ? 'e.g. 123456789012' : 'e.g. NEFT123456'}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                type="text"
                className="form-control"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g. Final settlement for trip"
              />
            </div>

            {payMode === 'CASH' && (
              <div style={{
                background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px',
                padding: '8px 12px', fontSize: '12px', color: '#166534', marginBottom: '14px',
              }}>
                <Banknote size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Cash payment — will be recorded and settlement marked as SETTLED.
              </div>
            )}
            {payMode === 'UPI' && (
              <div style={{
                background: '#faf5ff', border: '1px solid #c4b5fd', borderRadius: '6px',
                padding: '8px 12px', fontSize: '12px', color: '#6d28d9', marginBottom: '14px',
              }}>
                <Smartphone size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                UPI payment — enter the transaction reference ID for records.
              </div>
            )}

            {payError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
                padding: '10px 14px', color: '#b91c1c', fontSize: '13px', marginBottom: '12px',
              }}>
                {payError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={() => setIsPayModalOpen(false)} className="btn btn-outline">Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPaying}
                style={{ background: '#15803d', borderColor: '#15803d' }}
              >
                {isPaying ? 'Recording...' : `Pay via ${payMode === 'BANK_TRANSFER' ? 'Bank Transfer' : payMode}`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Driver Payment History"
        maxWidth="580px"
      >
        {payTarget && (
          <div>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px' }}>
              <strong>Settlement #{payTarget.id}</strong> — Trip #{payTarget.trip_id} &nbsp;|&nbsp;
              {payTarget.driver_name} &nbsp;|&nbsp; {payTarget.lorry_number}
            </div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading payments...</div>
            ) : paymentHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <Clock size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div>No payments recorded yet.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {paymentHistory.map((p) => (
                  <div key={p.id} style={{
                    border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#15803d' }}>{formatCurrency(p.amount)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {payModeIcon(p.payment_mode)}{p.payment_mode}
                        {p.reference_no && ` · Ref: ${p.reference_no}`}
                        {p.notes && ` · ${p.notes}`}
                      </div>
                      {p.created_by_name && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>By: {p.created_by_name}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDateDMY(p.payment_date)}
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                  <span>Total Paid:</span>
                  <span style={{ color: '#15803d' }}>{formatCurrency(paymentHistory.reduce((s, p) => s + parseFloat(String(p.amount)), 0))}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn btn-outline">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Official Settlement Slip Modal */}
      <Modal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        title="Trip Settlement Slip"
        maxWidth="680px"
      >
        {selectedSettlement && (
          <div>
            <div
              id="printable-settlement-slip"
              style={{
                border: '2px solid #0f172a',
                borderRadius: '4px',
                padding: '20px 24px',
                background: '#ffffff',
                color: '#0f172a',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {/* Header Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    KSP TRANSPORT
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '2px' }}>
                    Fleet Logistics &amp; Transport Contractors
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                    Head Office: Namakkal • Tamil Nadu<br />
                    Fleet Operations &amp; Freight Settlement Dept.<br />
                    Phone: +91 94432 00000 | Email: accounts@ksptransport.com
                  </div>
                </div>

                <div style={{
                  border: '1.5px solid #0f172a',
                  background: '#f8fafc',
                  padding: '8px 12px',
                  textAlign: 'right',
                  borderRadius: '4px',
                  minWidth: '220px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    TRIP SETTLEMENT CHALLAN
                  </div>
                  <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px', lineHeight: 1.5 }}>
                    <strong>Voucher #:</strong> SETTLE-{selectedSettlement.id}<br />
                    <strong>Trip Ref:</strong> #TRIP-{selectedSettlement.trip_id}<br />
                    <strong>Settlement Date:</strong> {selectedSettlement.payment_date ? formatDateDMY(selectedSettlement.payment_date) : (selectedSettlement.trip_date ? formatDateDMY(selectedSettlement.trip_date) : '—')}
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '3px',
                      marginTop: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: selectedSettlement.settlement_status === 'SETTLED' ? '#dcfce7' : '#fef3c7',
                      color: selectedSettlement.settlement_status === 'SETTLED' ? '#15803d' : '#b45309',
                      border: selectedSettlement.settlement_status === 'SETTLED' ? '1px solid #86efac' : '1px solid #fcd34d',
                    }}>
                      {selectedSettlement.settlement_status === 'SETTLED' ? '✔ SETTLED' : '⏳ PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Trip Particulars Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', width: '20%', border: '1px solid #cbd5e1' }}>
                      Lorry Number
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', width: '30%', border: '1px solid #cbd5e1' }}>
                      <span style={{ display: 'inline-block', background: '#f1f5f9', border: '1px solid #94a3b8', padding: '2px 8px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 900, letterSpacing: '1px' }}>
                        {selectedSettlement.lorry_number}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', width: '20%', border: '1px solid #cbd5e1' }}>
                      Party / Consignor
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', width: '30%', border: '1px solid #cbd5e1' }}>
                      {selectedSettlement.party_name}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                      Driver Name
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>
                      {selectedSettlement.driver_name}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                      Destination / Unit
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>
                      {selectedSettlement.to_location || selectedSettlement.from_location || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                      Trip Dispatch Date
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>
                      {selectedSettlement.trip_date ? formatDateDMY(selectedSettlement.trip_date) : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, background: '#f8fafc', color: '#475569', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                      Settlement Mode
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>
                      {selectedSettlement.payment_mode || (selectedSettlement.settlement_status === 'SETTLED' ? 'CASH' : 'PENDING')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Driver Expenses Breakdown Table */}
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.3px' }}>
                1. Driver Trip Expenses Breakdown
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: '40px', padding: '7px 8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', border: '1px solid #cbd5e1', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '7px 8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', border: '1px solid #cbd5e1', textAlign: 'left' }}>Expense Category</th>
                    <th style={{ padding: '7px 8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', border: '1px solid #cbd5e1', textAlign: 'left' }}>Description / Remarks</th>
                    <th style={{ width: '130px', padding: '7px 8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', border: '1px solid #cbd5e1', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSettlement.expense_items && selectedSettlement.expense_items.length > 0 ? (
                    selectedSettlement.expense_items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '11px' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '11.5px', color: '#0f172a' }}>{it.expense_type}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#475569' }}>{it.description || '—'}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '11.5px' }}>{formatCurrency(it.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '11px' }}>1</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '11.5px', color: '#0f172a' }}>Consolidated Driver Trip Expenses</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#475569' }}>Loading, Unloading, Bata, Toll &amp; misc expenses</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '11.5px' }}>{formatCurrency(selectedSettlement.total_expenses)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td colSpan={3} style={{ textAlign: 'right', padding: '7px 8px', fontSize: '11.5px', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>Total Trip Expenses:</td>
                    <td style={{ textAlign: 'right', padding: '7px 8px', fontSize: '12.5px', color: '#b45309', border: '1px solid #cbd5e1' }}>{formatCurrency(selectedSettlement.total_expenses)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Financial Calculation Statement */}
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.3px' }}>
                2. Final Settlement Account Statement
              </div>
              <div style={{ border: '1.5px solid #0f172a', background: '#fafafa', marginBottom: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>
                  <span>Total Gross Freight Billed:</span>
                  <strong>{formatCurrency(selectedSettlement.total_freight)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>
                  <span>Less: Total Driver Expenses Incurred:</span>
                  <strong style={{ color: '#b45309' }}>(-) {formatCurrency(selectedSettlement.total_expenses)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>
                  <span>Less: Trip Advance Already Paid to Driver:</span>
                  <strong style={{ color: '#475569' }}>(-) {formatCurrency(selectedSettlement.advance_paid)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', fontWeight: 900, fontSize: '14.5px', color: '#15803d', borderTop: '1.5px solid #0f172a' }}>
                  <span>NET BALANCE PAYABLE TO DRIVER:</span>
                  <span>{parseFloat(String(selectedSettlement.balance_to_driver || 0)) >= 0 ? '+' : ''}{formatCurrency(selectedSettlement.balance_to_driver)}</span>
                </div>
              </div>

              {/* Payment Info if SETTLED */}
              {selectedSettlement.settlement_status === 'SETTLED' && selectedSettlement.payment_mode && (
                <div style={{
                  border: '1.5px solid #16a34a',
                  background: '#f0fdf4',
                  borderRadius: '4px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '11.5px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  {selectedSettlement.payment_mode === 'CASH'
                    ? <Banknote size={24} color="#15803d" />
                    : selectedSettlement.payment_mode === 'UPI'
                    ? <Smartphone size={24} color="#7c3aed" />
                    : <IndianRupee size={24} color="#1e40af" />}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.5px' }}>
                      ✔ Official Disbursement Receipt
                    </div>
                    <div style={{ lineHeight: 1.5, marginTop: '2px' }}>
                      Paid Amount: <strong>{formatCurrency(selectedSettlement.paid_amount || selectedSettlement.balance_to_driver)}</strong> via <strong>{selectedSettlement.payment_mode}</strong>
                      {selectedSettlement.payment_date && ` · Paid on ${formatDateDMY(selectedSettlement.payment_date)}`}
                      {selectedSettlement.reference_no && ` · Ref/UTR: ${selectedSettlement.reference_no}`}
                      {selectedSettlement.settled_by_name && ` · Authorized by: ${selectedSettlement.settled_by_name}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Declaration */}
              <div style={{
                fontSize: '10px',
                color: '#64748b',
                lineHeight: 1.45,
                marginBottom: '20px',
                padding: '8px 10px',
                background: '#f8fafc',
                borderLeft: '3px solid #94a3b8',
                borderRadius: '2px',
              }}>
                <strong>Declaration &amp; Acknowledgment:</strong> Certified that all vehicle fuel, driver allowances, unloading/loading dues and miscellaneous expenses for Trip #{selectedSettlement.trip_id} have been verified against original vouchers and settled in full. The driver acknowledges receipt of the net amount without further claims.
              </div>

              {/* Signatures */}
              <table style={{ width: '100%', marginTop: '16px' }}>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'bottom', width: '50%' }}>
                      <div style={{ width: '200px', borderBottom: '1px solid #0f172a', marginBottom: '6px' }} />
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Driver's Signature</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Name: <strong>{selectedSettlement.driver_name}</strong></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Date: ____/____/2026</div>
                    </td>
                    <td style={{ verticalAlign: 'bottom', width: '50%', textAlign: 'right' }}>
                      <div style={{ width: '200px', borderBottom: '1px solid #0f172a', marginBottom: '6px', marginLeft: 'auto' }} />
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Authorized Signatory</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>For <strong>KSP TRANSPORT</strong></div>
                      <div style={{ display: 'inline-block', border: '1px dashed #94a3b8', padding: '4px 10px', fontSize: '9.5px', color: '#94a3b8', borderRadius: '4px', marginTop: '4px' }}>
                        [ OFFICIAL SEAL &amp; STAMP ]
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#94a3b8', marginTop: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Official Transport Settlement Voucher • KSP Fleet Management System • Triplicate Copy
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(selectedSettlement.settlement_status === 'PENDING' || selectedSettlement.settlement_status === 'VERIFIED') && (
                  <button
                    onClick={() => { setIsSlipModalOpen(false); openPayModal(selectedSettlement); }}
                    className="btn btn-primary"
                    style={{ background: '#15803d', borderColor: '#15803d' }}
                  >
                    <IndianRupee size={15} /> Pay Driver
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePrint}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={15} /> Print
                </button>
                <button
                  onClick={handleShare}
                  className="btn btn-outline"
                  disabled={isDownloading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Share2 size={15} /> Share
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="btn btn-outline"
                  disabled={isDownloading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={15} />
                  {isDownloading ? 'Please wait...' : 'Download'}
                </button>
                <button onClick={() => setIsSlipModalOpen(false)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Local Storage Excel Export History Modal ─── */}
      <Modal
        isOpen={isLocalStorageModalOpen}
        onClose={() => setIsLocalStorageModalOpen(false)}
        title="Local Storage – Excel Export History"
        maxWidth="800px"
      >
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            The last <strong>30 Excel exports</strong> are recorded automatically in your browser's local storage. These records persist across sessions.
          </p>

          {localExports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
              background: 'var(--bg-color, #f9fafb)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color, #e5e7eb)',
            }}>
              <Database size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ fontWeight: 600, fontSize: '14px' }}>No export history found.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Click <strong>"Download Excel"</strong> to export and record an entry here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {localExports.map((exp: any, idx: number) => (
                <div key={exp.id || idx} style={{
                  background: 'var(--bg-color, #f9fafb)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={16} color="#059669" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>{exp.filename}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{exp.saved_at}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
                    <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
                      {exp.record_count} records
                    </span>
                    {exp.filters_used?.status && exp.filters_used.status !== 'All' && (
                      <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '2px 8px' }}>
                        Status: {exp.filters_used.status}
                      </span>
                    )}
                    {exp.filters_used?.lorry && exp.filters_used.lorry !== 'All' && (
                      <span style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: '4px', padding: '2px 8px' }}>
                        Truck: {exp.filters_used.lorry}
                      </span>
                    )}
                    {exp.filters_used?.driver && exp.filters_used.driver !== 'All' && (
                      <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: '4px', padding: '2px 8px' }}>
                        Driver: {exp.filters_used.driver}
                      </span>
                    )}
                    {exp.filters_used?.party && exp.filters_used.party !== 'All' && (
                      <span style={{ background: '#d1fae5', color: '#064e3b', borderRadius: '4px', padding: '2px 8px' }}>
                        Party: {exp.filters_used.party}
                      </span>
                    )}
                    {exp.filters_used?.fromDate && exp.filters_used.fromDate !== 'All' && (
                      <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: '4px', padding: '2px 8px' }}>
                        {exp.filters_used.fromDate} → {exp.filters_used.toDate}
                      </span>
                    )}
                  </div>
                  {exp.totals && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Freight: <strong style={{ color: '#1f2937' }}>₹{Number(exp.totals.freight || 0).toLocaleString('en-IN')}</strong></span>
                      <span>Expenses: <strong style={{ color: '#1f2937' }}>₹{Number(exp.totals.expenses || 0).toLocaleString('en-IN')}</strong></span>
                      <span>Balance: <strong style={{ color: '#1f2937' }}>₹{Number(exp.totals.balance || 0).toLocaleString('en-IN')}</strong></span>
                      <span>Paid: <strong style={{ color: '#059669' }}>₹{Number(exp.totals.paid || 0).toLocaleString('en-IN')}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
            <button
              type="button"
              onClick={clearLocalStorageHistory}
              className="btn btn-danger"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              disabled={localExports.length === 0}
            >
              <Trash2 size={14} /> Clear History
            </button>
            <button
              type="button"
              onClick={() => setIsLocalStorageModalOpen(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
