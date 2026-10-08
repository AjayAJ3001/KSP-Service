import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Edit2, Trash2 } from 'lucide-react';
import { cleaningExpenseRateService } from '../services/adminService';
import { CleaningExpenseRate } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const CleaningExpensesPage: React.FC = () => {
  const [rates, setRates] = useState<CleaningExpenseRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<CleaningExpenseRate | null>(null);
  const [formData, setFormData] = useState({
    unit_name: '',
    cleaning_charge: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      setIsLoading(true);
      const res = await cleaningExpenseRateService.getCleaningExpenseRates();
      setRates(res.data);
    } catch (err) {
      console.error('Failed to load cleaning expense rates', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_name.trim()) {
      setFormError('Destination / Unit Name is required.');
      return;
    }
    if (!formData.cleaning_charge) {
      setFormError('Cleaning charge is required.');
      return;
    }
    if (parseFloat(formData.cleaning_charge) < 0) {
      setFormError('Cleaning charge must be a positive number.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: Partial<CleaningExpenseRate> = {
        unit_name: formData.unit_name.trim(),
        cleaning_charge: parseFloat(formData.cleaning_charge),
        description: formData.description.trim() || undefined,
        status: formData.status,
      };

      if (selectedRate) {
        await cleaningExpenseRateService.updateCleaningExpenseRate(selectedRate.id, payload);
      } else {
        await cleaningExpenseRateService.createCleaningExpenseRate(payload);
      }
      setIsModalOpen(false);
      setSelectedRate(null);
      resetForm();
      loadRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save cleaning expense rate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (rate: CleaningExpenseRate) => {
    if (
      !confirm(
        `Are you sure you want to delete the cleaning expense rate for "${rate.unit_name}"?`
      )
    )
      return;
    try {
      await cleaningExpenseRateService.deleteCleaningExpenseRate(rate.id);
      loadRates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete cleaning expense rate.');
    }
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (rate: CleaningExpenseRate) => {
    setSelectedRate(rate);
    setFormData({
      unit_name: rate.unit_name,
      cleaning_charge: String(rate.cleaning_charge),
      description: rate.description || '',
      status: rate.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ unit_name: '', cleaning_charge: '', description: '', status: 'ACTIVE' });
    setFormError('');
  };

  const fmt = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `Rs.${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: Column<CleaningExpenseRate>[] = [
    {
      header: '#',
      accessor: (_, idx) => (
        <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '13px' }}>
          {(idx ?? 0) + 1}
        </span>
      ),
    },
    {
      header: 'Destination / Unit Name',
      accessor: 'unit_name',
      render: (r) => (
        <span
          style={{
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--text)',
            letterSpacing: '0.3px',
          }}
        >
          {r.unit_name}
        </span>
      ),
    },
    {
      header: 'Cleaning Charge (Rs.)',
      accessor: 'cleaning_charge',
      render: (r) => (
        <span
          style={{
            fontWeight: 800,
            fontSize: '15px',
            color: '#16a34a',
            background: '#f0fdf4',
            padding: '4px 12px',
            borderRadius: '8px',
          }}
        >
          {fmt(r.cleaning_charge)}
        </span>
      ),
    },

    {
      header: 'Description / Note',
      accessor: (r) => r.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(r)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleDelete(r)} className="btn btn-danger btn-sm" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Droplets size={22} color="var(--accent)" />
            Cleaning Expense Rates
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Configure cleaning charges per destination / unit ({rates.length} destinations configured)
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add Cleaning Rate
        </button>
      </div>

      {/* Data Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={rates}
          isLoading={isLoading}
          total={rates.length}
        />
        {!isLoading && rates.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--text-muted)',
            }}
          >
            <Droplets size={40} style={{ opacity: 0.25, marginBottom: '12px' }} />
            <p style={{ fontWeight: 600 }}>No cleaning expense rates configured yet.</p>
            <p style={{ fontSize: '13px' }}>Click "Add Cleaning Rate" to add your first rate.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRate ? 'Edit Cleaning Expense Rate' : 'Add Cleaning Expense Rate'}
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

        <form onSubmit={handleSubmit}>
          {/* Unit Name / Destination */}
          <div className="form-group">
            <label className="form-label">
              Destination / Unit Name *
              <span style={{ marginLeft: '8px', fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                e.g. SIPCOT, RGS - VAVIKADAI, NAMAKKAL
              </span>
            </label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. SIPCOT"
              value={formData.unit_name}
              onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
            />
          </div>

          {/* Cleaning Charge */}
          <div className="form-group">
            <label className="form-label">
              Cleaning Charge (Rs.) *
              <span style={{ marginLeft: '8px', fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                Charge applied per trip to this destination
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="form-control"
              placeholder="e.g. 30"
              value={formData.cleaning_charge}
              onChange={(e) => setFormData({ ...formData, cleaning_charge: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description / Note (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. SIPCOT - Cleaning Rs.30"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Status (edit only) */}
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
              {isSubmitting ? 'Saving...' : selectedRate ? 'Update Rate' : 'Add Rate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
