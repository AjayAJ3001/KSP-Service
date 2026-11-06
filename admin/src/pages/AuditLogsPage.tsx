import React, { useState, useEffect, useCallback } from 'react';
import { History, Eye, Smartphone, Laptop, Globe, Calendar, RefreshCw, Printer, Download, Search, Loader2, Tablet } from 'lucide-react';
import { auditLogService } from '../services/adminService';
import { AuditLog } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { formatIST } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';
import { PRINT_BRAND_CSS, printBrandLockup } from '../utils/printBrand';
import { formatReadableSummary, getAuditListLabel, getAuditStory, getReadableDetailRows, parseMaybeJson } from '../utils/readableDetails';

type SourceTab = 'ADMIN' | 'MOBILE_ADMIN' | 'MOBILE' | 'ALL';

function platformMeta(source?: string) {
  const s = String(source || 'ADMIN').toUpperCase();
  if (s === 'MOBILE_ADMIN') {
    return { key: 'MOBILE_ADMIN', label: 'Mobile Admin', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' };
  }
  if (s === 'MOBILE') {
    return { key: 'MOBILE', label: 'Mobile App', color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' };
  }
  return { key: 'ADMIN', label: 'Admin Panel', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' };
}

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

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<SourceTab>('ADMIN');

  // Filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Counts for tabs
  const [counts, setCounts] = useState<{ total_all: number; total_admin: number; total_mobile_admin: number; total_mobile: number }>({
    total_all: 0,
    total_admin: 0,
    total_mobile_admin: 0,
    total_mobile: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await auditLogService.getAuditLogs({
        page,
        limit: 20,
        source: activeTab === 'ALL' ? undefined : activeTab,
        module: moduleFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setLogs(res.data.items);
      setTotal(res.data.total);
      if (res.data.counts) {
        setCounts({
          total_all: Number(res.data.counts.total_all) || 0,
          total_admin: Number(res.data.counts.total_admin) || 0,
          total_mobile_admin: Number(res.data.counts.total_mobile_admin) || 0,
          total_mobile: Number(res.data.counts.total_mobile) || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, activeTab, moduleFilter, fromDate, toDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
    setModuleFilter('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const formatDetailSummary = (d: any): string => formatReadableSummary(d);

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true);
      const res = await auditLogService.getAuditLogs({
        page: 1,
        limit: 10000,
        source: activeTab === 'ALL' ? undefined : activeTab,
        module: moduleFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      const items = res.data.items || [];
      const tag = `${activeTab}_${fromDate && toDate ? `${fromDate}_to_${toDate}` : 'All'}`;
      downloadCSV(
        `Audit_Logs_${tag}.csv`,
        ['S.No', 'Timestamp (IST)', 'Platform', 'User Full Name', 'Username', 'User Role', 'Module', 'Action', 'Record ID', 'Audit Details'],
        items.map((l, idx) => [
          idx + 1,
          formatIST(l.created_at),
          platformMeta(l.source).label,
          l.user_name || '',
          l.username || '',
          l.user_role || '',
          l.module,
          l.action,
          l.record_id ? `#${l.record_id}` : '',
          formatDetailSummary(l.details),
        ])
      );
    } catch (err) {
      console.error('Failed to download audit logs CSV', err);
      alert('Failed to download audit logs CSV.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Professional Executive Audit Logs Print View
  const handlePrintAuditLogs = async () => {
    try {
      setIsPrinting(true);

      const res = await auditLogService.getAuditLogs({
        page: 1,
        limit: 2000,
        source: activeTab === 'ALL' ? undefined : activeTab,
        module: moduleFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      let items: AuditLog[] = res.data.items || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (l) =>
            (l.action && l.action.toLowerCase().includes(q)) ||
            (l.module && l.module.toLowerCase().includes(q)) ||
            (l.username && l.username.toLowerCase().includes(q)) ||
            (l.user_name && l.user_name.toLowerCase().includes(q)) ||
            (l.record_id && String(l.record_id).includes(q))
        );
      }

      if (items.length === 0) {
        alert('No audit logs matching current filters to print.');
        setIsPrinting(false);
        return;
      }

      const scopeTitle =
        activeTab === 'ADMIN'
          ? 'Admin Panel Operations'
          : activeTab === 'MOBILE_ADMIN'
          ? 'Mobile Admin Page Operations'
          : activeTab === 'MOBILE'
          ? 'Mobile App Operations'
          : 'All Integrated System Operations';

      const dateRangeStr =
        fromDate && toDate
          ? `${fromDate} to ${toDate}`
          : fromDate
          ? `From ${fromDate}`
          : toDate
          ? `Up to ${toDate}`
          : 'All Time Records';

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Transport - Audit Logs &amp; Compliance Report</title>
  <style>
    ${PRINT_BRAND_CSS}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; font-size: 11px; line-height: 1.4; }
    @page { size: landscape; margin: 10mm; }
    
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }

    .header-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 3px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }

    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .sum-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
    .sum-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .sum-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 8px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    th.center, td.center { text-align: center; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fbfcfe; }

    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-align: center; }
    .badge-admin { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-mobile { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-mobile-admin { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    .badge-module { background: #f1f5f9; color: #334155; font-weight: 700; }
    .action-text { font-weight: 700; color: #0f172a; }
    .details-text { font-size: 9.5px; color: #334155; word-break: break-word; line-height: 1.35; max-width: 320px; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Audit Record / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      ${printBrandLockup()}
      <div class="report-subtitle">Official Audit Logs &amp; Compliance Trail</div>
      <p class="meta-text">Scope: ${scopeTitle} | Module: ${moduleFilter || 'All Modules'}</p>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; font-size: 13px; color: #0f172a;">Total Logs: ${items.length}</div>
      <p class="meta-text" style="margin-top: 4px;">Date Range: ${dateRangeStr}</p>
      <p class="meta-text">Generated: ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>

  <div class="summary-cards">
    <div class="sum-card">
      <div class="sum-label">Platform Scope</div>
      <div class="sum-val">${activeTab === 'ADMIN' ? 'Admin Panel' : activeTab === 'MOBILE_ADMIN' ? 'Mobile Admin' : activeTab === 'MOBILE' ? 'Mobile App' : 'All Platforms'}</div>
    </div>
    <div class="sum-card">
      <div class="sum-label">Module Filter</div>
      <div class="sum-val">${moduleFilter || 'All Modules'}</div>
    </div>
    <div class="sum-card">
      <div class="sum-label">Date Filter</div>
      <div class="sum-val">${dateRangeStr}</div>
    </div>
    <div class="sum-card">
      <div class="sum-label">Matching Logs Count</div>
      <div class="sum-val" style="color: #2563eb;">${items.length} Records</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">S.No</th>
        <th style="width: 125px;">Timestamp (IST)</th>
        <th style="width: 85px;">Platform</th>
        <th style="width: 140px;">Performed By</th>
        <th style="width: 100px;">Module</th>
        <th style="width: 140px;">Action</th>
        <th style="width: 75px;">Record ID</th>
        <th>Audit Details &amp; Summary</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map((l, idx) => {
          const plat = platformMeta(l.source);
          const badgeCls = plat.key === 'MOBILE' ? 'badge-mobile' : plat.key === 'MOBILE_ADMIN' ? 'badge-mobile-admin' : 'badge-admin';
          return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td style="white-space: nowrap;">${formatIST(l.created_at)}</td>
          <td>
            <span class="badge ${badgeCls}">
              ${plat.label}
            </span>
          </td>
          <td>
            <div style="font-weight: 700;">${l.user_name || l.username || 'System'}</div>
            <div style="font-size: 9.5px; color: #64748b;">${l.username ? `@${l.username}` : ''} ${l.user_role ? `[${l.user_role}]` : ''}</div>
          </td>
          <td><span class="badge badge-module">${l.module}</span></td>
          <td class="action-text">${l.action}</td>
          <td style="font-weight: 600;">${l.record_id ? `#${l.record_id}` : '—'}</td>
          <td class="details-text">${formatDetailSummary(l.details)}</td>
        </tr>
          `;
        })
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>KSP Transport Management ERP — Official Compliance Audit Record</span>
    <span>Confidential &amp; Legally Binding System Audit Trail</span>
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
      console.error('Failed to print audit logs', err);
      alert(err.message || 'Failed to print audit logs.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Filter logs in memory if search query is provided
  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.module && l.module.toLowerCase().includes(q)) ||
      (l.username && l.username.toLowerCase().includes(q)) ||
      (l.user_name && l.user_name.toLowerCase().includes(q)) ||
      (l.record_id && String(l.record_id).includes(q))
    );
  });

  const columns: Column<AuditLog>[] = [
    {
      header: 'Timestamp',
      accessor: (l) => formatIST(l.created_at),
    },
    {
      header: 'Platform',
      render: (l) => {
        const plat = platformMeta(l.source);
        const Icon = plat.key === 'MOBILE' ? Smartphone : plat.key === 'MOBILE_ADMIN' ? Tablet : Laptop;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: plat.bg,
              color: plat.color,
              border: `1px solid ${plat.border}`,
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <Icon size={13} />
            {plat.label}
          </span>
        );
      },
    },
    {
      header: 'Performed By',
      accessor: (l) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.user_name || l.username || 'System'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            {l.username && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>@{l.username}</span>}
            {l.user_role && (
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: l.user_role === 'ADMIN' ? '#dbeafe' : l.user_role === 'MANAGER' ? '#fef3c7' : '#e0e7ff',
                  color: l.user_role === 'ADMIN' ? '#1e40af' : l.user_role === 'MANAGER' ? '#92400e' : '#3730a3',
                  fontWeight: 600,
                }}
              >
                {l.user_role}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Module',
      accessor: 'module',
      render: (l) => <span className="badge badge-info">{l.module}</span>,
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (l) => <strong style={{ fontSize: '13px', color: '#1e293b' }}>{l.action}</strong>,
    },
    {
      header: 'Record ID',
      accessor: (l) => (l.record_id ? `#${l.record_id}` : '—'),
    },
    {
      header: 'Details',
      render: (l) => (
        <button
          type="button"
          onClick={() => setSelectedLog(l)}
          className="btn btn-outline btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
        >
          <Eye size={13} />
          {getAuditListLabel(l.details, l.action)}
        </button>
      ),
    },
  ];

  return (
    <div>
      <style>{`
        @media print {
          .no-print,
          .audit-filter-card,
          .audit-tabs-container,
          .header-actions,
          .sidebar,
          .navbar,
          button,
          .btn {
            display: none !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--primary-900)' }}>
            Audit Logs &amp; Compliance Tracker
          </h2>
          <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handlePrintAuditLogs}
              disabled={isPrinting}
              className="btn btn-outline"
              style={{
                height: '36px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1d4ed8',
                borderColor: '#3b82f6',
                background: '#eff6ff',
              }}
              title="Print official audit logs report"
            >
              {isPrinting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {isPrinting ? 'Preparing...' : 'Print'}
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={isDownloading}
              className="btn btn-primary"
              style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
              title="Download Audit Logs as CSV"
            >
              <Download size={15} /> {isDownloading ? 'Exporting...' : 'Download CSV'}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px', marginBottom: 0 }}>
          Chronological audit trail of all security, dispatch, financial &amp; administrative actions
        </p>
      </div>

      {/* ── Separate Platform Tabs (Admin Panel / Mobile Admin / Mobile App) ─ */}
      <div
        className="audit-tabs-container no-print"
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          paddingBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('ADMIN');
            setPage(1);
          }}
          className={`btn ${activeTab === 'ADMIN' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13.5px',
          }}
        >
          <Laptop size={16} />
          <span>Admin Panel Logs</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              background: activeTab === 'ADMIN' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: activeTab === 'ADMIN' ? '#fff' : '#475569',
              fontWeight: 700,
            }}
          >
            {counts.total_admin}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('MOBILE_ADMIN');
            setPage(1);
          }}
          className={`btn ${activeTab === 'MOBILE_ADMIN' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13.5px',
          }}
        >
          <Tablet size={16} />
          <span>Mobile Admin Logs</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              background: activeTab === 'MOBILE_ADMIN' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: activeTab === 'MOBILE_ADMIN' ? '#fff' : '#475569',
              fontWeight: 700,
            }}
          >
            {counts.total_mobile_admin}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('MOBILE');
            setPage(1);
          }}
          className={`btn ${activeTab === 'MOBILE' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13.5px',
          }}
        >
          <Smartphone size={16} />
          <span>Mobile App Logs</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              background: activeTab === 'MOBILE' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: activeTab === 'MOBILE' ? '#fff' : '#475569',
              fontWeight: 700,
            }}
          >
            {counts.total_mobile}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ALL');
            setPage(1);
          }}
          className={`btn ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13.5px',
          }}
        >
          <Globe size={16} />
          <span>All Logs</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              background: activeTab === 'ALL' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: activeTab === 'ALL' ? '#fff' : '#475569',
              fontWeight: 700,
            }}
          >
            {counts.total_all}
          </span>
        </button>
      </div>

      {/* ── Filter Toolbar ──────────────────────────────────────────────── */}
      <div className="card audit-filter-card no-print" style={{ padding: '16px 20px', marginBottom: '22px', borderRadius: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
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
              style={{ width: '150px', height: '38px' }}
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
              style={{ width: '150px', height: '38px' }}
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

          {/* Reduced width: All Modules */}
          <div style={{ width: '160px', flexShrink: 0 }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Modules</option>
              <option value="AUTH">AUTH</option>
              <option value="USERS">USERS</option>
              <option value="TRIPS">TRIPS</option>
              <option value="PAYMENTS">PAYMENTS</option>
              <option value="EXPENSES">EXPENSES</option>
              <option value="SETTLEMENTS">SETTLEMENTS</option>
              <option value="DRIVERS">DRIVERS</option>
              <option value="VEHICLES">VEHICLES</option>
              <option value="PARTIES">PARTIES</option>
              <option value="ROUTES">ROUTES</option>
              <option value="OWNERS">OWNERS</option>
              <option value="OWNER_ADVANCES">OWNER_ADVANCES</option>
              <option value="TRUCK_ADVANCES">TRUCK_ADVANCES</option>
              <option value="UNLOADING_RATES">UNLOADING_RATES</option>
              <option value="DRIVER_BATA_RATES">DRIVER_BATA_RATES</option>
              <option value="CLEANING_EXPENSE_RATES">CLEANING_EXPENSE_RATES</option>
              <option value="OTHER_EXPENSE_LIMITS">OTHER_EXPENSE_LIMITS</option>
            </select>
          </div>

          {/* Reduced width: Search Input */}
          <div style={{ width: '230px', position: 'relative', flexShrink: 0 }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '100%', height: '38px', paddingLeft: '34px' }}
              placeholder="Filter by action, user or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '12px', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={filteredLogs}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={20}
          onPageChange={setPage}
        />
      </div>

      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? getAuditListLabel(selectedLog.details, selectedLog.action) : 'Details'}
        maxWidth="680px"
      >
        {selectedLog && (() => {
          const story = getAuditStory(selectedLog.details) || formatDetailSummary(selectedLog.details);
          const parsed: any = parseMaybeJson(selectedLog.details) || {};
          const rows = getReadableDetailRows(selectedLog.details);
          return (
            <div>
              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13.5px' }}>
                  <div>
                    <strong>Platform:</strong>{' '}
                    <span style={{ fontWeight: 700, color: platformMeta(selectedLog.source).color }}>
                      {platformMeta(selectedLog.source).label}
                    </span>
                  </div>
                  <div><strong>Module:</strong> <span className="badge badge-info">{selectedLog.module}</span></div>
                  <div><strong>Performed By:</strong> {selectedLog.user_name || selectedLog.username || 'System'}</div>
                  <div><strong>User Role:</strong> {selectedLog.user_role || '—'}</div>
                  <div><strong>Timestamp:</strong> {formatIST(selectedLog.created_at)}</div>
                  {selectedLog.record_id && <div><strong>Record ID:</strong> #{selectedLog.record_id}</div>}
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>What happened</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', lineHeight: 1.45 }}>{story === '—' ? 'No extra details were recorded for this action.' : story}</div>
              </div>

              {(parsed.driver_name || parsed.owner_name || parsed.lorry_number || parsed.manager_name) ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#c2410c' }}>Driver</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#9a3412' }}>{parsed.driver_name || '—'}</div>
                  </div>
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9' }}>Owner</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#5b21b6' }}>{parsed.owner_name || '—'}</div>
                  </div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#047857' }}>Lorry</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#065f46' }}>{parsed.lorry_number || '—'}</div>
                  </div>
                  {parsed.manager_name ? (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>Given to</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
                        {parsed.manager_name}{parsed.manager_role ? ` (${parsed.manager_role})` : ' (Manager)'}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {rows.length ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  {rows.map((row, idx) => (
                    <div
                      key={`${row.label}-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: '10px',
                        padding: '10px 14px',
                        background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                        borderBottom: idx === rows.length - 1 ? 'none' : '1px solid #eef2f7',
                        fontSize: '13.5px',
                      }}
                    >
                      <div style={{ color: '#64748b', fontWeight: 700 }}>{row.label}</div>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setSelectedLog(null)} className="btn btn-outline">
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
