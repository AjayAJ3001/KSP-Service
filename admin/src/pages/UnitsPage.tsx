import React, { useState, useEffect } from 'react';
import { Scale, Plus, Edit2, Trash2 } from 'lucide-react';
import { unitService } from '../services/adminService';
import { Unit } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const UnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({ name: '', abbreviation: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setIsLoading(true);
      const res = await unitService.getUnits();
      setUnits(res.data);
    } catch (err) {
      console.error('Failed to load units', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Unit name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      if (selectedUnit) {
        await unitService.updateUnit(selectedUnit.id, formData);
      } else {
        await unitService.createUnit(formData);
      }
      setIsModalOpen(false);
      setSelectedUnit(null);
      setFormData({ name: '', abbreviation: '', status: 'ACTIVE' });
      loadUnits();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(`Are you sure you want to delete unit "${unit.name}"?`)) return;
    try {
      await unitService.deleteUnit(unit.id);
      loadUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to delete unit.');
    }
  };

  const openCreateModal = () => {
    setSelectedUnit(null);
    setFormData({ name: '', abbreviation: '', status: 'ACTIVE' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (unit: Unit) => {
    setSelectedUnit(unit);
    setFormData({
      name: unit.name,
      abbreviation: unit.abbreviation || '',
      status: unit.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const columns: Column<Unit>[] = [
    { header: 'Unit Name', accessor: 'name', render: (u) => <strong>{u.name}</strong> },
    { header: 'Abbreviation', accessor: (u) => u.abbreviation || '—' },
    { header: 'Status', accessor: 'status', render: (u) => <StatusBadge status={u.status} /> },
    { header: 'Created Date', accessor: (u) => new Date(u.created_at).toLocaleDateString('en-IN') },
    {
      header: 'Actions',
      render: (u) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(u)} className="btn btn-outline btn-sm" title="Edit">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteUnit(u)}
            className="btn btn-danger btn-sm"
            title="Delete Unit"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Unit Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain freight measurement units (Tons, Bags, Quintals, Loads)
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Unit
        </button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={units}
          isLoading={isLoading}
          total={units.length}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUnit ? `Edit Unit: ${selectedUnit.name}` : 'Add New Unit'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Unit Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. Tons, Bags, Quintals"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Abbreviation (Symbol)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. T, Bags, QTL, Ld"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
            />
          </div>

          {selectedUnit && (
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
              {isSubmitting ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
