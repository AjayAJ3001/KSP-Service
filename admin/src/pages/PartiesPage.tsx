import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, CheckCircle, XCircle, Search, Trash2 } from 'lucide-react';
import { partyService } from '../services/adminService';
import { Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const PartiesPage: React.FC = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState({ name: '', contact_person: '', mobile_number: '', address: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadParties();
  }, [page, search, statusFilter]);

  const loadParties = async () => {
    try {
      setIsLoading(true);
      const res = await partyService.getParties({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setParties(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load parties', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Party name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      if (selectedParty) {
        await partyService.updateParty(selectedParty.id, formData);
      } else {
        await partyService.createParty(formData);
      }
      setIsModalOpen(false);
      setSelectedParty(null);
      resetForm();
      loadParties();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save party.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (party: Party) => {
    const next = party.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(`Are you sure you want to set party ${party.name} to ${next}?`)) return;
    try {
      await partyService.updateStatus(party.id, next);
      loadParties();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteParty = async (party: Party) => {
    if (!confirm(`Are you sure you want to delete party "${party.name}"?`)) return;
    try {
      await partyService.deleteParty(party.id);
      loadParties();
    } catch (err: any) {
      alert(err.message || 'Failed to delete party.');
    }
  };

  const openCreateModal = () => {
    setSelectedParty(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (party: Party) => {
    setSelectedParty(party);
    setFormData({
      name: party.name,
      contact_person: party.contact_person || '',
      mobile_number: party.mobile_number || '',
      address: party.address || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', contact_person: '', mobile_number: '', address: '' });
    setFormError('');
  };

  const columns: Column<Party>[] = [
    { header: 'Party Name', accessor: 'name', render: (p) => <strong>{p.name}</strong> },
    { header: 'Contact Person', accessor: (p) => p.contact_person || '—' },
    { header: 'Mobile Number', accessor: (p) => p.mobile_number || '—' },
    { header: 'Address', accessor: (p) => p.address || '—' },
    {
      header: 'Created Date',
      accessor: (p) => (p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'),
    },
    {
      header: 'Actions',
      render: (p) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openEditModal(p)} className="btn btn-outline btn-sm" title="Edit Party">
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteParty(p)}
            className="btn btn-danger btn-sm"
            title="Delete Party"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Party Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Maintain customer & client companies, contacts, billing details & addresses
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} /> Add New Party
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by party name, contact person, phone..."
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
          data={parties}
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
        title={selectedParty ? `Edit Party: ${selectedParty.name}` : 'Add New Party'}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Party Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. ABC Trading Co"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Arun Kumar"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Enter full billing / office address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Party'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
