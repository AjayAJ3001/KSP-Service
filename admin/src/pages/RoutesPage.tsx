import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Search, Trash2 } from 'lucide-react';
import { routeService } from '../services/adminService';
import { Route } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState({ from_location: '', to_location: '', distance_km: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, [page, search, statusFilter]);

  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      const res = await routeService.getRoutes({
        page,
        limit: 10,
        search: search || undefined,
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
    if (!formData.from_location.trim() || !formData.to_location.trim()) {
      setFormError('Both From and To locations are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        from_location: formData.from_location.trim(),
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
      setFormData({ from_location: '', to_location: '', distance_km: '', status: 'ACTIVE' });
      loadRoutes();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save route.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm(`Are you sure you want to delete route "${route.from_location} → ${route.to_location}"?`)) return;
    try {
      await routeService.deleteRoute(route.id);
      loadRoutes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete route.');
    }
  };

  const openCreateModal = () => {
    setSelectedRoute(null);
    setFormData({ from_location: '', to_location: '', distance_km: '', status: 'ACTIVE' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (route: Route) => {
    setSelectedRoute(route);
    setFormData({
      from_location: route.from_location,
      to_location: route.to_location,
      distance_km: route.distance_km ? String(route.distance_km) : '',
      status: route.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const columns: Column<Route>[] = [
    {
      header: 'Route (From → To)',
      render: (r) => (
        <strong>
          {r.from_location} → {r.to_location}
        </strong>
      ),
    },
    { header: 'From Origin', accessor: 'from_location' },
    { header: 'To Destination', accessor: 'to_location' },
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Route Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain origin to destination transport routes & distances
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Route
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by origin or destination..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="form-control form-select"
            style={{ width: '150px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={routes}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRoute ? `Edit Route` : 'Add New Route'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">From (Origin) *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. Chennai"
                value={formData.from_location}
                onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">To (Destination) *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. Coimbatore"
                value={formData.to_location}
                onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Distance (KM)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                placeholder="e.g. 498"
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
              {isSubmitting ? 'Saving...' : 'Save Route'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
