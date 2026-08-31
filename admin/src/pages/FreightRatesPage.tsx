import React, { useState, useEffect } from 'react';
import { CircleDollarSign, Plus, Edit2, Trash2 } from 'lucide-react';
import { freightRateService, routeService, unitService, partyService } from '../services/adminService';
import { FreightRate, Route, Unit, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const FreightRatesPage: React.FC = () => {
  const [rates, setRates] = useState<FreightRate[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [routeFilter, setRouteFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<FreightRate | null>(null);
  const [formData, setFormData] = useState({
    route_id: '',
    unit_id: '',
    party_id: '',
    rate_per_unit: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadRates();
  }, [page, routeFilter, partyFilter, statusFilter]);

  const loadRates = async () => {
    try {
      setIsLoading(true);
      const res = await freightRateService.getFreightRates({
        page,
        limit: 10,
        route_id: routeFilter ? parseInt(routeFilter) : undefined,
        party_id: partyFilter ? parseInt(partyFilter) : undefined,
        status: statusFilter || undefined,
      });
      setRates(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load freight rates', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLookups = async () => {
    try {
      const [rRes, uRes, pRes] = await Promise.all([
        routeService.getRoutes({ limit: 100, status: 'ACTIVE' }),
        unitService.getUnits('ACTIVE'),
        partyService.getParties({ limit: 100, status: 'ACTIVE' }),
      ]);
      setRoutes(rRes.data.items);
      setUnits(uRes.data);
      setParties(pRes.data.items);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.route_id || !formData.unit_id || !formData.rate_per_unit || !formData.effective_from) {
      setFormError('Route, Unit, Rate and Effective Date are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        route_id: parseInt(formData.route_id),
        unit_id: parseInt(formData.unit_id),
        party_id: formData.party_id ? parseInt(formData.party_id) : undefined,
        rate_per_unit: parseFloat(formData.rate_per_unit),
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        status: formData.status,
      };

      if (selectedRate) {
        await freightRateService.updateFreightRate(selectedRate.id, payload);
      } else {
        await freightRateService.createFreightRate(payload);
      }
      setIsModalOpen(false);
      setSelectedRate(null);
      resetForm();
      loadRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save freight rate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFreightRate = async (rate: FreightRate) => {
    if (!confirm(`Are you sure you want to delete this freight rate (${rate.from_location} → ${rate.to_location})?`)) return;
    try {
      await freightRateService.deleteFreightRate(rate.id);
      loadRates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete freight rate.');
    }
  };

  const openCreateModal = () => {
    setSelectedRate(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (rate: FreightRate) => {
    setSelectedRate(rate);
    setFormData({
      route_id: String(rate.route_id),
      unit_id: String(rate.unit_id),
      party_id: rate.party_id ? String(rate.party_id) : '',
      rate_per_unit: String(rate.rate_per_unit),
      effective_from: rate.effective_from ? rate.effective_from.split('T')[0] : '',
      effective_to: rate.effective_to ? rate.effective_to.split('T')[0] : '',
      status: rate.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      route_id: '',
      unit_id: '',
      party_id: '',
      rate_per_unit: '',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      status: 'ACTIVE',
    });
    setFormError('');
  };

  const columns: Column<FreightRate>[] = [
    {
      header: 'Route',
      render: (r) => <strong>{r.from_location} → {r.to_location}</strong>,
    },
    { header: 'Unit', accessor: (r) => r.unit_name || '—' },
    { header: 'Applicable Party', accessor: (r) => (r.party_name ? r.party_name : <span style={{ color: 'var(--text-light)' }}>All Parties (Default)</span>) },
    {
      header: 'Freight Rate',
      render: (r) => <strong style={{ color: 'var(--accent-hover)' }}>₹{parseFloat(String(r.rate_per_unit)).toLocaleString('en-IN')}/{r.unit_name}</strong>,
    },
    { header: 'Effective From', accessor: (r) => new Date(r.effective_from).toLocaleDateString('en-IN') },
    { header: 'Status', accessor: 'status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(r)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteFreightRate(r)}
            className="btn btn-danger btn-sm"
            title="Delete Freight Rate"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Freight Rate Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain tariff pricing per route, unit (Tons/Bags) & party-specific contracts
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add Freight Rate
        </button>
      </div>

      {/* Party Filter */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Filter by Party</label>
            <select
              className="form-control form-select"
              value={partyFilter}
              onChange={(e) => { setPartyFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Filter by Status</label>
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          {(partyFilter || statusFilter) && (
            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: '18px' }}
              onClick={() => { setPartyFilter(''); setStatusFilter(''); setPage(1); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={rates}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          emptyMessage="No freight rates found. Add rates using the button above."
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRate ? 'Edit Freight Rate' : 'Add New Freight Rate'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Route (From → To) *</label>
            <select
              className="form-control form-select"
              required
              value={formData.route_id}
              onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
            >
              <option value="">Select Route</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.from_location} → {r.to_location} ({r.distance_km || 0} KM)
                </option>
              ))}
            </select>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Measurement Unit *</label>
              <select
                className="form-control form-select"
                required
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation || ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Party Specific (Optional)</label>
              <select
                className="form-control form-select"
                value={formData.party_id}
                onChange={(e) => setFormData({ ...formData, party_id: e.target.value })}
              >
                <option value="">All Parties (Default Standard Rate)</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Rate Per Unit (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                placeholder="e.g. 1250.00"
                value={formData.rate_per_unit}
                onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Effective From Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              />
            </div>
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
              {isSubmitting ? 'Saving...' : 'Save Freight Rate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
