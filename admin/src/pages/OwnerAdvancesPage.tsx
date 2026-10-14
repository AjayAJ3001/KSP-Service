import React, { useState, useEffect } from 'react';
import {
  HandCoins,
  Plus,
  Edit2,
  Trash2,
  Search,
  Calendar,
  UserCheck,
  Briefcase,
  Upload,
  Image as ImageIcon,
  Eye,
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Loader2,
  Receipt,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ownerAdvanceService, ownerService, userService } from '../services/adminService';
import { OwnerAdvance, Owner, User } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { formatIST } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

export const OwnerAdvancesPage: React.FC = () => {
  const [advances, setAdvances] = useState<OwnerAdvance[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<OwnerAdvance | null>(null);
  const [formData, setFormData] = useState({
    owner_id: '',
    manager_id: '',
    amount: '',
    advance_date: '',
    payment_mode: 'CASH',
    screenshot_url: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Screenshot Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadAdvances();
  }, [page, search, ownerFilter, managerFilter, paymentModeFilter, fromDate, toDate]);

  const loadLookups = async () => {
    try {
      const [oRes, uRes] = await Promise.all([
        ownerService.getOwners({ limit: 100 }),
        userService.getUsers({ limit: 100, status: 'ACTIVE' }),
      ]);
      setOwners(oRes.data.items);
      // Only show users with role MANAGER
      const managerUsers = uRes.data.items.filter((u) => u.role === 'MANAGER');
      setManagers(managerUsers);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const loadAdvances = async () => {
    try {
      setIsLoading(true);
      const res = await ownerAdvanceService.getOwnerAdvances({
        page,
        limit: 10,
        search: search || undefined,
        owner_id: ownerFilter ? parseInt(ownerFilter) : undefined,
        manager_id: managerFilter ? parseInt(managerFilter) : undefined,
        payment_mode: paymentModeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setAdvances(res.data.items);
      setTotal(res.data.total);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (err) {
      console.error('Failed to load owner advances', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, screenshot_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.owner_id || !formData.manager_id || !formData.amount) {
      setFormError('Owner, Manager (Received By), and Advance Amount are required.');
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid advance amount greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        owner_id: parseInt(formData.owner_id),
        manager_id: parseInt(formData.manager_id),
        amount: numAmount,
        advance_date: formData.advance_date ? new Date(formData.advance_date).toISOString() : new Date().toISOString(),
        payment_mode: formData.payment_mode || 'CASH',
        screenshot_url: formData.screenshot_url || undefined,
        notes: formData.notes?.trim() || undefined,
      };

      if (selectedAdvance) {
        await ownerAdvanceService.updateOwnerAdvance(selectedAdvance.id, payload);
      } else {
        await ownerAdvanceService.createOwnerAdvance(payload);
      }

      setIsModalOpen(false);
      setSelectedAdvance(null);
      resetForm();
      loadAdvances();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save owner advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: OwnerAdvance) => {
    if (!confirm(`Are you sure you want to delete advance record of ₹${item.amount} from ${item.owner_name}?`)) return;
    try {
      await ownerAdvanceService.deleteOwnerAdvance(item.id);
      loadAdvances();
    } catch (err: any) {
      alert(err.message || 'Failed to delete advance record.');
    }
  };

  const openCreateModal = () => {
    setSelectedAdvance(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: OwnerAdvance) => {
    setSelectedAdvance(item);
    setFormData({
      owner_id: String(item.owner_id),
      manager_id: String(item.manager_id),
      amount: String(item.amount),
      advance_date: item.advance_date,
      payment_mode: item.payment_mode || 'CASH',
      screenshot_url: item.screenshot_url || '',
      notes: item.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      owner_id: '',
      manager_id: '',
      amount: '',
      advance_date: '',
      payment_mode: 'CASH',
      screenshot_url: '',
      notes: '',
    });
    setFormError('');
  };

  const formatCurrency = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr?: string, createdAtStr?: string) => {
    if (!dateStr && !createdAtStr) return '—';
    // If dateStr is midnight (12:00 am) because date-only was stored, but createdAtStr has the real recorded timestamp
    const clean = String(dateStr || '').trim();
    const isMidnight =
      !clean ||
      clean.endsWith('T18:30:00.000Z') ||
      clean.endsWith('T00:00:00.000Z') ||
      clean.includes(' 00:00:00') ||
      clean.includes('T00:00:00');
    if (isMidnight && createdAtStr) {
      return formatIST(createdAtStr);
    }
    return formatIST(dateStr || createdAtStr);
  };

  const setQuickDate = (type: 'today' | 'week' | 'month' | 'clear') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (type === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
      setPage(1);
    } else if (type === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const monStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      setFromDate(monStr);
      setToDate(todayStr);
      setPage(1);
    } else if (type === 'month') {
      const firstDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setFromDate(firstDayStr);
      setToDate(todayStr);
      setPage(1);
    } else if (type === 'clear') {
      setFromDate('');
      setToDate('');
      setSearch('');
      setOwnerFilter('');
      setManagerFilter('');
      setPaymentModeFilter('');
      setPage(1);
    }
  };

  const fetchAllMatchingAdvances = async (): Promise<OwnerAdvance[]> => {
    try {
      const res = await ownerAdvanceService.getOwnerAdvances({
        page: 1,
        limit: Math.max(total, 5000) || 5000,
        search: search || undefined,
        owner_id: ownerFilter ? parseInt(ownerFilter) : undefined,
        manager_id: managerFilter ? parseInt(managerFilter) : undefined,
        payment_mode: paymentModeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      return res.data.items || [];
    } catch (e) {
      console.error('Failed to fetch all matching advances', e);
      return advances;
    }
  };

  const handleExportExcel = async () => {
    if (total === 0 && advances.length === 0) {
      alert('No owner advances found to export.');
      return;
    }

    try {
      setIsExportingExcel(true);
      const allItems = await fetchAllMatchingAdvances();
      if (allItems.length === 0) {
        alert('No advance records found for the selected filters.');
        return;
      }

      const exportRows = allItems.map((item, idx) => ({
        'S.No': idx + 1,
        'Date & Time': formatDateTime(item.advance_date, item.created_at),
        'Owner Name (Given By)': item.owner_name || 'N/A',
        'Received By (Manager)': item.manager_name || 'N/A',
        'Advance Amount (₹)': Number(item.amount) || 0,
        'Payment Mode': item.payment_mode || 'CASH',
        'Notes / Remarks': item.notes || '—',
      }));

      const sumAmount = allItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      // Blank separator and TOTAL SUMMARY row
      exportRows.push({
        'S.No': '' as any,
        'Date & Time': '',
        'Owner Name (Given By)': '',
        'Received By (Manager)': '',
        'Advance Amount (₹)': '' as any,
        'Payment Mode': '',
        'Notes / Remarks': '',
      });

      exportRows.push({
        'S.No': 'TOTAL' as any,
        'Date & Time': `Total: ${allItems.length} Advances`,
        'Owner Name (Given By)': '',
        'Received By (Manager)': '',
        'Advance Amount (₹)': sumAmount,
        'Payment Mode': '',
        'Notes / Remarks': '',
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 22 }, // Date & Time
        { wch: 26 }, // Owner Name
        { wch: 24 }, // Manager Name
        { wch: 20 }, // Advance Amount
        { wch: 22 }, // Payment Mode
        { wch: 35 }, // Notes
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Owner Advances');

      // Summary sheet
      const selectedOwnerName = ownerFilter ? owners.find((o) => String(o.id) === String(ownerFilter))?.name || 'Selected' : 'All Owners';
      const selectedManagerName = managerFilter ? managers.find((m) => String(m.id) === String(managerFilter))?.name || 'Selected' : 'All Managers';
      const summaryRows = [
        { 'Metric / Field': 'Report Name', 'Value': 'Owner Advances Audit Report' },
        { 'Metric / Field': 'Total Advance Transactions', 'Value': allItems.length },
        { 'Metric / Field': 'Total Advance Amount (₹)', 'Value': sumAmount },
        { 'Metric / Field': 'Average Advance per Entry (₹)', 'Value': allItems.length > 0 ? (sumAmount / allItems.length).toFixed(2) : 0 },
        { 'Metric / Field': 'Owner Filter', 'Value': selectedOwnerName },
        { 'Metric / Field': 'Manager Filter', 'Value': selectedManagerName },
        { 'Metric / Field': 'Payment Mode Filter', 'Value': paymentModeFilter || 'All Modes' },
        { 'Metric / Field': 'Date Range', 'Value': fromDate || toDate ? `${fromDate || 'Start'} to ${toDate || 'End'}` : 'All Dates' },
        { 'Metric / Field': 'Export Timestamp', 'Value': new Date().toLocaleString('en-IN') },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 32 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `KSP_Owner_Advances_${dateTag}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export owner advances to Excel', err);
      alert(err.message || 'Failed to export owner advances.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = async () => {
    if (total === 0 && advances.length === 0) {
      alert('No owner advances found to export.');
      return;
    }

    try {
      setIsExportingCSV(true);
      const allItems = await fetchAllMatchingAdvances();
      if (allItems.length === 0) {
        alert('No advance records found for the selected filters.');
        return;
      }

      const headers = ['S.No', 'Date & Time', 'Owner Name (Given By)', 'Received By (Manager)', 'Advance Amount (INR)', 'Payment Mode', 'Notes / Remarks'];
      const rows = allItems.map((item, idx) => [
        idx + 1,
        `"${formatDateTime(item.advance_date, item.created_at)}"`,
        `"${item.owner_name || ''}"`,
        `"${item.manager_name || ''}"`,
        Number(item.amount) || 0,
        `"${item.payment_mode || 'CASH'}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
      ]);

      const sumAmount = allItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['TOTAL', `"Total: ${allItems.length} Advances"`, '', '', sumAmount, '', '']);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `KSP_Owner_Advances_${dateTag}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to export CSV', err);
      alert('Failed to export CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handlePrintAdvances = async () => {
    if (total === 0 && advances.length === 0) {
      alert('No owner advances found to print.');
      return;
    }

    try {
      setIsPrinting(true);
      const allItems = await fetchAllMatchingAdvances();
      if (allItems.length === 0) {
        alert('No advance records found to print.');
        return;
      }

      const sumAmount = allItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const avgAmount = allItems.length > 0 ? sumAmount / allItems.length : 0;

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Logistics - Owner Advances Report</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 11.5px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .kpi-highlight .kpi-value { color: #15803d; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 7px 8px; font-size: 10.5px; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .footer-row td { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-align: center; background: #e0f2fe; color: #0369a1; }
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
      <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
      <div class="report-subtitle">OWNER ADVANCE DISBURSEMENTS &amp; RECEIPTS REPORT</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; font-size: 13px; color: #0f172a;">Total Advances: ${allItems.length}</div>
      <p class="meta-text" style="margin-top: 4px;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">S.No</th>
        <th style="width: 140px;">Date &amp; Time</th>
        <th>Owner Name (Given By)</th>
        <th>Received By (Manager)</th>
        <th class="num" style="width: 120px;">Amount (₹)</th>
        <th style="width: 120px;">Payment Mode</th>
        <th>Notes / Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${allItems.map((item, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${formatDateTime(item.advance_date, item.created_at)}</td>
          <td><strong>${item.owner_name || '-'}</strong></td>
          <td><span class="badge">${item.manager_name || '-'}</span></td>
          <td class="num"><strong style="color: #15803d;">₹${Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td>${item.payment_mode || 'CASH'}</td>
          <td>${item.notes || '-'}</td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td class="center">TOTAL</td>
        <td colspan="3"><strong>Total Records: ${allItems.length} Advances</strong></td>
        <td class="num"><strong>₹${sumAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP</span>
    <span>Owner Advances Audit Record</span>
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
      console.error('Failed to print owner advances', err);
      alert('Failed to generate print document.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintSingleAdvance = (item: OwnerAdvance) => {
    const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Advance Voucher - OA-${item.id}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
    @page { size: A5 landscape; margin: 8mm; }
    .voucher-box { border: 2px solid #0f172a; border-radius: 8px; padding: 18px; max-width: 750px; margin: 0 auto; }
    .voucher-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .company-name { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; }
    .voucher-title { font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-top: 2px; }
    .v-num { font-size: 14px; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; font-size: 12.5px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
    .info-label { color: #64748b; font-weight: 600; }
    .info-val { font-weight: 700; color: #0f172a; }
    .amount-highlight { background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .amt-label { font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; }
    .amt-val { font-size: 22px; font-weight: 900; color: #15803d; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 10px; }
    .sig-box { text-align: center; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 12px; font-weight: 700; color: #334155; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 14px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Voucher</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="voucher-box">
    <div class="voucher-header">
      <div>
        <h1 class="company-name">KSP TRANSPORT &amp; LOGISTICS</h1>
        <div class="voucher-title">OWNER ADVANCE RECEIPT VOUCHER</div>
      </div>
      <div style="text-align: right;">
        <span class="v-num">VOUCHER #OA-${item.id}</span>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Date: ${formatDateTime(item.advance_date, item.created_at)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-row">
          <span class="info-label">Given By (Owner):</span>
          <span class="info-val">${item.owner_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Mode:</span>
          <span class="info-val">${item.payment_mode || 'CASH'}</span>
        </div>
      </div>
      <div>
        <div class="info-row">
          <span class="info-label">Received By (Manager):</span>
          <span class="info-val">${item.manager_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Recorded Timestamp:</span>
          <span class="info-val">${formatDateTime(item.advance_date, item.created_at)}</span>
        </div>
      </div>
    </div>

    <div class="amount-highlight">
      <span class="amt-label">Advance Amount Received</span>
      <span class="amt-val">₹${Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>

    ${item.notes ? `
      <div style="margin-bottom: 16px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
        <strong style="color: #475569;">Notes / Remarks:</strong> ${item.notes}
      </div>
    ` : ''}

    <div class="sig-grid">
      <div class="sig-box">
        Given By Signature<br />
        <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${item.owner_name})</span>
      </div>
      <div class="sig-box">
        Received By Signature<br />
        <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${item.manager_name})</span>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      alert('Please allow popups to print voucher.');
      return;
    }
    printWin.document.open();
    printWin.document.write(printHtml);
    printWin.document.close();
  };

  const columns: Column<OwnerAdvance>[] = [
    {
      header: 'Date & Time',
      accessor: 'advance_date',
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>
          {formatDateTime(r.advance_date, r.created_at)}
        </span>
      ),
    },
    {
      header: 'Owner Name (Given By)',
      accessor: 'owner_name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#e0e7ff',
              color: '#3730a3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
            }}
          >
            {r.owner_name ? r.owner_name.charAt(0).toUpperCase() : 'O'}
          </div>
          <strong style={{ color: 'var(--primary-900)' }}>{r.owner_name}</strong>
        </div>
      ),
    },
    {
      header: 'Received By (Manager)',
      accessor: 'manager_name',
      render: (r) => (
        <span
          style={{
            fontWeight: 600,
            color: '#0369a1',
            background: '#f0f9ff',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          {r.manager_name}
        </span>
      ),
    },
    {
      header: 'Advance Amount',
      accessor: 'amount',
      render: (r) => (
        <strong style={{ color: '#16a34a', fontSize: '15px', fontWeight: 800 }}>
          {formatCurrency(r.amount)}
        </strong>
      ),
    },
    {
      header: 'Payment Mode',
      accessor: 'payment_mode',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#475569',
              background: '#f1f5f9',
              padding: '3px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          >
            {r.payment_mode || 'CASH'}
          </span>
          {r.screenshot_url && (
            <button
              onClick={() => setPreviewImage(r.screenshot_url || null)}
              className="btn btn-outline btn-sm"
              style={{ padding: '2px 6px', fontSize: '11px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="View UPI / Payment Screenshot"
            >
              <Eye size={12} /> View Screenshot
            </button>
          )}
        </div>
      ),
    },
    {
      header: 'Notes / Remarks',
      accessor: (r) => r.notes || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>,
    },
    {
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => handlePrintSingleAdvance(r)}
            className="btn btn-outline btn-sm"
            style={{ padding: '4px 8px', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
            title="Print Advance Voucher"
          >
            <Receipt size={14} />
          </button>
          <button onClick={() => openEditModal(r)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="btn btn-danger btn-sm"
            title="Delete Record"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        className="card-header"
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <HandCoins size={24} color="var(--accent)" />
              Owner Advances Management
            </h2>
            <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> Record Owner Advance
            </button>
            <Link
              to="/manager-advances"
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <BookOpen size={16} /> Manager Advance Balances
            </Link>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px', marginBottom: 0 }}>
            Record cash & UPI advances given by owners and received by managers with automatic date & time tracking
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px 20px', borderRadius: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <div className="search-input-wrapper" style={{ flex: '1', minWidth: '200px' }}>
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by owner, manager or notes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select
              className="form-control form-select"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%' }}
            >
              <option value="">All Owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '170px' }}>
            <select
              className="form-control form-select"
              value={managerFilter}
              onChange={(e) => {
                setManagerFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%' }}
            >
              <option value="">All Managers</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '180px' }}>
            <select
              className="form-control form-select"
              value={paymentModeFilter}
              onChange={(e) => {
                setPaymentModeFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%' }}
            >
              <option value="">All Payment Modes</option>
              <option value="CASH">CASH</option>
              <option value="UPI / GPAY / PHONEPE">UPI / GPAY / PHONEPE</option>
              <option value="BANK TRANSFER (NEFT/RTGS)">BANK TRANSFER (NEFT/RTGS)</option>
            </select>
          </div>
        </div>

        {/* Second Row: Date Controls, Reset and Print/Download Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>From:</span>
            <DateField
              style={{ width: '155px' }}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>To:</span>
            <DateField
              style={{ width: '155px' }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 14px', fontSize: '12.5px' }}
            onClick={() => setQuickDate('clear')}
            title="Reset all filters"
          >
            <RotateCcw size={14} /> Reset
          </button>

          {/* Print & Download Options Toolbar right near Date & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrintAdvances}
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
              title="Direct print owner advances audit report"
            >
              {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print
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
              title="Download advances as an Excel spreadsheet with total summary"
            >
              {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Excel
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '38px',
                padding: '0 10px',
                fontSize: '12.5px',
              }}
              title="Download advances as CSV"
            >
              {isExportingCSV ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={advances}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          emptyMessage="No owner advances recorded yet. Click 'Record Owner Advance' to add one."
          footer={
            advances.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>TOTAL</td>
                <td style={{ fontWeight: 700 }}>Total: {total} Advances</td>
                <td></td>
                <td></td>
                <td style={{ color: '#16a34a', fontSize: '15px', fontWeight: 800 }}>
                  {formatCurrency(totalAmount)}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '12px' }}>
                  Avg: {total > 0 ? formatCurrency(totalAmount / total) : '₹0.00'}
                </td>
                <td></td>
                <td></td>
              </tr>
            ) : undefined
          }
        />
      </div>

      {/* Add / Edit Advance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedAdvance ? 'Edit Owner Advance' : 'Record New Owner Advance'}
        maxWidth="550px"
      >
        {formError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {formError}
          </div>
        )}

        {/* Automatic Timestamp Info Banner */}
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#15803d',
            fontSize: '13px',
          }}
        >
          <Calendar size={18} color="#16a34a" />
          <div>
            <strong>Date & Time: </strong>
            {selectedAdvance
              ? formatDateTime(selectedAdvance.advance_date, selectedAdvance.created_at)
              : 'Automatically recorded at current time on save'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Select Owner */}
          <div className="form-group">
            <label className="form-label">
              Select Owner (Given By) *
            </label>
            <select
              className="form-control form-select"
              required
              value={formData.owner_id}
              onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
            >
              <option value="">-- Choose Owner --</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.mobile_number ? `(${o.mobile_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Select Manager */}
          <div className="form-group">
            <label className="form-label">
              Select Manager (Received By) *
            </label>
            <select
              className="form-control form-select"
              required
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
            >
              <option value="">-- Choose Manager --</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advance Amount & Payment Mode */}
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Advance Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                className="form-control"
                placeholder="e.g. 50000.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control form-select"
                value={formData.payment_mode}
                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
              >
                <option value="CASH">CASH</option>
                <option value="UPI / GPAY / PHONEPE">UPI / GPAY / PHONEPE</option>
                <option value="BANK TRANSFER (NEFT/RTGS)">BANK TRANSFER (NEFT/RTGS)</option>
              </select>
            </div>
          </div>

          {/* Optional UPI Payment Screenshot Upload */}
          {(formData.payment_mode === 'UPI / GPAY / PHONEPE' ||
            formData.payment_mode === 'BANK TRANSFER (NEFT/RTGS)') && (
            <div
              className="form-group"
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                padding: '14px',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#0369a1',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}
              >
                <Upload size={16} /> Upload Payment Screenshot (Optional)
              </label>

              {formData.screenshot_url ? (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '6px' }}>
                  <img
                    src={formData.screenshot_url}
                    alt="Payment Screenshot Preview"
                    style={{
                      width: '120px',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid #0284c7',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, screenshot_url: '' })}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                    title="Remove Screenshot"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="upiScreenshotInput"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="upiScreenshotInput"
                    className="btn btn-outline btn-sm"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ImageIcon size={16} /> Choose Screenshot / Receipt
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>
                    JPG, PNG or WEBP (Max 5MB)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes / Remarks */}
          <div className="form-group">
            <label className="form-label">Notes / Remarks (Optional)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Advance for fuel, trip expenses, maintenance funds, transaction ID..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : selectedAdvance ? 'Update Advance' : 'Save Advance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Screenshot Full Preview Modal */}
      {previewImage && (
        <Modal
          isOpen={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          title="Payment Screenshot"
          maxWidth="650px"
        >
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <img
              src={previewImage}
              alt="Full Payment Screenshot"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            />
            <div style={{ marginTop: '16px' }}>
              <button onClick={() => setPreviewImage(null)} className="btn btn-primary">
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
