import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit2, Search, Trash2 } from 'lucide-react';
import { ownerService } from '../services/adminService';
import { Owner } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';

export const OwnersPage: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile_number: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const LIMIT = 10;

  useEffect(() => {
    loadOwners();
  }, [page, search]);

  const loadOwners = async () => {
    try {
      setIsLoading(true);
      const res = await ownerService.getOwners({ page, limit: LIMIT, search: search || undefined });
      if (res.success) {
        setOwners(res.data.items);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load owners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedOwner(null);
    setFormData({ name: '', mobile_number: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (owner: Owner) => {
    setSelectedOwner(owner);
    setFormData({ name: owner.name, mobile_number: owner.mobile_number || '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', mobile_number: '' });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Owner name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = { name: formData.name.trim(), mobile_number: formData.mobile_number.trim() || undefined };

      if (selectedOwner) {
        await ownerService.updateOwner(selectedOwner.id, payload);
      } else {
        await ownerService.createOwner(payload);
      }

      setIsModalOpen(false);
      resetForm();
      setPage(1);
      loadOwners();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Failed to save owner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (owner: Owner) => {
    if (!window.confirm(`Delete owner "${owner.name}"? This action cannot be undone.`)) return;
    try {
      await ownerService.deleteOwner(owner.id);
      loadOwners();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete owner.');
    }
  };

  const columns: Column<Owner>[] = [
    { header: 'Owner Name', accessor: 'name', render: (o) => <strong>{o.name}</strong> },
    { header: 'Mobile Number', accessor: (o) => o.mobile_number || '—' },
    {
      header: 'Created Date',
      accessor: (o) => (o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'),
    },
    {
      header: 'Actions',
      render: (o) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(o)} className="btn btn-outline btn-sm" title="Edit Owner">
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleDelete(o)} className="btn btn-danger btn-sm" title="Delete Owner">
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Owner Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Manage vehicle and asset owners for KSP Transport
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Owner
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '340px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search owners by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input"
            style={{ paddingLeft: '38px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={owners}
          isLoading={isLoading}
          page={page}
          limit={LIMIT}
          total={total}
          onPageChange={setPage}
          emptyMessage="No owners found. Add your first owner using the button above."
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={selectedOwner ? 'Edit Owner' : 'Add New Owner'}
        maxWidth="500px"
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Owner Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="input"
              placeholder="e.g. K.S. PALANISAMY"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. 9876543210"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : selectedOwner ? 'Update Owner' : 'Add Owner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
