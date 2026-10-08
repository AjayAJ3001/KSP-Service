import React, { useState, useEffect, useCallback } from 'react';
import { History, Eye, Smartphone, Laptop, Globe, Calendar, RefreshCw, Printer, Download, Search } from 'lucide-react';
import { auditLogService } from '../services/adminService';
import { AuditLog } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { formatIST } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

type SourceTab = 'ADMIN' | 'MOBILE' | 'ALL';

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
  const [counts, setCounts] = useState<{ total_all: number; total_admin: number; total_mobile: number }>({
    total_all: 0,
    total_admin: 0,
    total_mobile: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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

  const openDetailsModal = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };

  // Full CSV download of filtered records
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
        ['S.No', 'Timestamp (IST)', 'Platform', 'User Full Name', 'Username', 'User Role', 'Module', 'Action', 'Record ID', 'Details JSON'],
        items.map((l, idx) => [
          idx + 1,
          formatIST(l.created_at),
          l.source === 'MOBILE' ? 'Mobile App' : 'Admin Panel',
          l.user_name || '',
          l.username || '',
          l.user_role || '',
          l.module,
          l.action,
          l.record_id ? `#${l.record_id}` : '',
          l.details ? JSON.stringify(l.details) : '',
        ])
      );
    } catch (err) {
      console.error('Failed to download audit logs CSV', err);
      alert('Failed to download audit logs CSV.');
    } finally {
      setIsDownloading(false);
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
        const isMobile = (l.source || '').toUpperCase() === 'MOBILE';
        return isMobile ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <Smartphone size={13} />
            Mobile App
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#eff6ff',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <Laptop size={13} />
            Admin Panel
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
      render: (l) =>
        l.details ? (
          <button onClick={() => openDetailsModal(l)} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Eye size={13} /> View JSON
          </button>
        ) : (
          <span style={{ color: 'var(--text-light)' }}>—</span>
        ),
    },
  ];

  return (
    <div>
      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Audit Logs &amp; Compliance Tracker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Chronological audit trail of all security, dispatch, financial &amp; administrative actions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> Print
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={isDownloading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} /> {isDownloading ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* ── Separate Platform Tabs (Admin Panel vs Mobile App) ───────────── */}
      <div
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
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Row 1: Date Range + This Week Quick Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>
              Filter by Date:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <DateField
                style={{ width: '140px', height: '38px' }}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <DateField
                style={{ width: '140px', height: '38px' }}
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
              }}
              title="Filter by current week"
            >
              <Calendar size={14} />
              This Week
            </button>
          </div>
        </div>

        {/* Row 2: Module Filter + Quick Search + Reset */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '14px',
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
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

          <div style={{ flex: '2 1 260px', minWidth: '220px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '100%', height: '38px', paddingLeft: '34px' }}
              placeholder="Filter by action, user or record ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '12px', color: 'var(--text-muted)' }} />
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="btn btn-outline"
            style={{ height: '38px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Reset all filters"
          >
            <RefreshCw size={14} /> Reset
          </button>
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

      {/* Details JSON Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Audit Event Details: ${selectedLog?.action}`}
        maxWidth="650px"
      >
        {selectedLog && (
          <div>
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13.5px' }}>
                <div>
                  <strong>Platform:</strong>{' '}
                  <span style={{ fontWeight: 700, color: selectedLog.source === 'MOBILE' ? '#047857' : '#1d4ed8' }}>
                    {selectedLog.source === 'MOBILE' ? 'Mobile App' : 'Admin Panel'}
                  </span>
                </div>
                <div><strong>Module:</strong> <span className="badge badge-info">{selectedLog.module}</span></div>
                <div><strong>Performed By:</strong> {selectedLog.user_name || selectedLog.username || 'System'}</div>
                <div><strong>User Role:</strong> {selectedLog.user_role || '—'}</div>
                <div><strong>Timestamp:</strong> {formatIST(selectedLog.created_at)}</div>
                {selectedLog.record_id && <div><strong>Record ID:</strong> #{selectedLog.record_id}</div>}
              </div>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Payload / Event Parameters (JSON):
            </div>
            <div style={{ background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px', fontFamily: 'monospace' }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(selectedLog.details, null, 2)}</pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsDetailsModalOpen(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
