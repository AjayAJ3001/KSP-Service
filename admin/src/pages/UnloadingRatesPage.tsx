import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ArrowDownCircle } from 'lucide-react';
import { unloadingRateService, partyService, routeService } from '../services/adminService';
import { UnloadingRate, Party, Route } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const UnloadingRatesPage: React.FC = () => {
  const [rates, setRates] = useState<UnloadingRate[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Party routes/units for modal
  const [partyRoutes, setPartyRoutes] = useState<Route[]>([]);
  const [isLoadingPartyRoutes, setIsLoadingPartyRoutes] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<UnloadingRate | null>(null);
  const [formData, setFormData] = useState({
    party_id: '',
    unit_number: '',
    unit_name: '',
    route_id: undefined as number | undefined,
    rate_per_ton: '',
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

  const loadPartyRoutes = async (partyId: number): Promise<Route[]> => {
    try {
      setIsLoadingPartyRoutes(true);
      const res = await routeService.getRoutes({ party_id: partyId, limit: 100, status: 'ACTIVE' });
      const items = res.data.items || [];
      setPartyRoutes(items);
      return items;
    } catch (err) {
      console.error('Failed to load party routes/units', err);
      setPartyRoutes([]);
      return [];
    } finally {
      setIsLoadingPartyRoutes(false);
    }
  };

  const handlePartyChange = async (partyIdStr: string) => {
    setFormData((prev) => ({
      ...prev,
      party_id: partyIdStr,
      route_id: undefined,
      unit_name: '',
      unit_number: '',
    }));
    setIsCustomUnit(false);
    if (!partyIdStr) {
      setPartyRoutes([]);
      return;
    }
    await loadPartyRoutes(parseInt(partyIdStr));
  };

  const handleUnitSelect = (routeIdStr: string) => {
    if (!routeIdStr) {
      setFormData((prev) => ({ ...prev, route_id: undefined, unit_name: '' }));
      return;
    }
    const selectedRoute = partyRoutes.find((r) => String(r.id) === routeIdStr);
    if (selectedRoute) {
      let unitNum = formData.unit_number;
      if (!unitNum) {
        const partyRates = rates.filter(
          (r) => String(r.party_id) === formData.party_id && (!selectedRate || r.id !== selectedRate.id)
        );
        const existingNums = partyRates
          .map((r) => r.unit_number)
          .filter((n): n is number => typeof n === 'number');
        const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
        unitNum = String(maxNum + 1);
      }

      setFormData((prev) => ({
        ...prev,
        route_id: selectedRoute.id,
        unit_name: selectedRoute.to_location,
        unit_number: unitNum,
      }));
    }
  };

  const loadRates = async () => {
    try {
      setIsLoading(true);
      const res = await unloadingRateService.getUnloadingRates();
      setRates(res.data);
    } catch (err) {
      console.error('Failed to load unloading rates', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRates = rates.filter((rate) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      rate.unit_name.toLowerCase().includes(query) ||
      (rate.party_name && rate.party_name.toLowerCase().includes(query)) ||
      String(rate.unit_number || '').includes(query);

    const matchesParty = !partyFilter || String(rate.party_id) === partyFilter;
    const matchesStatus = !statusFilter || rate.status === statusFilter;

    return matchesSearch && matchesParty && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      party_id: partyFilter || '',
      unit_number: '',
      unit_name: '',
      route_id: undefined,
      rate_per_ton: '',
      status: 'ACTIVE',
    });
    setIsCustomUnit(false);
    setFormError('');
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
    if (partyFilter) {
      loadPartyRoutes(parseInt(partyFilter));
    } else {
      setPartyRoutes([]);
    }
  };

  const openEditModal = async (rate: UnloadingRate) => {
    setSelectedRate(rate);
    const partyId = rate.party_id;
    setFormData({
      party_id: String(partyId),
      unit_number: rate.unit_number !== null && rate.unit_number !== undefined ? String(rate.unit_number) : '',
      unit_name: rate.unit_name,
      route_id: rate.route_id,
      rate_per_ton: String(rate.rate_per_ton),
      status: rate.status,
    });
    setFormError('');
    setIsModalOpen(true);

    const routesForParty = await loadPartyRoutes(partyId);
    const matchingRoute = routesForParty.find(
      (r) => r.id === rate.route_id || r.to_location.toLowerCase() === rate.unit_name.toLowerCase()
    );
    if (matchingRoute) {
      setIsCustomUnit(false);
      if (!rate.route_id) {
        setFormData((prev) => ({ ...prev, route_id: matchingRoute.id }));
      }
    } else {
      setIsCustomUnit(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.party_id) {
      setFormError('Please select a Party.');
      return;
    }
    if (!formData.unit_name.trim()) {
      setFormError('Unit Name is required.');
      return;
    }
    if (!formData.rate_per_ton || parseFloat(formData.rate_per_ton) < 0) {
      setFormError('Rate per Ton must be a valid number \u2265 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload: Partial<UnloadingRate> = {
        party_id: parseInt(formData.party_id),
        unit_number: formData.unit_number ? parseInt(formData.unit_number) : undefined,
        unit_name: formData.unit_name.trim(),
        route_id: formData.route_id || undefined,
        rate_per_ton: parseFloat(formData.rate_per_ton),
        status: formData.status,
      };

      if (selectedRate) {
        await unloadingRateService.updateUnloadingRate(selectedRate.id, payload);
      } else {
        await unloadingRateService.createUnloadingRate(payload);
      }
      setIsModalOpen(false);
      setSelectedRate(null);
      resetForm();
      loadRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save unloading rate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (rate: UnloadingRate) => {
    if (!confirm(`Are you sure you want to delete the unloading rate for "${rate.unit_name}" (\u20B9${rate.rate_per_ton}/Ton)?`)) {
      return;
    }
    try {
      await unloadingRateService.deleteUnloadingRate(rate.id);
      loadRates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete unloading rate.');
    }
  };

  const columns: Column<UnloadingRate>[] = [
    {
      header: 'Unit #',
      accessor: (rate) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            color: '#b45309',
            fontWeight: 800,
            fontSize: '13px',
          }}
        >
          {rate.unit_number || '\u2014'}
        </span>
      ),
    },
    {
      header: 'Unit Name / Facility',
      accessor: (rate) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--primary-900)', fontSize: '14px' }}>
            {rate.unit_name}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            {rate.unit_number ? `Unit ${rate.unit_number}` : ''}
            {rate.unit_number && rate.from_location && rate.to_location ? ' • ' : ''}
            {rate.from_location && rate.to_location ? `${rate.from_location} → ${rate.to_location}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Party / Client',
      accessor: (rate) => (
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
      ),
    },
    {
      header: 'Rate / Ton',
      accessor: (rate) => (
        <span
          style={{
            display: 'inline-block',
            padding: '5px 12px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '14px',
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
          }}
        >
          {'\u20B9'}{parseFloat(String(rate.rate_per_ton)).toFixed(0)} / Ton
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
          <button
            onClick={() => handleDelete(rate)}
            className="btn btn-danger btn-sm"
            title="Delete Rate"
            style={{ padding: '6px 10px' }}
          >
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
          <h2 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowDownCircle size={24} color="#f59e0b" />
            Unloading Rates
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            Configure destination unloading rates per party and unit ({rates.length} rates configured)
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Unloading Rate
        </button>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '16px', padding: '18px 22px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Search Box */}
          <div style={{ flex: '2', minWidth: '220px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search unit name or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Filter by Party */}
          <div style={{ flex: '1.5', minWidth: '180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Filter by Party
            </label>
            <select
              className="form-control form-select"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div style={{ flex: '1', minWidth: '130px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Filter by Status
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

          {/* Clear Button */}
          {(searchQuery || partyFilter || statusFilter) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('');
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

      {/* Data Table Card */}
      <div className="card">
        <DataTable
          columns={columns}
          data={filteredRates}
          isLoading={isLoading}
          emptyMessage="No unloading rates found matching your criteria."
        />
      </div>

      {/* Add / Edit Rate Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRate(null);
          resetForm();
        }}
        title={selectedRate ? 'Edit Unloading Rate' : 'Add New Unloading Rate'}
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
          {/* 1. Party */}
          <div className="form-group">
            <label className="form-label">Party / Client *</label>
            <select
              className="form-control form-select"
              value={formData.party_id}
              onChange={(e) => handlePartyChange(e.target.value)}
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

          {/* 2. Unit Number & Unit Name side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label className="form-label">Unit #</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 1"
                min="1"
                max="99"
                value={formData.unit_number}
                onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Unit Name / Facility *
                </label>
                {formData.party_id && partyRoutes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextCustom = !isCustomUnit;
                      setIsCustomUnit(nextCustom);
                      if (nextCustom) {
                        setFormData((prev) => ({ ...prev, route_id: undefined }));
                      } else {
                        const matched = partyRoutes.find(
                          (r) => r.to_location.toLowerCase() === formData.unit_name.toLowerCase()
                        );
                        if (matched) {
                          setFormData((prev) => ({ ...prev, route_id: matched.id, unit_name: matched.to_location }));
                        }
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    {isCustomUnit ? '← Choose from Party Units' : '+ Custom Unit'}
                  </button>
                )}
              </div>

              {!formData.party_id ? (
                <input
                  type="text"
                  className="form-control"
                  placeholder="Select a party first"
                  disabled
                />
              ) : !isCustomUnit && partyRoutes.length > 0 ? (
                <select
                  className="form-control form-select"
                  value={
                    formData.route_id
                      ? String(formData.route_id)
                      : (partyRoutes.find((r) => r.to_location.toLowerCase() === formData.unit_name.toLowerCase())?.id
                          ? String(partyRoutes.find((r) => r.to_location.toLowerCase() === formData.unit_name.toLowerCase())?.id)
                          : '')
                  }
                  onChange={(e) => handleUnitSelect(e.target.value)}
                  disabled={isLoadingPartyRoutes}
                  required
                >
                  <option value="">
                    {isLoadingPartyRoutes
                      ? 'Loading party units...'
                      : `-- Select Unit from ${parties.find((p) => String(p.id) === formData.party_id)?.name || 'Party'} --`}
                  </option>
                  {partyRoutes.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.to_location} {r.from_location ? `(${r.from_location} → ${r.to_location})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SIPCOT or Branch / Facility name"
                    value={formData.unit_name}
                    onChange={(e) => setFormData({ ...formData, unit_name: e.target.value, route_id: undefined })}
                    required
                  />
                  {formData.party_id && partyRoutes.length === 0 && !isLoadingPartyRoutes && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      No delivery units assigned to this party in Parties and Units. Enter unit name manually.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Rate per Ton (preset pills removed) */}
          <div className="form-group">
            <label className="form-label">Rate per Ton ({'\u20B9'}) *</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 800,
                  fontSize: '16px',
                  color: 'var(--text-muted)',
                }}
              >
                {'\u20B9'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="e.g. 50.00"
                value={formData.rate_per_ton}
                onChange={(e) => setFormData({ ...formData, rate_per_ton: e.target.value })}
                style={{ paddingLeft: '30px', fontSize: '16px', fontWeight: 700 }}
                required
              />
            </div>
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

          {/* Action Buttons */}
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

export default UnloadingRatesPage;
