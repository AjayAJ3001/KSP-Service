import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Edit2, Trash2 } from 'lucide-react';
import { expenseRateService } from '../services/adminService';
import { ExpenseRate } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const ExpenseRatesPage: React.FC = () => {
  const [rates, setRates] = useState<ExpenseRate[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ExpenseRate | null>(null);
  const [formData, setFormData] = useState({
    expense_type: 'LOADING' as 'LOADING' | 'UNLOADING' | 'OTHER',
    name: '',
    rate_per_unit: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRates();
  }, [typeFilter]);

  const loadRates = async () => {
    try {
      setIsLoading(true);
      const res = await expenseRateService.getExpenseRates({
        expense_type: typeFilter || undefined,
      });
      setRates(res.data);
    } catch (err) {
      console.error('Failed to load expense rates', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.expense_type) {
      setFormError('Expense type and name are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        expense_type: formData.expense_type,
        name: formData.name.trim(),
        rate_per_unit: formData.rate_per_unit ? parseFloat(formData.rate_per_unit) : undefined,
        status: formData.status,
      };

      if (selectedRate) {
        await expenseRateService.updateExpenseRate(selectedRate.id, payload);
      } else {
        await expenseRateService.createExpenseRate(payload);
      }
      setIsModalOpen(false);
      setSelectedRate(null);
      resetForm();
      loadRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense rate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpenseRate = async (rate: ExpenseRate) => {
    if (!confirm(`Are you sure you want to delete expense rate "${rate.name}"?`)) return;
    try {
      await expenseRateService.deleteExpenseRate(rate.id);
      loadRates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense rate.');
    }
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (rate: ExpenseRate) => {
    setSelectedRate(rate);
    setFormData({
      expense_type: rate.expense_type,
      name: rate.name,
      rate_per_unit: rate.rate_per_unit ? String(rate.rate_per_unit) : '',
      status: rate.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      expense_type: 'LOADING',
      name: '',
      rate_per_unit: '',
      status: 'ACTIVE',
    });
    setFormError('');
  };

  const columns: Column<ExpenseRate>[] = [
    {
      header: 'Category Type',
      accessor: 'expense_type',
      render: (r) => (
        <span className={`badge ${r.expense_type === 'LOADING' ? 'badge-info' : r.expense_type === 'UNLOADING' ? 'badge-warning' : 'badge-neutral'}`}>
          {r.expense_type}
        </span>
      ),
    },
    { header: 'Expense Name', accessor: 'name', render: (r) => <strong>{r.name}</strong> },
    {
      header: 'Default Rate / Unit (₹)',
      accessor: (r) => (r.rate_per_unit ? `₹${parseFloat(String(r.rate_per_unit)).toLocaleString('en-IN')}` : 'Variable / As Incurred'),
    },
    { header: 'Status', accessor: 'status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(r)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteExpenseRate(r)}
            className="btn btn-danger btn-sm"
            title="Delete Expense Rate"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Expense Rate Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain loading, unloading & operational trip expense definitions
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add Expense Rate
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`btn btn-sm ${typeFilter === '' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTypeFilter('')}
            >
              All Types
            </button>
            <button
              className={`btn btn-sm ${typeFilter === 'LOADING' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTypeFilter('LOADING')}
            >
              Loading
            </button>
            <button
              className={`btn btn-sm ${typeFilter === 'UNLOADING' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTypeFilter('UNLOADING')}
            >
              Unloading
            </button>
            <button
              className={`btn btn-sm ${typeFilter === 'OTHER' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTypeFilter('OTHER')}
            >
              Other Expenses
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rates}
          isLoading={isLoading}
          total={rates.length}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRate ? 'Edit Expense Rate' : 'Add New Expense Rate'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Expense Category Type *</label>
            <select
              className="form-control form-select"
              required
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value as any })}
            >
              <option value="LOADING">LOADING Charges</option>
              <option value="UNLOADING">UNLOADING Charges</option>
              <option value="OTHER">OTHER (Toll, Food, Maintenance, etc.)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Expense Name / Description *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. Loading Charges, Toll Tax, Food Allowance"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Default Rate per Unit / Fixed Amount (₹) (Optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              placeholder="e.g. 50.00 (leave blank for variable amount)"
              value={formData.rate_per_unit}
              onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
            />
          </div>

          {selectedRate && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Expense Rate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
