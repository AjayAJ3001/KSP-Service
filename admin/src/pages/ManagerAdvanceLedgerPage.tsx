import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Printer,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  HandCoins,
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  ChevronDown,
  ChevronUp,
  Truck,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { truckAdvanceService, ownerAdvanceService } from '../services/adminService';
import { formatISTDate } from '../utils/dateUtils';
import { Link } from 'react-router-dom';

interface ManagerRow {
  manager_id: number;
  manager_name: string;
  manager_email?: string;
  manager_mobile?: string;
  role: string;
  total_received: number;   // from owner advances
  received_count: number;
  total_given: number;      // given to trucks/drivers
  given_count: number;
  available_balance: number;
}

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ManagerAdvanceLedgerPage: React.FC = () => {
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [grandTotals, setGrandTotals] = useState({ total_received: 0, total_given: 0, total_available: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [allManagers, setAllManagers] = useState<{ id: number; name: string }[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [expandedManager, setExpandedManager] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{
    [managerId: number]: {
      truckAdvances: any[];
      ownerAdvances: any[];
      loading: boolean;
    };
  }>({});
  const [detailTabs, setDetailTabs] = useState<{ [managerId: number]: 'trucks' | 'owners' }>({});

  const handleToggleExpand = async (managerId: number) => {
    if (expandedManager === managerId) {
      setExpandedManager(null);
      return;
    }
    setExpandedManager(managerId);

    // If not already fetched, load both truck advances and owner advances for this manager
    if (!expandedDetails[managerId] || (!expandedDetails[managerId].truckAdvances.length && !expandedDetails[managerId].ownerAdvances.length)) {
      setExpandedDetails((prev) => ({
        ...prev,
        [managerId]: { truckAdvances: [], ownerAdvances: [], loading: true },
      }));
      try {
        const [tRes, oRes] = await Promise.all([
          truckAdvanceService.getTruckAdvances({ manager_id: String(managerId), limit: 200 }),
          ownerAdvanceService.getOwnerAdvances({ manager_id: managerId, limit: 200 }),
        ]);
        setExpandedDetails((prev) => ({
          ...prev,
          [managerId]: {
            truckAdvances: tRes.data?.items || [],
            ownerAdvances: oRes.data?.items || [],
            loading: false,
          },
        }));
      } catch (e) {
        console.error('Failed to load manager advance details', e);
        setExpandedDetails((prev) => ({
          ...prev,
          [managerId]: { truckAdvances: [], ownerAdvances: [], loading: false },
        }));
      }
    }
  };

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await truckAdvanceService.getManagerSummary(managerFilter ? { manager_id: managerFilter } : undefined);
      const mgrList = res.data.managers || [];
      setManagers(mgrList);
      if (!managerFilter) {
        setAllManagers(mgrList.map((m: any) => ({ id: m.manager_id, name: m.manager_name })));
      }
      setGrandTotals(res.data.grand_totals || { total_received: 0, total_given: 0, total_available: 0 });
    } catch (err) {
      console.error('Failed to load manager advance summary', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [managerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Window focus & background polling for instant live reflection of newly recorded advances
  useEffect(() => {
    const onFocus = () => {
      loadData(true);
    };
    window.addEventListener('focus', onFocus);
    const timer = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, [loadData]);

  const filtered = managers.filter(m =>
    !search || m.manager_name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Print ─────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (filtered.length === 0) { alert('No records to print.'); return; }
    try {
      setIsPrinting(true);
      const items = filtered;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KSP Manager Advance Ledger</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;color:#1e293b;background:#fff;font-size:11.5px}
        @page{size:landscape;margin:10mm}
        .header-bar{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0f172a;margin-bottom:14px}
        .company-title{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px}
        .report-subtitle{font-size:13px;font-weight:700;color:#2563eb;margin:0;text-transform:uppercase;letter-spacing:.5px}
        .meta-text{font-size:11px;color:#64748b;margin:0}
        .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
        .kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;text-align:center}
        .kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .kpi-value{font-size:15px;font-weight:800;color:#0f172a}
        .kpi-blue{background:#eff6ff;border-color:#bfdbfe}.kpi-blue .kpi-value{color:#1d4ed8}
        .kpi-green{background:#f0fdf4;border-color:#bbf7d0}.kpi-green .kpi-value{color:#15803d}
        .kpi-red{background:#fef2f2;border-color:#fecaca}.kpi-red .kpi-value{color:#b91c1c}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
        th{background:#0f172a;color:#fff;font-weight:700;text-align:left;padding:7px 8px;font-size:10.5px}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
        tr:nth-child(even) td{background:#fbfcfe}
        .footer-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #0f172a;color:#0f172a}
        .num{text-align:right}
        .chip-pos{background:#dcfce7;color:#166534;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700}
        .chip-neg{background:#fee2e2;color:#991b1b;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700}
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
          <div class="report-subtitle">Manager Advance Ledger — Received vs Given vs Balance</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;font-size:13px;color:#0f172a">Total Managers: ${items.length}</div>
          <p class="meta-text" style="margin-top:4px">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:35px">S.No</th>
          <th>Manager Name</th>
          <th>Role</th>
          <th class="num">Received from Owners (₹)</th>
          <th class="num" style="width:60px">Count</th>
          <th class="num">Given to Trucks (₹)</th>
          <th class="num" style="width:60px">Count</th>
          <th class="num">Available Balance (₹)</th>
          <th class="num">Status</th>
        </tr></thead>
        <tbody>
          ${items.map((m, i) => {
            const bal = parseFloat(String(m.available_balance)) || 0;
            return `<tr>
              <td style="text-align:center">${i + 1}</td>
              <td><strong>${m.manager_name}</strong></td>
              <td>${m.role}</td>
              <td class="num" style="color:#15803d;font-weight:700">₹${(parseFloat(String(m.total_received)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="num">${m.received_count}</td>
              <td class="num" style="color:#b45309;font-weight:700">₹${(parseFloat(String(m.total_given)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="num">${m.given_count}</td>
              <td class="num" style="font-weight:800;color:${bal >= 0 ? '#1d4ed8' : '#b91c1c'}">₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="num"><span class="${bal >= 0 ? 'chip-pos' : 'chip-neg'}">${bal >= 0 ? 'In Hand' : 'Deficit'}</span></td>
            </tr>`;
          }).join('')}
          <tr class="footer-row">
            <td style="text-align:center">TOTAL</td>
            <td colspan="2"><strong>${items.length} Managers</strong></td>
            <td class="num"><strong>₹${grandTotals.total_received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td></td>
            <td class="num"><strong>₹${grandTotals.total_given.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td></td>
            <td class="num"><strong>₹${grandTotals.total_available.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px">
        <span>KSP Service Management ERP</span>
        <span>Manager Advance Ledger Report</span>
      </div>
      </body></html>`;

      const win = window.open('', '_blank', 'width=1100,height=850');
      if (!win) { alert('Allow popups to print.'); return; }
      win.document.open(); win.document.write(html); win.document.close();
    } catch (err) { alert('Failed to generate print.'); }
    finally { setIsPrinting(false); }
  };

  // ── Export Excel ──────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const items = filtered;
      const rows: any[] = items.map((m, i) => ({
        'S.No': i + 1,
        'Manager Name': m.manager_name,
        'Role': m.role,
        'Email': m.manager_email || '',
        'Mobile': m.manager_mobile || '',
        'Received from Owners (₹)': parseFloat(String(m.total_received)) || 0,
        'Owner Advance Count': parseInt(String(m.received_count)) || 0,
        'Given to Trucks (₹)': parseFloat(String(m.total_given)) || 0,
        'Truck Advance Count': parseInt(String(m.given_count)) || 0,
        'Available Balance (₹)': parseFloat(String(m.available_balance)) || 0,
        'Status': parseFloat(String(m.available_balance)) >= 0 ? 'In Hand' : 'Deficit',
      }));
      rows.push({});
      rows.push({
        'S.No': 'TOTAL', 'Manager Name': `${items.length} Managers`,
        'Role': '', 'Email': '', 'Mobile': '',
        'Received from Owners (₹)': grandTotals.total_received,
        'Owner Advance Count': '',
        'Given to Trucks (₹)': grandTotals.total_given,
        'Truck Advance Count': '',
        'Available Balance (₹)': grandTotals.total_available,
        'Status': '',
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Manager Advance Ledger');
      const sumRows = [
        { 'Field': 'Report', 'Value': 'Manager Advance Ledger' },
        { 'Field': 'Total Managers', 'Value': items.length },
        { 'Field': 'Grand Total Received (₹)', 'Value': grandTotals.total_received },
        { 'Field': 'Grand Total Given (₹)', 'Value': grandTotals.total_given },
        { 'Field': 'Grand Available Balance (₹)', 'Value': grandTotals.total_available },
        { 'Field': 'Export Time', 'Value': new Date().toLocaleString('en-IN') },
      ];
      const sumWs = XLSX.utils.json_to_sheet(sumRows);
      sumWs['!cols'] = [{ wch: 30 }, { wch: 34 }];
      XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');
      XLSX.writeFile(wb, `KSP_Manager_Advance_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { alert('Failed to export Excel.'); }
    finally { setIsExportingExcel(false); }
  };

  // ── Export CSV ────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      const items = filtered;
      const headers = ['S.No', 'Manager Name', 'Role', 'Received from Owners (INR)', 'Count', 'Given to Trucks (INR)', 'Count', 'Available Balance (INR)', 'Status'];
      const rows = items.map((m, i) => [
        i + 1, m.manager_name, m.role,
        parseFloat(String(m.total_received)).toFixed(2), m.received_count,
        parseFloat(String(m.total_given)).toFixed(2), m.given_count,
        parseFloat(String(m.available_balance)).toFixed(2),
        parseFloat(String(m.available_balance)) >= 0 ? 'In Hand' : 'Deficit',
      ]);
      rows.push([]);
      rows.push(['TOTAL', `${items.length} Managers`, '', grandTotals.total_received.toFixed(2), '', grandTotals.total_given.toFixed(2), '', grandTotals.total_available.toFixed(2), '']);
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `KSP_Manager_Advances_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to export CSV.'); }
    finally { setIsExportingCSV(false); }
  };

  const getBalanceColor = (bal: number) => bal >= 0 ? '#15803d' : '#b91c1c';

  return (
    <div>
      {/* Header */}
      <div
        className="card-header"
        style={{
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={24} color="var(--accent)" />
              Manager Advances Master &amp; Live Balances
            </h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              {managers.length} {managers.length === 1 ? 'Manager' : 'Managers'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
            Track advances received from owners (how much manager got), disbursed to trucks &amp; drivers, and live in-hand available balance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/owner-advances"
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#10b981',
              color: '#059669',
              background: '#ecfdf5',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '12.5px',
              height: '36px',
              padding: '0 12px',
            }}
          >
            <HandCoins size={14} /> Owner Advances
          </Link>
          <Link
            to="/driver-advances"
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
              fontSize: '12.5px',
              height: '36px',
              padding: '0 12px',
            }}
          >
            <Truck size={14} /> Driver Advances
          </Link>
        </div>
      </div>

      {/* Filter Bar with Integrated Print & Download */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '16px', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              placeholder="Search manager name..."
              style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px' }}
            />
          </div>
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="form-control"
            style={{ height: '36px', width: '200px', fontSize: '12.5px' }}
          >
            <option value="">All Managers</option>
            {allManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch('');
              setManagerFilter('');
              loadData();
            }}
            className="btn btn-outline"
            style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}
          >
            <RefreshCw size={13} /> Reset
          </button>

          {/* Print & Download Options Toolbar right near filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn btn-outline"
              title="Print manager balances ledger report"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 600,
                height: '36px',
                padding: '0 12px',
                fontSize: '12.5px',
              }}
            >
              {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              Print
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="btn btn-outline"
              title="Download Excel spreadsheet"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: '#10b981',
                color: '#059669',
                background: '#ecfdf5',
                fontWeight: 600,
                height: '36px',
                padding: '0 12px',
                fontSize: '12.5px',
              }}
            >
              {isExportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
              Excel
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="btn btn-outline"
              title="Download CSV"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                height: '36px',
                padding: '0 10px',
                fontSize: '12.5px',
              }}
            >
              {isExportingCSV ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Manager Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
            <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
            <div>Loading manager advance ledger...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
            <Users size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#475569' }}>
              {managers.length === 0 ? 'No manager advances recorded yet.' : 'No managers match the selected filter.'}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
              {managers.length === 0 ? 'Only managers who have received advances from owners are displayed in this master ledger.' : 'Try clearing the search or filter.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#fff' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: '45px', fontWeight: 700, fontSize: '11.5px' }}>S.No</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'left', fontSize: '11.5px' }}>Manager</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', fontSize: '11.5px', width: '180px' }}>Received from Owners (Credit)</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center', width: '80px', fontSize: '11.5px' }}>Rec. Count</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', fontSize: '11.5px', width: '190px' }}>Given to Trucks/Drivers (Debit)</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center', width: '85px', fontSize: '11.5px' }}>Given Count</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', fontSize: '11.5px', width: '170px' }}>Available Balance in Hand</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center', width: '110px', fontSize: '11.5px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const bal = parseFloat(String(m.available_balance)) || 0;
                  const isExpanded = expandedManager === m.manager_id;
                  return (
                    <React.Fragment key={m.manager_id}>
                      <tr
                        style={{
                          background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onClick={() => handleToggleExpand(m.manager_id)}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: '11.5px' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
                              {m.manager_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{m.manager_name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{m.role} {m.manager_mobile ? `• ${m.manager_mobile}` : ''}</div>
                            </div>
                            {isExpanded ? <ChevronUp size={13} color="#94a3b8" /> : <ChevronDown size={13} color="#94a3b8" />}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: '12.5px' }}>
                          {formatCurrency(m.total_received)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>{m.received_count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309', fontSize: '12.5px' }}>
                          {formatCurrency(m.total_given)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>{m.given_count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: getBalanceColor(bal) }}>
                          {formatCurrency(bal)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                            background: bal >= 0 ? '#dcfce7' : '#fee2e2',
                            color: bal >= 0 ? '#166534' : '#991b1b',
                            display: 'inline-block',
                          }}>
                            {bal >= 0 ? '✓ In Hand' : '⚠ Deficit'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (() => {
                        const activeTab = detailTabs[m.manager_id] || 'owners';
                        const details = expandedDetails[m.manager_id];
                        const tAdvances = details?.truckAdvances || [];
                        const oAdvances = details?.ownerAdvances || [];
                        const isDetLoading = details?.loading;

                        return (
                          <tr>
                            <td colSpan={8} style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                              {/* Compact Drilldown Balance Strip */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '14px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  padding: '10px 16px',
                                  marginBottom: '14px',
                                  flexWrap: 'wrap',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '14px', borderRight: '1px solid #e2e8f0' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>From Owners:</span>
                                  <strong style={{ fontSize: '13.5px', color: '#15803d' }}>{formatCurrency(m.total_received)}</strong>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>({m.received_count} advances)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '14px', borderRight: '1px solid #e2e8f0' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Disbursed:</span>
                                  <strong style={{ fontSize: '13.5px', color: '#b45309' }}>{formatCurrency(m.total_given)}</strong>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>({m.given_count} advances)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>In-Hand Balance:</span>
                                  <strong style={{ fontSize: '14.5px', color: getBalanceColor(bal) }}>{formatCurrency(bal)}</strong>
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                    background: bal >= 0 ? '#dcfce7' : '#fee2e2',
                                    color: bal >= 0 ? '#166534' : '#991b1b',
                                  }}>
                                    {bal >= 0 ? '✓ Available Cash' : '⚠ Deficit'}
                                  </span>
                                </div>
                              </div>

                              {/* Tabs Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setDetailTabs(prev => ({ ...prev, [m.manager_id]: 'owners' })); }}
                                    style={{
                                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                      border: activeTab === 'owners' ? '1px solid #16a34a' : '1px solid #e2e8f0',
                                      background: activeTab === 'owners' ? '#dcfce7' : '#ffffff',
                                      color: activeTab === 'owners' ? '#166534' : '#64748b',
                                      display: 'flex', alignItems: 'center', gap: '6px',
                                    }}
                                  >
                                    <HandCoins size={14} /> Advances Received from Owners ({m.received_count})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setDetailTabs(prev => ({ ...prev, [m.manager_id]: 'trucks' })); }}
                                    style={{
                                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                      border: activeTab === 'trucks' ? '1px solid #d97706' : '1px solid #e2e8f0',
                                      background: activeTab === 'trucks' ? '#fef3c7' : '#ffffff',
                                      color: activeTab === 'trucks' ? '#92400e' : '#64748b',
                                      display: 'flex', alignItems: 'center', gap: '6px',
                                    }}
                                  >
                                    <Truck size={14} /> Advances Disbursed to Trucks &amp; Drivers ({m.given_count})
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  <Link
                                    to={`/owner-advances?manager_id=${m.manager_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                  >
                                    Owner Advances Master <ExternalLink size={12} />
                                  </Link>
                                  <Link
                                    to={`/truck-advances?manager_id=${m.manager_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                  >
                                    Truck Advances Master <ExternalLink size={12} />
                                  </Link>
                                </div>
                              </div>

                              {/* Details Content */}
                              {isDetLoading ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                  <Loader2 size={20} className="animate-spin" style={{ marginBottom: '6px' }} />
                                  <div style={{ fontSize: '12px' }}>Loading transaction records...</div>
                                </div>
                              ) : activeTab === 'trucks' ? (
                                <div>
                                  {tAdvances.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                      No truck advances given yet by this manager.
                                    </div>
                                  ) : (
                                    <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '35px' }}>#</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Date</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Truck / Lorry No</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Assigned Driver</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {tAdvances.map((t: any, idx: number) => (
                                            <tr key={t.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                                              <td style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>{formatISTDate(t.advance_date)}</td>
                                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{t.lorry_number}</td>
                                              <td style={{ padding: '8px 12px', color: '#334155' }}>
                                                {t.driver_name ? (
                                                  <span>{t.driver_name} {t.driver_mobile ? <span style={{ color: '#94a3b8' }}>({t.driver_mobile})</span> : ''}</span>
                                                ) : (
                                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not specified</span>
                                                )}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                                                {formatCurrency(t.amount)}
                                              </td>
                                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{t.notes || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                                            <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Total Advances Given:</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>
                                              {formatCurrency(tAdvances.reduce((acc: number, x: any) => acc + (parseFloat(x.amount) || 0), 0))}
                                            </td>
                                            <td></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {oAdvances.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                      No owner advances received yet by this manager.
                                    </div>
                                  ) : (
                                    <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '35px' }}>#</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Date</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Owner Name</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>Payment Mode</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {oAdvances.map((o: any, idx: number) => (
                                            <tr key={o.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                                              <td style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>{formatISTDate(o.advance_date)}</td>
                                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{o.owner_name}</td>
                                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>
                                                  {o.payment_mode || 'CASH'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                                                {formatCurrency(o.amount)}
                                              </td>
                                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{o.notes || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                                            <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Total Received:</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#15803d' }}>
                                              {formatCurrency(oAdvances.reduce((acc: number, x: any) => acc + (parseFloat(x.amount) || 0), 0))}
                                            </td>
                                            <td></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* Footer row */}
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, fontSize: '11px' }}>TOTAL</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '12px' }}>{filtered.length} {filtered.length === 1 ? 'Manager' : 'Managers'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '12.5px' }}>
                    {formatCurrency(grandTotals.total_received)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    {filtered.reduce((sum, m) => sum + (Number(m.received_count) || 0), 0)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: '12.5px' }}>
                    {formatCurrency(grandTotals.total_given)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    {filtered.reduce((sum, m) => sum + (Number(m.given_count) || 0), 0)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: getBalanceColor(grandTotals.total_available) }}>
                    {formatCurrency(grandTotals.total_available)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: grandTotals.total_available >= 0 ? '#dcfce7' : '#fee2e2',
                      color: grandTotals.total_available >= 0 ? '#166534' : '#991b1b',
                      display: 'inline-block',
                    }}>
                      {grandTotals.total_available >= 0 ? '✓ Net In Hand' : '⚠ Deficit'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
