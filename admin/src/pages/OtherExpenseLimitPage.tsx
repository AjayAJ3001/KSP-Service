import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Edit2, Trash2, Info, Lock, CheckCircle2 } from 'lucide-react';
import { otherExpenseLimitService, partyService } from '../services/adminService';
import { OtherExpenseLimit, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const OtherExpenseLimitPage: React.FC = () => {
  const [limits, setLimits] = useState<OtherExpenseLimit[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<OtherExpenseLimit | null>(null);
  const [formData, setFormData] = useState({
    scope: 'PARTY' as 'GLOBAL' | 'PARTY',
    party_id: '',
    max_amount: '200',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
    loadLimits();
  }, []);

  const loadLookups = async () => {
    try {
      const res = await partyService.getParties({ limit: 100, status: 'ACTIVE' });
      setParties(res.data.items || []);
    } catch (err) {
      console.error('Failed to load parties', err);
    }
  };

  const loadLimits = async () => {
    try {
      setIsLoading(true);
      const res = await otherExpenseLimitService.getOtherExpenseLimits();
      setLimits(res.data || []);
    } catch (err) {
      console.error('Failed to load other expense limits', err);
    } finally {
      setIsLoading(false);
    }
  };

  const globalLimit =
    limits.find((l) => !l.party_id && l.status === 'active') ||
    limits.find((l) => !l.party_id);

  const filteredLimits = limits.filter((lim) => {
    const matchesStatus = !statusFilter || lim.status === statusFilter;
    let matchesParty = true;
    if (partyFilter === 'GLOBAL') {
      matchesParty = !lim.party_id;
    } else if (partyFilter) {
      matchesParty = String(lim.party_id) === partyFilter;
    }
    return matchesStatus && matchesParty;
  });

  const resetForm = () => {
    setFormData({
      scope: 'PARTY',
      party_id: '',
      max_amount: '200',
      description: '',
      status: 'active',
    });
    setFormError('');
  };

  const openCreateModal = () => {
    setSelectedLimit(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (limit: OtherExpenseLimit) => {
    setSelectedLimit(limit);
    setFormData({
      scope: limit.party_id ? 'PARTY' : 'GLOBAL',
      party_id: limit.party_id ? String(limit.party_id) : '',
      max_amount: String(limit.max_amount),
      description: limit.description || '',
      status: limit.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const maxAmt = parseFloat(formData.max_amount);
    if (isNaN(maxAmt) || maxAmt < 0) {
      setFormError('Please enter a valid max amount >= 0');
      return;
    }

    if (formData.scope === 'PARTY' && !formData.party_id) {
      setFormError('Please select a party for the party-specific limit');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<OtherExpenseLimit> = {
        party_id: formData.scope === 'PARTY' ? parseInt(formData.party_id) : null,
        max_amount: maxAmt,
        description: formData.description.trim() || undefined,
        status: formData.status,
      };

      if (selectedLimit) {
        await otherExpenseLimitService.updateOtherExpenseLimit(selectedLimit.id, payload);
      } else {
        await otherExpenseLimitService.createOtherExpenseLimit(payload);
      }

      setIsModalOpen(false);
      loadLimits();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save limit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (limit: OtherExpenseLimit) => {
    const label = limit.party_name ? `Party: ${limit.party_name}` : 'Standard Global';
    if (!window.confirm(`Are you sure you want to delete the Other Expense limit for ${label}?`)) {
      return;
    }

    try {
      await otherExpenseLimitService.deleteOtherExpenseLimit(limit.id);
      loadLimits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete limit');
    }
  };

  const columns: Column<OtherExpenseLimit>[] = [
    {
      header: 'Scope / Party',
      accessor: (lim) => (
        <div>
          {!lim.party_id ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
              }}
            >
              <ShieldAlert size={14} />
              Standard Global (All Parties)
            </span>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--primary-900)', fontSize: '14px' }}>
                {lim.party_name || `Party #${lim.party_id}`}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Party-specific override
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Max Allowed Amount',
      accessor: (lim) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '5px 12px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '15px',
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
            }}
          >
            ₹{parseFloat(String(lim.max_amount)).toFixed(2)}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            (Mobile Max Limit)
          </span>
        </div>
      ),
    },
    {
      header: 'Description / Notes',
      accessor: (lim) => (
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {lim.description || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (lim) => <StatusBadge status={lim.status.toUpperCase() as any} />,
    },
    {
      header: 'Actions',
      accessor: (lim) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => openEditModal(lim)}
            className="btn btn-outline btn-sm"
            title="Edit Limit"
            style={{ padding: '6px 10px' }}
          >
            <Edit2 size={14} />
          </button>
          {lim.party_id && (
            <button
              onClick={() => handleDelete(lim)}
              className="btn btn-danger btn-sm"
              title="Delete Party Limit"
              style={{ padding: '6px 10px' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--primary-900)',
            }}
          >
            <ShieldAlert size={24} color="#f59e0b" />
            Other Expense Limits Master
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            Control the maximum allowed amount mobile drivers can enter under{' '}
            <strong>5. Other Expenses</strong>.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add Party-Specific Limit
        </button>
      </div>

      {/* Hero Highlight Card: Current Standard Global Limit */}
      {globalLimit && (
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
                width: 52,
                height: 52,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Lock size={26} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#1e40af',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ACTIVE STANDARD GLOBAL LIMIT
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a' }}>
                  ₹{parseFloat(String(globalLimit.max_amount)).toFixed(2)} Maximum
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#1e40af', marginTop: '3px' }}>
                🛡️ In the mobile application, drivers can only enter up to{' '}
                <strong>₹{parseFloat(String(globalLimit.max_amount)).toFixed(2)}</strong>. Anything
                above this shows an error on blur and blocks saving.
              </div>
            </div>
          </div>

          <button
            onClick={() => openEditModal(globalLimit)}
            className="btn btn-primary"
            style={{
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '13.5px',
              fontWeight: 700,
            }}
          >
            <Edit2 size={15} /> Edit Global Limit
          </button>
        </div>
      )}

      {/* Info Callout Card */}
      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Info size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
          <strong style={{ color: '#92400e', display: 'block', marginBottom: '2px' }}>
            How the limit validation works in the Mobile App:
          </strong>
          • Drivers enter the Other Expense amount manually.<br />
          • When moving away from the field (<strong>onBlur</strong>) or tapping away, the app
          validates against this master table.<br />
          • If the rate typed is above the master limit (e.g. typing 250 when limit is 200), an
          alert popup immediately warns: <em>"Amount Exceeds Allowed Limit: Maximum allowed limit is ₹200."</em> and prevents saving.
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Scope / Party Filter */}
          <div style={{ flex: '2', minWidth: '220px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '5px',
              }}
            >
              Filter by Scope / Party
            </label>
            <select
              className="form-control form-select"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
            >
              <option value="">All Limits (Global & Parties)</option>
              <option value="GLOBAL">Standard Global Only</option>
              {parties.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  Party: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '5px',
              }}
            >
              Status
            </label>
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(partyFilter || statusFilter) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPartyFilter('');
                setStatusFilter('');
              }}
              style={{ marginBottom: '2px' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Limits Data Table Card */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredLimits}
          isLoading={isLoading}
          emptyMessage="No limits configured. Use the button above to add a party-specific limit or configure the standard limit."
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          selectedLimit
            ? selectedLimit.party_id
              ? `Edit Limit for ${selectedLimit.party_name}`
              : 'Edit Global Standard Limit'
            : 'Add Other Expense Limit'
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {formError}
            </div>
          )}

          {/* Scope Selector (Only on create) */}
          {!selectedLimit && (
            <div className="form-group">
              <label className="form-label">Limit Scope</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scope: 'PARTY' })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: formData.scope === 'PARTY' ? '2px solid #2563eb' : '1px solid var(--border-medium)',
                    background: formData.scope === 'PARTY' ? '#eff6ff' : '#ffffff',
                    color: formData.scope === 'PARTY' ? '#1d4ed8' : 'var(--text-main)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px' }}>Party Override</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                    Specific party only
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scope: 'GLOBAL', party_id: '' })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: formData.scope === 'GLOBAL' ? '2px solid #2563eb' : '1px solid var(--border-medium)',
                    background: formData.scope === 'GLOBAL' ? '#eff6ff' : '#ffffff',
                    color: formData.scope === 'GLOBAL' ? '#1d4ed8' : 'var(--text-main)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px' }}>Standard Global</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                    Default for all parties
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Party Dropdown (if PARTY scope) */}
          {(formData.scope === 'PARTY' || (selectedLimit && selectedLimit.party_id)) && (
            <div className="form-group">
              <label className="form-label">Party *</label>
              <select
                className="form-control form-select"
                value={formData.party_id}
                onChange={(e) => setFormData({ ...formData, party_id: e.target.value })}
                disabled={!!selectedLimit}
                required
              >
                <option value="">Select a party...</option>
                {parties.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Max Amount Input */}
          <div className="form-group">
            <label className="form-label">Maximum Allowed Amount (₹) *</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                ₹
              </span>
              <input
                type="number"
                step="1"
                min="0"
                className="form-control"
                value={formData.max_amount}
                onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                placeholder="e.g. 200"
                style={{ paddingLeft: '30px', fontWeight: 800, fontSize: '15px' }}
                required
              />
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Mobile app users will not be allowed to enter any amount greater than this value.
            </span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description / Notes</label>
            <input
              type="text"
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Standard maximum limit allowed for other minor expenses"
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control form-select"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : selectedLimit ? 'Update Limit' : 'Create Limit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
