import React, { useState, useEffect } from 'react';
import { Percent, Plus, Edit2, Trash2, CheckCircle, Calculator, Info, Sparkles } from 'lucide-react';
import { driverBataRateService, partyService } from '../services/adminService';
import { DriverBataRate, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const DriverBataPage: React.FC = () => {
  const [rates, setRates] = useState<DriverBataRate[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<DriverBataRate | null>(null);
  const [formData, setFormData] = useState({
    scope: 'GLOBAL' as 'GLOBAL' | 'PARTY',
    party_id: '',
    rate_percentage: '15',
    rate_multiplier: '0.15',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
    loadRates();
  }, []);

  const loadLookups = async () => {
    try {
      const res = await partyService.getParties({ limit: 100, status: 'ACTIVE' });
      setParties(res.data.items);
    } catch (err) {
      console.error('Failed to load parties', err);
    }
  };

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

  const globalRate = rates.find((r) => !r.party_id && r.status === 'ACTIVE') || rates.find((r) => !r.party_id);

  const filteredRates = rates.filter((rate) => {
    const matchesStatus = !statusFilter || rate.status === statusFilter;
    let matchesParty = true;
    if (partyFilter === 'GLOBAL') {
      matchesParty = !rate.party_id;
    } else if (partyFilter) {
      matchesParty = String(rate.party_id) === partyFilter;
    }
    return matchesStatus && matchesParty;
  });

  const resetForm = () => {
    setFormData({
      scope: 'PARTY',
      party_id: '',
      rate_percentage: '15',
      rate_multiplier: '0.15',
      description: '',
      status: 'ACTIVE',
    });
    setFormError('');
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (rate: DriverBataRate) => {
    setSelectedRate(rate);
    const pct = String(rate.rate_percentage || parseFloat(String(rate.rate_multiplier || 0.15)) * 100);
    const mult = String(rate.rate_multiplier || (parseFloat(pct) / 100).toFixed(4));
    setFormData({
      scope: rate.party_id ? 'PARTY' : 'GLOBAL',
      party_id: rate.party_id ? String(rate.party_id) : '',
      rate_percentage: pct,
      rate_multiplier: mult,
      description: rate.description || '',
      status: rate.status,
    });
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
    if (formData.scope === 'PARTY' && !formData.party_id) {
      setFormError('Please select a Party.');
      return;
    }

    const pct = parseFloat(formData.rate_percentage);
    if (isNaN(pct) || pct < 0) {
      setFormError('Rate percentage must be a valid number \u2265 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: Partial<DriverBataRate> = {
        party_id: formData.scope === 'PARTY' ? parseInt(formData.party_id) : null,
        rate_percentage: pct,
        rate_multiplier: parseFloat((pct / 100).toFixed(4)),
        description: formData.description.trim() || undefined,
        status: formData.status,
      };

      if (selectedRate) {
        await driverBataRateService.updateDriverBataRate(selectedRate.id, payload);
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

  const handleDelete = async (rate: DriverBataRate) => {
    if (!rate.party_id) {
      alert('The standard global rate cannot be deleted. You can edit it instead.');
      return;
    }
    if (!confirm(`Are you sure you want to delete Driver Bata rate for "${rate.party_name || 'party'}" (${rate.rate_percentage}%)?`)) {
      return;
    }
    try {
      await driverBataRateService.deleteDriverBataRate(rate.id);
      loadRates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete driver bata rate.');
    }
  };

  const columns: Column<DriverBataRate>[] = [
    {
      header: 'Scope / Target',
      accessor: (rate) => (
        <div>
          {!rate.party_id ? (
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
              Standard Global (All Parties)
            </span>
          ) : (
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: '#f8fafc',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
              }}
            >
              {rate.party_name || `Party #${rate.party_id}`}
            </span>
          )}
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
          {rate.party_id ? (
            <button
              onClick={() => handleDelete(rate)}
              className="btn btn-danger btn-sm"
              title="Delete Rate"
              style={{ padding: '6px 10px' }}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Percent size={24} color="#3b82f6" />
            Driver Bata Master
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            Configure driver daily allowance/bata percentage applied automatically to total freight amount
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Party Bata Rate
        </button>
      </div>

      {/* Hero Highlight Card: Current Standard Rate */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '12px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Calculator size={26} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', letterSpacing: '0.5px' }}>
              CURRENT STANDARD DRIVER BATA
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
              <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a' }}>
                {globalRate ? `${parseFloat(String(globalRate.rate_percentage)).toFixed(0)}%` : '15%'}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#2563eb' }}>
                (× {globalRate ? parseFloat(String(globalRate.rate_multiplier)).toFixed(4) : '0.1500'} multiplier)
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#1e40af', marginTop: '3px' }}>
              ⚡ Formula: <strong>Total Freight Amount × {globalRate ? parseFloat(String(globalRate.rate_multiplier)).toFixed(2) : '0.15'}</strong> (pre-filled and locked in mobile driver app)
            </div>
          </div>
        </div>

        {globalRate && (
          <button
            onClick={() => openEditModal(globalRate)}
            className="btn btn-primary"
            style={{
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <Edit2 size={15} /> Edit Standard Rate
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: '220px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Filter by Scope / Party
            </label>
            <select
              className="form-control form-select"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
            >
              <option value="">All Rates</option>
              <option value="GLOBAL">Standard Global (All Parties)</option>
              {parties.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  Party: {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Status
            </label>
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {(partyFilter || statusFilter) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPartyFilter('');
                setStatusFilter('');
              }}
              style={{ alignSelf: 'flex-end', marginBottom: '2px' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Rates Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredRates}
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
        title={selectedRate ? (!selectedRate.party_id ? 'Edit Standard Global Driver Bata' : 'Edit Party Driver Bata Rate') : 'Add Driver Bata Rate'}
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
          {/* Scope Selector */}
          {!selectedRate?.party_id && selectedRate ? (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#1e40af',
                fontWeight: 600,
              }}
            >
              ⭐ Editing Standard Global Driver Bata (applies to all parties by default)
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Scope</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scope: 'GLOBAL', party_id: '' })}
                  disabled={Boolean(selectedRate?.party_id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: formData.scope === 'GLOBAL' ? '2px solid var(--accent-primary)' : '1px solid #cbd5e1',
                    background: formData.scope === 'GLOBAL' ? '#f0fdf4' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: formData.scope === 'GLOBAL' ? '#15803d' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  🌐 Standard Global
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scope: 'PARTY' })}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: formData.scope === 'PARTY' ? '2px solid var(--accent-primary)' : '1px solid #cbd5e1',
                    background: formData.scope === 'PARTY' ? '#f0fdf4' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: formData.scope === 'PARTY' ? '#15803d' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  🏢 Specific Party
                </button>
              </div>
            </div>
          )}

          {/* Party Dropdown if Specific Party */}
          {formData.scope === 'PARTY' && (
            <div className="form-group">
              <label className="form-label">Select Party *</label>
              <select
                className="form-control form-select"
                value={formData.party_id}
                onChange={(e) => setFormData({ ...formData, party_id: e.target.value })}
                required
              >
                <option value="">Select Party</option>
                {parties.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
