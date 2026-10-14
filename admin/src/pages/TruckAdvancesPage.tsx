import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  Printer,
  Loader2,
  RefreshCw,
  UserCheck,
  Building2,
  Scale,
  Navigation,
  FileText,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { truckAdvanceService, vehicleService, driverService, userService, partyService, tripService } from '../services/adminService';
import { Vehicle, Driver, User, Party, Trip } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { DateField } from '../components/Common/DateField';
import { formatIST } from '../utils/dateUtils';

interface TruckAdvance {
  id: number;
  vehicle_id: number;
  driver_id?: number;
  trip_id?: number;
  manager_id: number;
  amount: number;
  advance_date: string;
  notes?: string;
  lorry_number: string;
  vehicle_type?: string;
  driver_name?: string;
  driver_mobile?: string;
  party_id?: number;
  party_name?: string;
  goods_weight?: number | string;
  total_freight?: number | string;
  freight_rate?: number | string;
  driver_expenses?: number | string;
  trip_status?: string;
  unit_name?: string;
  unit_abbreviation?: string;
  trip_date?: string;
  from_location?: string;
  to_location?: string;
  manager_name: string;
  created_by_name?: string;
  created_at: string;
}

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat(String(val || 0)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Smart IST date/time formatter.
 * If advance_date was recorded as midnight (from a date-only entry or trip_date),
 * fallback to created_at so accurate timestamp is displayed instead of "12:00 am".
 */
const formatAdvanceDateTime = (dateStr?: string | Date | null, createdAtStr?: string | Date | null): string => {
  if (!dateStr && !createdAtStr) return '—';
  const clean = String(dateStr || '').trim();
  const isMidnight =
    !clean ||
    clean.endsWith('T18:30:00.000Z') ||
    clean.endsWith('T00:00:00.000Z') ||
    clean.includes(' 00:00:00') ||
    clean.includes('T00:00:00') ||
    /^\d{4}-\d{2}-\d{2}$/.test(clean);
  if (isMidnight && createdAtStr) {
    return formatIST(createdAtStr);
  }
  return formatIST(dateStr || createdAtStr);
};

export const TruckAdvancesPage: React.FC = () => {
  const [advances, setAdvances] = useState<TruckAdvance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    trip_id: '',
    manager_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadLookups(); }, []);

  useEffect(() => {
    loadAdvances();
  }, [page, search, vehicleFilter, driverFilter, partyFilter, managerFilter, fromDate, toDate]);

  const loadLookups = async () => {
    try {
      const [vRes, dRes, uRes, pRes, trRes] = await Promise.all([
        vehicleService.getVehicles({ limit: 500, status: 'ACTIVE' }),
        driverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        userService.getUsers({ limit: 200, status: 'ACTIVE' }),
        partyService.getParties({ limit: 500, status: 'ACTIVE' }),
        tripService.getTrips({ limit: 100 }),
      ]);
      setVehicles(vRes.data.items || []);
      setDrivers(dRes.data.items || []);
      setManagers(uRes.data.items || []);
      setParties(pRes.data.items || []);
      setAvailableTrips(trRes.data.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const loadAdvances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await truckAdvanceService.getTruckAdvances({
        page,
        limit: 10,
        search: search || undefined,
        vehicle_id: vehicleFilter || undefined,
        driver_id: driverFilter || undefined,
        party_id: partyFilter || undefined,
        manager_id: managerFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setAdvances(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (err) {
      console.error('Failed to load truck advances', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, vehicleFilter, driverFilter, partyFilter, managerFilter, fromDate, toDate]);

  const handleSubmit = async () => {
    if (!formData.vehicle_id) { setFormError('Please select a vehicle.'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { setFormError('Please enter a valid amount.'); return; }
    setFormError('');
    try {
      setIsSubmitting(true);
      await truckAdvanceService.createTruckAdvance({
        vehicle_id: parseInt(formData.vehicle_id),
        driver_id: formData.driver_id ? parseInt(formData.driver_id) : undefined,
        trip_id: formData.trip_id ? parseInt(formData.trip_id) : undefined,
        manager_id: formData.manager_id ? parseInt(formData.manager_id) : undefined,
        amount: parseFloat(formData.amount),
        advance_date: formData.advance_date || undefined,
        notes: formData.notes.trim() || undefined,
      });
      setIsModalOpen(false);
      setFormData({
        vehicle_id: '',
        driver_id: '',
        trip_id: '',
        manager_id: '',
        amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      loadAdvances();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to create advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this truck advance record?')) return;
    try {
      await truckAdvanceService.deleteTruckAdvance(id);
      loadAdvances();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete.');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setVehicleFilter('');
    setDriverFilter('');
    setPartyFilter('');
    setManagerFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  // ── Single Trip Download (Excel) ─────────────────────────────────
  const handleDownloadSingleExcel = (a: TruckAdvance) => {
    try {
      const advAmount = parseFloat(String(a.amount || 0));
      const expAmount = parseFloat(String(a.driver_expenses || 0));
      const balanceWithDriver = advAmount - expAmount;

      const rows: any[] = [
        { 'Detail': 'VOUCHER / RECORD ID', 'Information': `TRUCK-ADV-#${a.id}` },
        { 'Detail': 'TRIP ID', 'Information': a.trip_id ? `TRIP #${a.trip_id}` : 'Direct Advance (No Trip)' },
        { 'Detail': 'DATE & TIME (IST)', 'Information': formatAdvanceDateTime(a.advance_date, a.created_at) },
        { 'Detail': 'LORRY NUMBER', 'Information': a.lorry_number },
        { 'Detail': 'VEHICLE TYPE', 'Information': a.vehicle_type || '—' },
        { 'Detail': 'DRIVER NAME', 'Information': a.driver_name || '—' },
        { 'Detail': 'DRIVER MOBILE', 'Information': a.driver_mobile || '—' },
        { 'Detail': 'PARTY NAME', 'Information': a.party_name || '—' },
        { 'Detail': 'ROUTE / DESTINATION', 'Information': a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : (a.to_location || a.from_location || '—') },
        { 'Detail': 'GOODS WEIGHT', 'Information': a.goods_weight ? `${a.goods_weight} ${a.unit_abbreviation || 'MT'}` : '—' },
        { 'Detail': 'TOTAL FREIGHT AMOUNT (₹)', 'Information': a.total_freight ? parseFloat(String(a.total_freight)) : 0 },
        { 'Detail': 'ADVANCE AMOUNT PAID (₹)', 'Information': advAmount },
        { 'Detail': 'DRIVER EXPENSES INCURRED (₹)', 'Information': expAmount },
        { 'Detail': 'ADVANCE BALANCE HELD BY DRIVER (₹)', 'Information': balanceWithDriver },
        { 'Detail': 'DISBURSING MANAGER', 'Information': a.manager_name },
        { 'Detail': 'NOTES / REMARKS', 'Information': a.notes || '—' },
        { 'Detail': 'RECORD CREATED AT', 'Information': formatIST(a.created_at) },
      ];

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 36 }, { wch: 42 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Advance_Trip_${a.trip_id || a.id}`);

      const filename = a.trip_id
        ? `KSP_Advance_Trip_${a.trip_id}_${a.lorry_number.replace(/\s+/g, '_')}.xlsx`
        : `KSP_Advance_Truck_${a.id}_${a.lorry_number.replace(/\s+/g, '_')}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to download Excel voucher.');
    }
  };

  // ── Single Trip Voucher Print / Save PDF ──────────────────────────
  const handlePrintSingleAdvance = (a: TruckAdvance) => {
    try {
      const advAmount = parseFloat(String(a.amount || 0));
      const expAmount = parseFloat(String(a.driver_expenses || 0));
      const remainingAdvance = advAmount - expAmount;

      const singleHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>KSP Truck Advance Voucher #${a.id} - ${a.lorry_number}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:24px;color:#1e293b;background:#fff;font-size:12px}
        @page{size:portrait;margin:12mm}
        .voucher-box{border:2px solid #0f172a;border-radius:8px;padding:22px;max-width:800px;margin:0 auto}
        .v-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
        .v-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 2px}
        .v-subtitle{font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;margin:0;letter-spacing:.5px}
        .badge-box{text-align:right}
        .tag-v{background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-weight:800;font-size:13px;border:1px solid #bfdbfe;display:inline-block}
        .tag-t{margin-top:4px;font-weight:700;color:#4338ca;font-size:12px}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
        .card-b{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
        .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:2px}
        .val{font-size:15px;font-weight:800;color:#0f172a}
        table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}
        th,td{padding:7px 10px;border:1px solid #cbd5e1}
        th{background:#0f172a;color:#fff;font-weight:700;text-align:left}
        .num{text-align:right}
        .sig-row{display:flex;justify-content:space-between;margin-top:45px;padding-top:10px}
        .sig-line{text-align:center;width:170px}
        .sig-box{border-top:1px solid #64748b;padding-top:4px;font-size:11px;font-weight:700;color:#475569}
        .pbar{display:flex;justify-content:flex-end;gap:10px;max-width:800px;margin:0 auto 16px auto}
        .btn-p{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
        @media print{.pbar{display:none!important};body{padding:0}}
      </style></head><body>
      <div class="pbar">
        <button class="btn-p" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-p" style="background:#64748b" onclick="window.close()">Close</button>
      </div>
      <div class="voucher-box">
        <div class="v-header">
          <div>
            <h1 class="v-title">KSP TRANSPORT &amp; LOGISTICS</h1>
            <div class="v-subtitle">Truck Advance Disbursement &amp; Trip Voucher</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">KSP Service Management ERP</div>
          </div>
          <div class="badge-box">
            <div class="tag-v">VOUCHER #${a.id}</div>
            ${a.trip_id ? `<div class="tag-t">TRIP #${a.trip_id}</div>` : '<div class="tag-t" style="color:#64748b">DIRECT ADVANCE</div>'}
          </div>
        </div>

        <div class="grid-2">
          <div class="card-b">
            <div class="lbl">Vehicle / Lorry Number</div>
            <div class="val">${a.lorry_number}</div>
            <div style="font-size:11px;color:#64748b">${a.vehicle_type || 'Commercial Carrier'}</div>
            <div class="lbl" style="margin-top:8px">Assigned Driver</div>
            <div style="font-weight:700;color:#1e293b;font-size:13px">${a.driver_name || '—'}</div>
            <div style="font-size:11px;color:#64748b">${a.driver_mobile || ''}</div>
          </div>
          <div class="card-b">
            <div class="lbl">Disbursement Date &amp; Time (IST)</div>
            <div class="val" style="font-size:14px">${formatAdvanceDateTime(a.advance_date, a.created_at)}</div>
            <div style="font-size:11px;color:#64748b">Created: ${formatIST(a.created_at)}</div>
            <div class="lbl" style="margin-top:8px">Disbursing Manager</div>
            <div style="font-weight:700;color:#1e293b;font-size:13px">${a.manager_name}</div>
          </div>
        </div>

        ${a.trip_id ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Trip Freight &amp; Driver Expense Summary</div>
          <table>
            <thead><tr>
              <th>Description / Item</th>
              <th style="width:220px" class="num">Amount / Value</th>
            </tr></thead>
            <tbody>
              <tr><td><strong>Party Name (Consignor/Consignee)</strong></td><td class="num"><strong>${a.party_name || '—'}</strong></td></tr>
              <tr><td>Route / Destination</td><td class="num">${a.from_location && a.to_location ? `${a.from_location} → ${a.to_location}` : (a.to_location || a.from_location || '—')}</td></tr>
              <tr><td>Goods Weight / Quantity</td><td class="num" style="color:#047857;font-weight:700">${a.goods_weight ? `${a.goods_weight} ${a.unit_abbreviation || 'MT'}` : '—'}</td></tr>
              <tr style="background:#eff6ff">
                <td><strong style="color:#1d4ed8">Total Freight Amount</strong></td>
                <td class="num"><strong style="color:#1d4ed8;font-size:13px">₹${parseFloat(String(a.total_freight || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
              <tr style="background:#f0fdf4">
                <td><strong style="color:#16a34a">Advance Paid to Driver</strong></td>
                <td class="num"><strong style="color:#16a34a;font-size:13px">₹${advAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
              <tr style="background:#fffbeb">
                <td><strong style="color:#b45309">Driver Expenses Incurred on Trip</strong></td>
                <td class="num"><strong style="color:#b45309;font-size:13px">₹${expAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
              <tr style="background:#f8fafc;border-top:2px solid #0f172a">
                <td><strong>Advance Balance Held in Hand by Driver</strong></td>
                <td class="num"><strong>₹${remainingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase">Advance Amount Disbursed</div>
            <div style="font-size:12px;color:#64748b">Direct Truck Advance without trip assignment</div>
          </div>
          <div style="font-size:20px;font-weight:800;color:#1d4ed8">₹${advAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        `}

        ${a.notes ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">Notes / Remarks:</div>
          <div style="font-size:11.5px;color:#334155;margin-top:2px">${a.notes}</div>
        </div>
        ` : ''}

        <div class="sig-row">
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Driver's Signature</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Manager (${a.manager_name})</div>
          </div>
          <div class="sig-line">
            <div style="height:32px"></div>
            <div class="sig-box">Authorized Signatory</div>
          </div>
        </div>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=880,height=850');
      if (!win) { alert('Allow popups to print voucher.'); return; }
      win.document.open(); win.document.write(singleHtml); win.document.close();
    } catch (err: any) {
      alert(err.message || 'Failed to print advance voucher.');
    }
  };

  // ── Export CSV ──────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      const res = await truckAdvanceService.getTruckAdvances({
        page: 1, limit: 5000,
        search: search || undefined, vehicle_id: vehicleFilter || undefined,
        driver_id: driverFilter || undefined, party_id: partyFilter || undefined,
        manager_id: managerFilter || undefined,
        from_date: fromDate || undefined, to_date: toDate || undefined,
      });
      const items: TruckAdvance[] = res.data.items || [];
      const headers = [
        'S.No', 'Date & Time', 'Lorry Number', 'Trip ID', 'Party Name',
        'Goods Weight', 'Total Freight (INR)', 'Advance Paid (INR)', 'Driver Expenses (INR)',
        'Driver', 'Driver Mobile', 'Manager', 'Notes'
      ];
      const rows = items.map((a, i) => [
        i + 1,
        formatAdvanceDateTime(a.advance_date, a.created_at),
        a.lorry_number,
        a.trip_id ? `#${a.trip_id}` : '-',
        a.party_name || '-',
        a.goods_weight ? `${a.goods_weight} ${a.unit_abbreviation || 'MT'}` : '-',
        a.total_freight ? parseFloat(String(a.total_freight)).toFixed(2) : '0.00',
        parseFloat(String(a.amount)).toFixed(2),
        a.driver_expenses ? parseFloat(String(a.driver_expenses)).toFixed(2) : '0.00',
        a.driver_name || '-',
        a.driver_mobile || '-',
        a.manager_name,
        a.notes || '',
      ]);
      const totalAdv = items.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
      const totalFr = items.reduce((s, a) => s + (parseFloat(String(a.total_freight)) || 0), 0);
      const totalExp = items.reduce((s, a) => s + (parseFloat(String(a.driver_expenses)) || 0), 0);
      rows.push([]);
      rows.push(['TOTAL', `${items.length} Advances`, '', '', '', '', totalFr.toFixed(2), totalAdv.toFixed(2), totalExp.toFixed(2), '', '', '', '']);
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `KSP_Truck_Advances_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to export CSV.'); }
    finally { setIsExportingCSV(false); }
  };

  // ── Export Excel ─────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const res = await truckAdvanceService.getTruckAdvances({
        page: 1, limit: 5000,
        search: search || undefined, vehicle_id: vehicleFilter || undefined,
        driver_id: driverFilter || undefined, party_id: partyFilter || undefined,
        manager_id: managerFilter || undefined,
        from_date: fromDate || undefined, to_date: toDate || undefined,
      });
      const items: TruckAdvance[] = res.data.items || [];
      const totalAdv = items.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
      const totalFr = items.reduce((s, a) => s + (parseFloat(String(a.total_freight)) || 0), 0);
      const totalExp = items.reduce((s, a) => s + (parseFloat(String(a.driver_expenses)) || 0), 0);

      const rows: any[] = items.map((a, i) => ({
        'S.No': i + 1,
        'Date & Time': formatAdvanceDateTime(a.advance_date, a.created_at),
        'Lorry Number': a.lorry_number,
        'Vehicle Type': a.vehicle_type || '',
        'Trip ID': a.trip_id ? `Trip #${a.trip_id}` : '-',
        'Party Name': a.party_name || '-',
        'Goods Weight': a.goods_weight ? `${a.goods_weight} ${a.unit_abbreviation || 'MT'}` : '-',
        'Total Freight (₹)': a.total_freight ? parseFloat(String(a.total_freight)) : 0,
        'Advance Paid (₹)': parseFloat(String(a.amount)) || 0,
        'Driver Expenses (₹)': a.driver_expenses ? parseFloat(String(a.driver_expenses)) : 0,
        'Driver Name': a.driver_name || '-',
        'Driver Mobile': a.driver_mobile || '-',
        'Manager': a.manager_name,
        'Notes': a.notes || '',
        'Created At': formatIST(a.created_at),
      }));
      rows.push({});
      rows.push({
        'S.No': 'TOTAL',
        'Date & Time': `${items.length} Advances`,
        'Lorry Number': '',
        'Vehicle Type': '',
        'Trip ID': '',
        'Party Name': '',
        'Goods Weight': '',
        'Total Freight (₹)': totalFr,
        'Advance Paid (₹)': totalAdv,
        'Driver Expenses (₹)': totalExp,
        'Driver Name': '',
        'Driver Mobile': '',
        'Manager': '',
        'Notes': '',
        'Created At': '',
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 22 }, // Date & Time
        { wch: 14 }, // Lorry Number
        { wch: 14 }, // Vehicle Type
        { wch: 12 }, // Trip ID
        { wch: 24 }, // Party Name
        { wch: 16 }, // Goods Weight
        { wch: 18 }, // Total Freight
        { wch: 16 }, // Advance Paid
        { wch: 18 }, // Driver Expenses
        { wch: 20 }, // Driver Name
        { wch: 14 }, // Driver Mobile
        { wch: 18 }, // Manager
        { wch: 26 }, // Notes
        { wch: 20 }, // Created At
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Truck Advances');
      XLSX.writeFile(wb, `KSP_Truck_Advances_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { alert('Failed to export Excel.'); }
    finally { setIsExportingExcel(false); }
  };

  // ── Main Print ───────────────────────────────────────────────────
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const res = await truckAdvanceService.getTruckAdvances({
        page: 1, limit: 5000,
        search: search || undefined, vehicle_id: vehicleFilter || undefined,
        driver_id: driverFilter || undefined, party_id: partyFilter || undefined,
        manager_id: managerFilter || undefined,
        from_date: fromDate || undefined, to_date: toDate || undefined,
      });
      const items: TruckAdvance[] = res.data.items || [];
      if (items.length === 0) { alert('No records to print.'); return; }
      const totalAdv = items.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
      const totalFr = items.reduce((s, a) => s + (parseFloat(String(a.total_freight)) || 0), 0);
      const totalExp = items.reduce((s, a) => s + (parseFloat(String(a.driver_expenses)) || 0), 0);
      const selectedPartyName = partyFilter ? parties.find(p => String(p.id) === String(partyFilter))?.name : 'All Parties';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KSP Truck Advances</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11px}
        @page{size:landscape;margin:10mm}
        .header-bar{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0f172a;margin-bottom:14px}
        .company-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px}
        .report-subtitle{font-size:13px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase;letter-spacing:.5px}
        .meta-text{font-size:11px;color:#64748b;margin:0}.kpi-blue .kpi-value{color:#1d4ed8}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-top:10px}
        th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10px}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
        tr:nth-child(even) td{background:#fbfcfe}
        .footer-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #0f172a;color:#0f172a}
        .num{text-align:right}
        .print-bar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
        .pbtn{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
        @media print{.print-bar{display:none!important};body{padding:0}}
      </style></head><body>
      <div class="print-bar">
        <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
        <button class="pbtn" style="background:#64748b" onclick="window.close()">Close</button>
      </div>
      <div class="header-bar">
        <div>
          <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
          <div class="report-subtitle">Truck Advance Disbursements &amp; Trip Freight Record</div>
          <p class="meta-text" style="margin-top:4px">
            <strong>Filters:</strong> Party: ${selectedPartyName} | Date: ${fromDate || toDate ? `${fromDate || 'Start'} to ${toDate || 'End'}` : 'All Dates'}
          </p>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;font-size:13px;color:#0f172a">Total Records: ${items.length}</div>
          <p class="meta-text" style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px;text-align:center">S.No</th>
          <th style="width:110px">Date &amp; Time</th>
          <th style="width:85px">Lorry No</th>
          <th style="width:50px;text-align:center">Trip</th>
          <th>Party Name</th>
          <th style="width:70px">Weight</th>
          <th class="num" style="width:85px">Freight (₹)</th>
          <th class="num" style="width:85px">Advance (₹)</th>
          <th class="num" style="width:85px">Expenses (₹)</th>
          <th>Driver</th>
          <th>Manager</th>
        </tr></thead>
        <tbody>
          ${items.map((a, i) => `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td>${formatAdvanceDateTime(a.advance_date, a.created_at)}</td>
            <td><strong>${a.lorry_number}</strong></td>
            <td style="text-align:center">${a.trip_id ? `<span style="font-weight:700;color:#2563eb">#${a.trip_id}</span>` : '—'}</td>
            <td><strong>${a.party_name || '—'}</strong></td>
            <td>${a.goods_weight ? `${a.goods_weight} ${a.unit_abbreviation || 'MT'}` : '—'}</td>
            <td class="num" style="color:#1d4ed8;font-weight:700">₹${(parseFloat(String(a.total_freight || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="num" style="color:#16a34a;font-weight:700">₹${(parseFloat(String(a.amount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="num" style="color:#b45309;font-weight:700">₹${(parseFloat(String(a.driver_expenses || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>${a.driver_name || '-'}</td>
            <td>${a.manager_name}</td>
          </tr>`).join('')}
          <tr class="footer-row">
            <td style="text-align:center">TOTAL</td>
            <td colspan="5"><strong>Total Count: ${items.length} Advances</strong></td>
            <td class="num"><strong>₹${totalFr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td class="num"><strong>₹${totalAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td class="num"><strong>₹${totalExp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px">
        <span>KSP Service Management ERP</span>
        <span>Truck Advance Disbursement Record with Trip, Freight &amp; Driver Expenses</span>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=1100,height=850');
      if (!win) { alert('Allow popups to print.'); return; }
      win.document.open(); win.document.write(html); win.document.close();
    } catch (err) { alert('Failed to generate print document.'); }
    finally { setIsPrinting(false); }
  };

  const pageTotalAmount = advances.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
  const pageTotalFreight = advances.reduce((s, a) => s + (parseFloat(String(a.total_freight)) || 0), 0);
  const pageTotalExpenses = advances.reduce((s, a) => s + (parseFloat(String(a.driver_expenses)) || 0), 0);

  const columns: Column<TruckAdvance>[] = [
    {
      header: 'Date & Time',
      render: (a) => (
        <span style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
          {formatAdvanceDateTime(a.advance_date, a.created_at)}
        </span>
      ),
    },
    {
      header: 'Lorry Number',
      render: (a) => (
        <div>
          <span style={{ fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Truck size={12} /> {a.lorry_number}
          </span>
          {a.trip_id && (
            <div style={{ marginTop: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px' }}>
                Trip #{a.trip_id}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Driver',
      render: (a) => a.driver_name ? (
        <div>
          <div style={{ fontWeight: 600 }}>{a.driver_name}</div>
          {a.driver_mobile && <div style={{ fontSize: '11px', color: '#64748b' }}>{a.driver_mobile}</div>}
        </div>
      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>— Not assigned —</span>,
    },
    {
      header: 'Party',
      render: (a) => a.party_name ? (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{a.party_name}</span>
        </div>
      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>— Direct Advance —</span>,
    },
    {
      header: 'Weight',
      render: (a) => a.goods_weight ? (
        <span style={{ fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
          {parseFloat(String(a.goods_weight)).toLocaleString('en-IN')} {a.unit_abbreviation || a.unit_name || 'MT'}
        </span>
      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>,
    },
    {
      header: 'Freight Total',
      render: (a) => a.total_freight ? (
        <strong style={{ color: '#1d4ed8', fontSize: '13.5px' }}>{formatCurrency(a.total_freight)}</strong>
      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>,
    },
    {
      header: 'Advance Paid',
      render: (a) => <strong style={{ color: '#16a34a', fontSize: '13.5px' }}>{formatCurrency(a.amount)}</strong>,
    },
    {
      header: 'Driver Expenses',
      render: (a) => (a.driver_expenses !== undefined && a.trip_id) ? (
        <strong style={{ color: '#b45309', fontSize: '13px' }}>{formatCurrency(a.driver_expenses)}</strong>
      ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>,
    },
    { header: 'Manager', render: (a) => <strong>{a.manager_name}</strong> },
    {
      header: 'Notes',
      render: (a) => a.notes ? <span style={{ color: '#64748b', fontSize: '12px' }}>{a.notes}</span> : <span style={{ color: '#cbd5e1' }}>—</span>,
    },
    {
      header: 'Actions',
      render: (a) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            onClick={() => handlePrintSingleAdvance(a)}
            className="btn btn-outline btn-sm"
            style={{ color: '#2563eb', borderColor: '#bfdbfe', padding: '4px 6px' }}
            title="Print / Save PDF Slip for this trip advance"
          >
            <Printer size={13} />
          </button>
          <button
            onClick={() => handleDownloadSingleExcel(a)}
            className="btn btn-outline btn-sm"
            style={{ color: '#059669', borderColor: '#a7f3d0', padding: '4px 6px' }}
            title="Download Excel for this single trip advance"
          >
            <Download size={13} />
          </button>
          <button
            onClick={() => handleDelete(a.id)}
            className="btn btn-outline btn-sm"
            style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '4px 6px' }}
            title="Delete record"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Truck Advances</h2>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              Total: {total} Records
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', background: '#f0fdf4', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              Total Advances: {formatCurrency(totalAmount)}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px', marginBottom: 0 }}>
            Record advances given by manager to trucks/drivers with Trip Freight, Driver Expenses &amp; Single Trip downloads
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="form-control" placeholder="Search lorry, driver, party, manager..." style={{ paddingLeft: '32px', height: '38px' }} />
          </div>

          <select value={vehicleFilter} onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }} className="form-control" style={{ height: '38px', width: '160px' }}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.lorry_number}</option>)}
          </select>

          <select value={driverFilter} onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }} className="form-control" style={{ height: '38px', width: '160px' }}>
            <option value="">All Drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select value={partyFilter} onChange={(e) => { setPartyFilter(e.target.value); setPage(1); }} className="form-control" style={{ height: '38px', width: '170px' }}>
            <option value="">All Parties</option>
            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setPage(1); }} className="form-control" style={{ height: '38px', width: '150px' }}>
            <option value="">All Managers</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <DateField style={{ width: '140px', height: '38px' }} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} placeholder="From Date" />
          <DateField style={{ width: '140px', height: '38px' }} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} placeholder="To Date" />

          <button onClick={resetFilters} className="btn btn-outline" style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Reset
          </button>

          {/* Print & Download Options Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handlePrint} disabled={isPrinting} className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#3b82f6', color: '#1d4ed8', background: '#eff6ff', fontWeight: 600, height: '38px', padding: '0 12px', fontSize: '12.5px' }}>
              {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {isPrinting ? 'Preparing...' : 'Print'}
            </button>
            <button onClick={handleExportExcel} disabled={isExportingExcel} className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#10b981', color: '#059669', background: '#ecfdf5', fontWeight: 600, height: '38px', padding: '0 12px', fontSize: '12.5px' }}>
              {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {isExportingExcel ? 'Exporting...' : 'Excel'}
            </button>
            <button onClick={handleExportCSV} disabled={isExportingCSV} className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '38px', padding: '0 10px', fontSize: '12.5px' }}>
              {isExportingCSV ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={advances}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          footer={
            advances.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>TOTAL</td>
                <td style={{ fontWeight: 700 }}>Page: {advances.length} Advances</td>
                <td colSpan={4}></td>
                <td style={{ fontWeight: 800, color: '#1d4ed8' }}>{formatCurrency(pageTotalFreight)}</td>
                <td style={{ fontWeight: 800, color: '#16a34a' }}>{formatCurrency(pageTotalAmount)}</td>
                <td style={{ fontWeight: 800, color: '#b45309' }}>{formatCurrency(pageTotalExpenses)}</td>
                <td colSpan={3}></td>
              </tr>
            ) : undefined
          }
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Give Truck Advance" maxWidth="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          {/* Optional Trip Selection */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              <Navigation size={14} style={{ marginRight: '5px' }} /> Link to Trip (optional)
            </label>
            <select
              className="form-control"
              value={formData.trip_id}
              onChange={(e) => {
                const selId = e.target.value;
                setFormData(p => {
                  const updated = { ...p, trip_id: selId };
                  if (selId) {
                    const selTrip = availableTrips.find(t => String(t.id) === selId);
                    if (selTrip) {
                      updated.vehicle_id = String(selTrip.vehicle_id);
                      updated.driver_id = String(selTrip.driver_id);
                      if (!p.notes) {
                        updated.notes = `Advance for Trip #${selTrip.id} (${selTrip.lorry_number || ''})`;
                      }
                    }
                  }
                  return updated;
                });
              }}
            >
              <option value="">— Direct Advance (No Trip Linked) —</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>
                  Trip #{t.id} - {t.lorry_number} ({t.party_name || 'No Party'}) • {t.goods_weight} {t.unit_abbreviation || 'MT'} • Freight: {formatCurrency(t.total_freight)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              <Truck size={14} style={{ marginRight: '5px' }} /> Vehicle (Lorry) *
            </label>
            <select className="form-control" value={formData.vehicle_id}
              onChange={(e) => setFormData(p => ({ ...p, vehicle_id: e.target.value }))}>
              <option value="">— Select Vehicle —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.lorry_number} {v.vehicle_type ? `(${v.vehicle_type})` : ''}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>
              <UserCheck size={14} style={{ marginRight: '5px' }} /> Driver (optional)
            </label>
            <select className="form-control" value={formData.driver_id}
              onChange={(e) => setFormData(p => ({ ...p, driver_id: e.target.value }))}>
              <option value="">— Select Driver —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}</option>)}
            </select>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>
              Linking a driver helps track per-driver advance balance across trips.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Manager (leave blank = current logged-in user)</label>
            <select className="form-control" value={formData.manager_id}
              onChange={(e) => setFormData(p => ({ ...p, manager_id: e.target.value }))}>
              <option value="">— Current Manager —</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Amount (₹) *</label>
              <input className="form-control" type="number" min="0.01" step="0.01" placeholder="0.00"
                value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Date</label>
              <DateField style={{ width: '100%' }} value={formData.advance_date}
                onChange={(e) => setFormData(p => ({ ...p, advance_date: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-control" rows={2} placeholder="Trip purpose, destination, etc."
              value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isSubmitting ? 'Saving...' : 'Record Advance'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
