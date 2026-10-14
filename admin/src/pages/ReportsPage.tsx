import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer, Download, Calendar, RefreshCw, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { reportService, partyService, driverService, vehicleService, unitService } from '../services/adminService';
import { Party, Driver, Vehicle, Unit } from '../types';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

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

export const ReportsPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState('');

  const [parties, setParties] = useState<Party[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  useEffect(() => {
    loadLookups();
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: partyId || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
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
  }, [fromDate, toDate, partyId, driverId, vehicleId, unitId, status]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadLookups = async () => {
    try {
      const [p, d, v, u] = await Promise.all([
        partyService.getParties({ limit: 200 }),
        driverService.getDrivers({ limit: 200 }),
        vehicleService.getVehicles({ limit: 200 }),
        unitService.getUnits('ACTIVE').catch(() => unitService.getUnits()),
      ]);
      setParties(p.data.items || (Array.isArray(p.data) ? p.data : []));
      setDrivers(d.data.items || (Array.isArray(d.data) ? d.data : []));
      setVehicles(v.data.items || (Array.isArray(v.data) ? v.data : []));
      setUnits(Array.isArray(u.data) ? u.data : (u.data as any)?.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
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
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setPartyId('');
    setDriverId('');
    setVehicleId('');
    setUnitId('');
    setStatus('');
  };

  // CSV formatters
  const tripHeaders = [
    'Trip ID', 'Trip Date', 'Lorry Number', 'Party Name', 'Driver Name',
    'Route', 'Unit', 'Weight', 'Total Freight (INR)', 'Advance Paid (INR)',
    'Total Received (INR)', 'Balance Due (INR)', 'Status'
  ];
  const tripRow = (t: any) => [
    String(t.id),
    formatDateDMY(t.trip_date),
    t.lorry_number,
    t.party_name,
    t.driver_name || '',
    `${t.from_location} -> ${t.to_location}`,
    t.unit_name || '',
    String(t.goods_weight || 0),
    fmtCur(t.total_freight),
    fmtCur(t.advance_paid),
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
        'Party Name': t.party_name || '-',
        'Route / Destination': `${t.from_location || ''} -> ${t.to_location || ''}`,
        'Driver Name': t.driver_name || '-',
        'Goods Weight': Number(t.goods_weight || 0),
        'Unit': t.unit_name || 'Tons',
        'Freight Rate (Rs)': Number(t.freight_rate || 0),
        'Total Freight (Rs)': Number(t.total_freight || 0),
        'Advance Paid (Rs)': Number(t.advance_paid || 0),
        'Total Received (Rs)': Number(t.total_received || 0),
        'Balance Due (Rs)': Number(t.balance_due || 0),
        'Status': t.status,
      }));

      // Add a blank separator row
      excelRows.push({
        'S.No': '',
        'Trip ID': '',
        'Trip Date': '',
        'Lorry Number': '',
        'Party Name': '',
        'Route / Destination': '',
        'Driver Name': '',
        'Goods Weight': '',
        'Unit': '',
        'Freight Rate (Rs)': '',
        'Total Freight (Rs)': '',
        'Advance Paid (Rs)': '',
        'Total Received (Rs)': '',
        'Balance Due (Rs)': '',
        'Status': '',
      });

      // Add Grand Total row with Total Trips Count prominently included
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
        'Advance Paid (Rs)': Number(totalAdvancePaid.toFixed(2)),
        'Total Received (Rs)': Number(totalReceivedAmount.toFixed(2)),
        'Balance Due (Rs)': Number(totalBalanceDueAmount.toFixed(2)),
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
        { 'Summary Field': 'Total Advance Paid to Drivers', 'Value': `₹${totalAdvancePaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
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
      alert('No trip records matching current filters to print.');
      return;
    }

    try {
      setIsPrinting(true);

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Logistics - Trip Dispatch Report</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 11.5px; }
    @page { size: landscape; margin: 10mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
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
      <h1 class="company-title">KSP TRANSPORT &amp; LOGISTICS</h1>
      <div class="report-subtitle">FREIGHT DISPATCH &amp; REVENUE AUDIT REPORT</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; font-size: 13px; color: #0f172a;">Total Trips: ${totalTripsCount}</div>
      <p class="meta-text" style="margin-top: 4px;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">S.No</th>
        <th style="width: 70px;">Date</th>
        <th style="width: 85px;">Lorry No</th>
        <th>Party Name</th>
        <th>Route / Destination</th>
        <th>Driver</th>
        <th class="num" style="width: 70px;">Weight</th>
        <th class="num" style="width: 85px;">Freight (₹)</th>
        <th class="num" style="width: 75px;">Received (₹)</th>
        <th class="num" style="width: 75px;">Balance (₹)</th>
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
          <td>${t.party_name}</td>
          <td>${t.from_location} &rarr; ${t.to_location}</td>
          <td>${t.driver_name || '-'}</td>
          <td class="num">${Number(t.goods_weight || 0).toFixed(2)} ${t.unit_name || 'Tons'}</td>
          <td class="num"><strong>${Number(t.total_freight || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td class="num" style="color:#15803d">${Number(t.total_received || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num" style="color:${Number(t.balance_due) > 0 ? '#b91c1c' : '#15803d'}"><strong>${Number(t.balance_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td class="center"><span class="badge ${badgeClass}">${t.status}</span></td>
        </tr>
        `;
      }).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL</td>
        <td colspan="4"><strong>Total Count: ${totalTripsCount} Trips</strong></td>
        <td class="num"><strong>${totalGoodsWeight.toFixed(2)} MT</strong></td>
        <td class="num"><strong>₹${totalFreightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="num"><strong>₹${totalReceivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="num"><strong>₹${totalBalanceDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td class="center"><strong>${totalTripsCount} Trips</strong></td>
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
            Comprehensive freight dispatch audit and trip logistics report
          </p>
        </div>
      </div>

      {/* ── Professional Unified Filter Toolbar ─────────────────────────── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Top Control Line: Date Range + This Week */}
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

        {/* Bottom Control Line: Entity Filters (Party, Truck, Unit, Driver, Status, Reset) */}
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

          {/* Truck Wise */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">All Trucks</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.lorry_number}</option>)}
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

          {/* Reset Filters */}
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
              onClick={handlePrintReport}
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
              title="Direct print trip dispatch audit report"
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
              title="Download report as an Excel spreadsheet with totals"
            >
              {isExportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {isExportingExcel ? 'Exporting...' : 'Excel'}
            </button>
            <button
              onClick={downloadFullReport}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '38px', padding: '0 10px', fontSize: '12.5px' }}
              title="Download report as CSV"
            >
              <Download size={14} /> CSV
            </button>
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
                <th>Party</th>
                <th>Route / Destination</th>
                <th>Unit &amp; Weight</th>
                <th style={{ textAlign: 'right' }}>Total Freight</th>
                <th style={{ textAlign: 'right' }}>Received</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading trip report records...
                  </td>
                </tr>
              ) : tripData.trips.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No trip records match the selected report criteria.
                  </td>
                </tr>
              ) : (
                tripData.trips.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateDMY(t.trip_date)}</td>
                    <td><strong>{t.lorry_number}</strong></td>
                    <td>{t.party_name}</td>
                    <td style={{ fontSize: '13px' }}>{t.from_location} &rarr; {t.to_location}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.goods_weight} {t.unit_name || 'Tons'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.total_freight)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success-700)', fontWeight: 600 }}>{formatCurrency(t.total_received)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: Number(t.balance_due) > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
                      {formatCurrency(t.balance_due)}
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={t.status} /></td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {tripData.trips.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid var(--border-medium, #cbd5e1)' }}>
                  <td colSpan={4} style={{ padding: '12px 14px' }}>
                    <strong>TOTAL ({totalTripsCount} Trips)</strong>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {totalGoodsWeight.toFixed(2)} Tons
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-hover, #2563eb)' }}>
                    {formatCurrency(totalFreightAmount)}
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
