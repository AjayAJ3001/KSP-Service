import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Edit2, Search, Trash2 } from 'lucide-react';
import { driverService } from '../services/adminService';
import { Driver } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, [page, search]);

  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      const res = await driverService.getDrivers({
        page,
        limit: 10,
        search: search || undefined,
      });
      setDrivers(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load drivers', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Driver name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      if (selectedDriver) {
        await driverService.updateDriver(selectedDriver.id, formData);
      } else {
        await driverService.createDriver(formData);
      }
      setIsModalOpen(false);
      setSelectedDriver(null);
      resetForm();
      loadDrivers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save driver.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDriver = async (driver: Driver) => {
    if (!confirm(`Are you sure you want to delete driver "${driver.name}"?`)) return;
    try {
      await driverService.deleteDriver(driver.id);
      loadDrivers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete driver.');
    }
  };

  const openCreateModal = () => {
    setSelectedDriver(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '' });
    setFormError('');
  };

  const columns: Column<Driver>[] = [
    { header: 'Driver Name', accessor: 'name', render: (d) => <strong>{d.name}</strong> },
    {
      header: 'Created Date',
      accessor: (d) => (d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : '—'),
    },
    {
      header: 'Actions',
      render: (d) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(d)} className="btn btn-outline btn-sm" title="Edit Driver">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteDriver(d)}
            className="btn btn-danger btn-sm"
            title="Delete Driver"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Driver Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain driver profiles and names for trip dispatches
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Driver
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search driver by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={drivers}
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
        title={selectedDriver ? `Edit Driver: ${selectedDriver.name}` : 'Add New Driver'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Driver Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. SIVAKUMAR"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Driver'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

