import React, { useState, useEffect } from 'react';
import { Percent, Edit2, Sparkles } from 'lucide-react';
import { driverBataRateService } from '../services/adminService';
import { DriverBataRate } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const DriverBataPage: React.FC = () => {
  const [rates, setRates] = useState<DriverBataRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<DriverBataRate | null>(null);
  const [formData, setFormData] = useState({
    rate_percentage: '15',
    rate_multiplier: '0.15',
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
      const res = await driverBataRateService.getDriverBataRates();
      setRates(res.data);
    } catch (err) {
      console.error('Failed to load driver bata rates', err);
    } finally {
      setIsLoading(false);
    }
  };

  const globalRate = rates.find((r) => !r.party_id && r.status === 'ACTIVE') || rates.find((r) => !r.party_id) || rates[0];

  const resetForm = () => {
    setFormData({
      rate_percentage: globalRate ? String(globalRate.rate_percentage) : '15',
      rate_multiplier: globalRate ? String(globalRate.rate_multiplier) : '0.15',
      description: globalRate?.description || '',
      status: globalRate?.status || 'ACTIVE',
    });
    setFormError('');
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (rate?: DriverBataRate | null) => {
    const target = rate || globalRate;
    if (target) {
      setSelectedRate(target);
      const pct = String(target.rate_percentage || parseFloat(String(target.rate_multiplier || 0.15)) * 100);
      const mult = String(target.rate_multiplier || (parseFloat(pct) / 100).toFixed(4));
      setFormData({
        rate_percentage: pct,
        rate_multiplier: mult,
        description: target.description || '',
        status: target.status,
      });
    } else {
      setSelectedRate(null);
      resetForm();
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handlePercentageChange = (pctStr: string) => {
    const pct = parseFloat(pctStr);
    const mult = !isNaN(pct) ? (pct / 100).toString() : '';
    setFormData((prev) => ({
      ...prev,
      rate_percentage: pctStr,
      rate_multiplier: mult,
    }));
  };

  const handleMultiplierChange = (multStr: string) => {
    const mult = parseFloat(multStr);
    const pct = !isNaN(mult) ? (mult * 100).toString() : '';
    setFormData((prev) => ({
      ...prev,
      rate_multiplier: multStr,
      rate_percentage: pct,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = parseFloat(formData.rate_percentage);
    if (isNaN(pct) || pct < 0) {
      setFormError('Rate percentage must be a valid number ≥ 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: Partial<DriverBataRate> = {
        party_id: null,
        rate_percentage: pct,
        rate_multiplier: parseFloat((pct / 100).toFixed(4)),
        description: formData.description.trim() || undefined,
        status: formData.status,
      };

      if (selectedRate) {
        await driverBataRateService.updateDriverBataRate(selectedRate.id, payload);
      } else if (globalRate) {
        await driverBataRateService.updateDriverBataRate(globalRate.id, payload);
      } else {
        await driverBataRateService.createDriverBataRate(payload);
      }
      setIsModalOpen(false);
      setSelectedRate(null);
      resetForm();
      loadRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save driver bata rate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<DriverBataRate>[] = [
    {
      header: 'Scope',
      accessor: (rate) => (
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 800,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          >
            <Sparkles size={13} />
            Standard Global Driver Bata
          </span>
          {rate.description ? (
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {rate.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Bata Percentage (%)',
      accessor: (rate) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '14px',
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
          }}
        >
          <Percent size={14} />
          {parseFloat(String(rate.rate_percentage)).toFixed(2)}%
        </span>
      ),
    },
    {
      header: 'Multiplier Value',
      accessor: (rate) => (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '13.5px',
            color: '#334155',
            background: '#f1f5f9',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
        >
          × {parseFloat(String(rate.rate_multiplier)).toFixed(4)}
        </span>
      ),
    },
    {
      header: 'Calculation Formula',
      accessor: (rate) => (
        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Total Freight Amount × {parseFloat(String(rate.rate_multiplier)).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (rate) => <StatusBadge status={rate.status} />,
    },
    {
      header: 'Actions',
      accessor: (rate) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => openEditModal(rate)}
            className="btn btn-outline btn-sm"
            title="Edit Rate"
            style={{ padding: '6px 10px' }}
          >
            <Edit2 size={14} />
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
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Percent size={24} color="#3b82f6" />
            Driver Bata Master
          </h2>
        </div>
        <button
          onClick={() => openEditModal(globalRate)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Edit2 size={16} /> Edit Driver Bata
        </button>
      </div>

      {/* Rates Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={rates}
          isLoading={isLoading}
          emptyMessage="No driver bata rates found."
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRate(null);
          resetForm();
        }}
        title={selectedRate || globalRate ? 'Edit Driver Bata Rate' : 'Configure Driver Bata Rate'}
        maxWidth="500px"
      >
        {formError && (
          <div
            style={{
              color: 'var(--danger-700)',
              background: 'var(--danger-50)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Rate Percentage & Multiplier Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label className="form-label">Percentage (%) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-control"
                  placeholder="e.g. 15"
                  value={formData.rate_percentage}
                  onChange={(e) => handlePercentageChange(e.target.value)}
                  style={{ fontWeight: 800, fontSize: '16px', paddingRight: '32px' }}
                  required
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                  }}
                >
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="form-label">Multiplier (Decimal) *</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                  }}
                >
                  ×
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  className="form-control"
                  placeholder="e.g. 0.1500"
                  value={formData.rate_multiplier}
                  onChange={(e) => handleMultiplierChange(e.target.value)}
                  style={{ paddingLeft: '26px', fontWeight: 800, fontSize: '16px' }}
                  required
                />
              </div>
            </div>
          </div>

          {/* Formula preview */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '12.5px',
              color: '#334155',
            }}
          >
            <strong>Preview:</strong> Total Freight (e.g. ₹10,000) × {formData.rate_multiplier || '0.15'} ={' '}
            <strong style={{ color: '#047857' }}>
              ₹{((10000 * parseFloat(formData.rate_multiplier || '0.15')) || 0).toFixed(2)} Driver Bata
            </strong>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description / Note</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Standard 15% Driver Bata allowance"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Status */}
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

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedRate(null);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '120px' }}
            >
              {isSubmitting ? 'Saving...' : selectedRate ? 'Update Rate' : 'Save Rate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DriverBataPage;
