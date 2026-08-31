import React, { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Search, Trash2 } from 'lucide-react';
import { vehicleService } from '../services/adminService';
import { Vehicle } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

export const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    lorry_number: '',
    goodshed_loading_expense: '',
    vehicle_type: '',
    capacity_tons: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, [page, search]);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await vehicleService.getVehicles({
        page,
        limit: 10,
        search: search || undefined,
      });
      setVehicles(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load vehicles', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lorry_number.trim()) {
      setFormError('Lorry number is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        lorry_number: formData.lorry_number.trim().toUpperCase(),
        goodshed_loading_expense: formData.goodshed_loading_expense ? parseFloat(formData.goodshed_loading_expense) : 0,
        vehicle_type: formData.vehicle_type || undefined,
        capacity_tons: formData.capacity_tons ? parseFloat(formData.capacity_tons) : undefined,
      };

      if (selectedVehicle) {
        await vehicleService.updateVehicle(selectedVehicle.id, payload);
      } else {
        await vehicleService.createVehicle(payload);
      }
      setIsModalOpen(false);
      setSelectedVehicle(null);
      resetForm();
      loadVehicles();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    if (!confirm(`Are you sure you want to delete truck/lorry "${vehicle.lorry_number}"?`)) return;
    try {
      await vehicleService.deleteVehicle(vehicle.id);
      loadVehicles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete vehicle.');
    }
  };

  const openCreateModal = () => {
    setSelectedVehicle(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      lorry_number: vehicle.lorry_number,
      goodshed_loading_expense: vehicle.goodshed_loading_expense !== undefined ? String(vehicle.goodshed_loading_expense) : '0',
      vehicle_type: vehicle.vehicle_type || '',
      capacity_tons: vehicle.capacity_tons ? String(vehicle.capacity_tons) : '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ lorry_number: '', goodshed_loading_expense: '', vehicle_type: '', capacity_tons: '' });
    setFormError('');
  };

  const formatCurrency = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: Column<Vehicle>[] = [
    {
      header: 'Lorry / Truck Number',
      accessor: 'lorry_number',
      render: (v) => <strong>{v.lorry_number}</strong>,
    },
    {
      header: 'Goodshed Loading Expense (₹)',
      accessor: 'goodshed_loading_expense',
      render: (v) => (
        <span style={{ fontWeight: 700, color: 'var(--accent-hover)', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}>
          {formatCurrency(v.goodshed_loading_expense)}
        </span>
      ),
    },
    {
      header: 'Created Date',
      accessor: (v) => (v.created_at ? new Date(v.created_at).toLocaleDateString('en-IN') : '—'),
    },
    {
      header: 'Actions',
      render: (v) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(v)} className="btn btn-outline btn-sm" title="Edit Vehicle">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteVehicle(v)}
            className="btn btn-danger btn-sm"
            title="Delete Vehicle"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Truck / Lorry Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain fleet trucks, registration numbers & Goodshed Loading Expenses
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Truck
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by truck / lorry number..."
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
          data={vehicles}
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
        title={selectedVehicle ? `Edit Truck: ${selectedVehicle.lorry_number}` : 'Add New Truck'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Lorry / Truck Number *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. TN 33 U 5619"
              value={formData.lorry_number}
              onChange={(e) => setFormData({ ...formData, lorry_number: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Goodshed Loading Expense (₹) *</label>
            <input
              type="number"
              step="1"
              min="0"
              required
              className="form-control"
              placeholder="e.g. 500 or 1000 or 1280"
              value={formData.goodshed_loading_expense}
              onChange={(e) => setFormData({ ...formData, goodshed_loading_expense: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Truck'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
