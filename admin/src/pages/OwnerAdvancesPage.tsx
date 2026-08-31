import React, { useState, useEffect } from 'react';
import { HandCoins, Plus, Edit2, Trash2, Search, Calendar, UserCheck, Briefcase } from 'lucide-react';
import { ownerAdvanceService, ownerService, userService } from '../services/adminService';
import { OwnerAdvance, Owner, User } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<OwnerAdvance | null>(null);
  const [formData, setFormData] = useState({
    owner_id: '',
    manager_id: '',
    amount: '',
    advance_date: new Date().toISOString().slice(0, 16),
    payment_mode: 'CASH',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadAdvances();
  }, [page, search, ownerFilter, managerFilter, fromDate, toDate]);

  const loadLookups = async () => {
    try {
      const [oRes, uRes] = await Promise.all([
        ownerService.getOwners({ limit: 100 }),
        userService.getUsers({ limit: 100, status: 'ACTIVE' }),
      ]);
      setOwners(oRes.data.items);
      const sortedUsers = [...uRes.data.items].sort((a, b) => {
        if (a.role === 'MANAGER' && b.role !== 'MANAGER') return -1;
        if (b.role === 'MANAGER' && a.role !== 'MANAGER') return 1;
        return a.name.localeCompare(b.name);
      });
      setManagers(sortedUsers);
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
      notes: item.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    const defaultManager = managers.find((m) => m.name.toUpperCase().includes('MAGESH') || m.role === 'MANAGER');
    setFormData({
      owner_id: '',
      manager_id: defaultManager ? String(defaultManager.id) : '',
      amount: '',
      advance_date: '',
      payment_mode: 'CASH',
      notes: '',
    });
    setFormError('');
  };

  const formatCurrency = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const columns: Column<OwnerAdvance>[] = [
    {
      header: 'Date & Time',
      accessor: 'advance_date',
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>
          {formatDateTime(r.advance_date)}
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
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HandCoins size={24} color="var(--accent)" />
            Owner Advances Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Record cash advances given by owners and received by managers with automatic date & time tracking
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Record Owner Advance
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid-cols-3" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon success">
            <HandCoins size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#15803d' }}>{formatCurrency(totalAmount)}</div>
            <div className="stat-label">Total Advance Amount Received</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info">
            <Briefcase size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total Advance Transactions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <UserCheck size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {total > 0 ? formatCurrency(totalAmount / total) : '₹0.00'}
            </div>
            <div className="stat-label">Average Advance per Entry</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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

          <div style={{ width: '220px' }}>
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

          <div style={{ width: '200px' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '140px' }}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '140px' }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {(ownerFilter || managerFilter || fromDate || toDate || search) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearch('');
                setOwnerFilter('');
                setManagerFilter('');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
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
              ? formatDateTime(selectedAdvance.advance_date)
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
              <option value="">-- Choose Manager / Staff --</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
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
                <option value="CHEQUE">CHEQUE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          {/* Notes / Remarks */}
          <div className="form-group">
            <label className="form-label">Notes / Remarks (Optional)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Advance for fuel, trip expenses, maintenance funds..."
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
    </div>
  );
};
