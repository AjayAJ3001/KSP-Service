import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Search, Trash2, Building2 } from 'lucide-react';
import { routeService, partyService } from '../services/adminService';
import { Route, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState({ from_location: 'Erode', to_location: '', distance_km: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [page, search, partyFilter, statusFilter]);

  const loadParties = async () => {
    try {
      const res = await partyService.getParties({ limit: 100, status: 'ACTIVE' });
      setParties(res.data.items);
    } catch (err) {
      console.error('Failed to load parties', err);
    }
  };

  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      const res = await routeService.getRoutes({
        page,
        limit: 10,
        search: search || undefined,
        party_id: partyFilter ? parseInt(partyFilter) : undefined,
        status: statusFilter || undefined,
      });
      setRoutes(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load routes', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to_location.trim()) {
      setFormError('Party Unit / Destination name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        from_location: (formData.from_location || 'Erode').trim(),
        to_location: formData.to_location.trim(),
        distance_km: formData.distance_km ? parseFloat(formData.distance_km) : undefined,
        status: formData.status,
      };

      if (selectedRoute) {
        await routeService.updateRoute(selectedRoute.id, payload);
      } else {
        await routeService.createRoute(payload);
      }
      setIsModalOpen(false);
      setSelectedRoute(null);
      setFormData({ from_location: 'Erode', to_location: '', distance_km: '', status: 'ACTIVE' });
      loadRoutes();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save route.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm(`Are you sure you want to delete unit/destination "${route.to_location}"?`)) return;
    try {
      await routeService.deleteRoute(route.id);
      loadRoutes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete route.');
    }
  };

  const openCreateModal = () => {
    setSelectedRoute(null);
    setFormData({ from_location: 'Erode', to_location: '', distance_km: '', status: 'ACTIVE' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (route: Route) => {
    setSelectedRoute(route);
    setFormData({
      from_location: route.from_location || 'Erode',
      to_location: route.to_location,
      distance_km: route.distance_km ? String(route.distance_km) : '',
      status: route.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const columns: Column<Route>[] = [
    {
      header: 'Party Unit / Destination',
      render: (r) => (
        <span
          style={{
            fontWeight: 700,
            fontSize: '14.5px',
            color: '#1e40af',
            background: '#eff6ff',
            padding: '4px 10px',
            borderRadius: '6px',
          }}
        >
          {r.to_location}
        </span>
      ),
    },
    {
      header: 'Applicable Party',
      accessor: (r) => (
        r.party_name ? (
          <strong style={{ color: 'var(--primary-900)' }}>{r.party_name}</strong>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Common / All Parties</span>
        )
      ),
    },
    {
      header: 'Freight Rate',
      render: (r) => (
        r.rate_per_unit ? (
          <strong style={{ color: '#d97706', fontSize: '14.5px', fontWeight: 800 }}>
            ₹{parseFloat(String(r.rate_per_unit)).toLocaleString('en-IN')}/Ton
          </strong>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )
      ),
    },
    {
      header: 'From Origin',
      render: () => <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Erode</span>,
    },
    { header: 'Distance (KM)', accessor: (r) => (r.distance_km ? `${r.distance_km} KM` : '—') },
    { header: 'Status', accessor: 'status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(r)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteRoute(r)}
            className="btn btn-danger btn-sm"
            title="Delete Route"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Routes & Party Unit Destinations</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Origin is fixed to <strong>Erode</strong> — filter by party to view their specific delivery unit names
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add Party Unit / Route
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: '1', minWidth: '220px' }}>
              <Search />
              <input
                type="text"
                className="form-control"
                placeholder="Search by party unit / destination..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ width: '240px' }}>
              <select
                className="form-control form-select"
                value={partyFilter}
                onChange={(e) => {
                  setPartyFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%' }}
              >
                <option value="">All Parties (View All Units)</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ width: '160px' }}>
              <select
                className="form-control form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%' }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {(partyFilter || search || statusFilter) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearch('');
                  setPartyFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={routes}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          emptyMessage="No unit destinations found for the selected party."
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRoute ? `Edit Party Unit Destination` : 'Add New Party Unit Destination'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">From (Origin)</label>
              <input
                type="text"
                className="form-control"
                disabled
                value="Erode"
                style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                Fixed origin for all dispatches
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">To (Party Unit Name / Destination) *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. PALANI, KUNDASAM, NULLANUR"
                value={formData.to_location}
                onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Distance (KM) (Optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                placeholder="e.g. 85"
                value={formData.distance_km}
                onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
              />
            </div>

            {selectedRoute && (
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Unit / Destination'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
