import React, { useState, useEffect } from 'react';
import { History, Search, Eye } from 'lucide-react';
import { auditLogService } from '../services/adminService';
import { AuditLog } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, moduleFilter, fromDate, toDate]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const res = await auditLogService.getAuditLogs({
        page,
        limit: 20,
        module: moduleFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setLogs(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openDetailsModal = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };

  const columns: Column<AuditLog>[] = [
    {
      header: 'Timestamp',
      accessor: (l) => new Date(l.created_at).toLocaleString('en-IN'),
    },
    {
      header: 'Performed By',
      accessor: (l) => (
        <div>
          <strong>{l.user_name || l.username || 'System'}</strong>
          {l.username && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{l.username}</div>}
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
      render: (l) => <strong>{l.action}</strong>,
    },
    {
      header: 'Record ID',
      accessor: (l) => (l.record_id ? `#${l.record_id}` : '—'),
    },
    {
      header: 'Details',
      render: (l) =>
        l.details ? (
          <button onClick={() => openDetailsModal(l)} className="btn btn-outline btn-sm">
            <Eye size={13} /> View JSON
          </button>
        ) : (
          <span style={{ color: 'var(--text-light)' }}>—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Audit Logs & Compliance Tracker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Chronological audit trail of all security, dispatch, financial & administrative actions
          </p>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-control form-select"
              style={{ width: '180px' }}
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
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>From:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: '150px' }}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>To:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: '150px' }}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={logs}
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
      >
        {selectedLog && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div><strong>Module:</strong> {selectedLog.module}</div>
              <div><strong>User:</strong> {selectedLog.username || 'System'}</div>
              <div><strong>Timestamp:</strong> {new Date(selectedLog.created_at).toLocaleString('en-IN')}</div>
              {selectedLog.record_id && <div><strong>Record ID:</strong> {selectedLog.record_id}</div>}
            </div>

            <div style={{ background: '#0f172a', color: '#38bdf8', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px', fontFamily: 'monospace' }}>
              <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
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
