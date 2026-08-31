import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Key, CheckCircle, XCircle, UserPlus, Search, Trash2 } from 'lucide-react';
import { userService, driverService } from '../services/adminService';
import { User, Driver } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    email: '',
    mobile_number: '',
    role: 'MANAGER' as 'ADMIN' | 'MANAGER' | 'TRANSPORT_USER',
    driver_id: '' as string | number,
    editPassword: '', // optional new password on edit
  });

  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
    loadDrivers();
  }, [page, search, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await userService.getUsers({
        page,
        limit: 10,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await driverService.getDrivers({ limit: 100, status: 'ACTIVE' });
      setDrivers(res.data.items);
    } catch (err) {
      console.error('Failed to load drivers', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.password || !formData.role) {
      setFormError('Username, full name, password and role are required.');
      return;
    }
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await userService.createUser({
        ...formData,
        driver_id: formData.driver_id ? Number(formData.driver_id) : undefined,
      });
      setIsCreateModalOpen(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!formData.name || !formData.role) {
      setFormError('Full name and role are required.');
      return;
    }
    if (formData.editPassword && formData.editPassword.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await userService.updateUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        mobile_number: formData.mobile_number,
        role: formData.role,
        driver_id: formData.driver_id ? Number(formData.driver_id) : undefined,
      });
      // If admin also typed a new password, reset it inline
      if (formData.editPassword.trim()) {
        await userService.resetPassword(selectedUser.id, formData.editPassword.trim());
      }
      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newPassword || newPassword.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await userService.resetPassword(selectedUser.id, newPassword);
      setIsResetPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      alert('Password has been successfully reset.');
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(`Are you sure you want to ${nextStatus === 'ACTIVE' ? 'activate' : 'deactivate'} user ${user.username}?`)) {
      return;
    }
    try {
      await userService.updateStatus(user.id, nextStatus);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await userService.deleteUser(user.id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      password: '',
      email: user.email || '',
      mobile_number: user.mobile_number || '',
      role: user.role,
      driver_id: user.driver_id || '',
      editPassword: '',
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setFormError('');
    setIsResetPasswordModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      name: '',
      password: '',
      email: '',
      mobile_number: '',
      role: 'MANAGER',
      driver_id: '',
      editPassword: '',
    });
    setFormError('');
  };

  const columns: Column<User>[] = [
    {
      header: 'Username',
      accessor: 'username',
      render: (u) => <strong>{u.username}</strong>,
    },
    { header: 'Full Name', accessor: 'name' },
    {
      header: 'Role',
      accessor: 'role',
      render: (u) => (
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 700,
            background: u.role === 'ADMIN' ? '#e0e7ff' : u.role === 'MANAGER' ? '#fef3c7' : '#e0f2fe',
            color: u.role === 'ADMIN' ? '#3730a3' : u.role === 'MANAGER' ? '#92400e' : '#0369a1',
          }}
        >
          {u.role}
        </span>
      ),
    },
    { header: 'Mobile', accessor: (u) => u.mobile_number || '—' },
    {
      header: 'Status',
      accessor: 'status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      header: 'Last Login',
      accessor: (u) => (u.last_login ? new Date(u.last_login).toLocaleString('en-IN') : 'Never'),
    },
    {
      header: 'Actions',
      render: (u) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => openEditModal(u)}
            className="btn btn-outline btn-sm"
            title="Edit User"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => openResetPasswordModal(u)}
            className="btn btn-outline btn-sm"
            title="Reset Password"
          >
            <Key size={14} />
          </button>
          <button
            onClick={() => handleDeleteUser(u)}
            className="btn btn-danger btn-sm"
            title="Delete User"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>User Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Create and maintain Admin & Mobile Transport Operator user credentials
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <UserPlus size={18} /> Create New User
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by username, name, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <select
              className="form-control form-select"
              style={{ width: '160px' }}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="TRANSPORT_USER">TRANSPORT_USER</option>
            </select>

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
        </div>

        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New User"
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. jdoe or driver_rajan"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. Rajan Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password * (Min 6 characters)</label>
            <input
              type="password"
              className="form-control"
              required
              placeholder="Enter secure initial password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="optional@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select
                className="form-control form-select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="MANAGER">MANAGER (Fleet Manager)</option>
                <option value="ADMIN">ADMIN (Full Access)</option>
                <option value="TRANSPORT_USER">TRANSPORT_USER (Mobile App)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assign Driver (Optional)</label>
              <select
                className="form-control form-select"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
              >
                <option value="">None / Not a Driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.mobile_number || 'No Phone'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.username}`}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleEdit}>

          {/* Username (read-only) */}
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              disabled
              value={formData.username}
              style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700, color: '#475569' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
              Username cannot be changed
            </span>
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-control"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Role *</label>
            <select
              className="form-control form-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <option value="MANAGER">MANAGER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="TRANSPORT_USER">TRANSPORT_USER</option>
            </select>
          </div>

          {/* Optional New Password */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>New Password (Optional)</span>
              <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)' }}>Leave blank to keep existing password</span>
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter new password (min 6 characters)"
              value={formData.editPassword}
              onChange={(e) => setFormData({ ...formData, editPassword: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={`Reset Password for ${selectedUser?.username}`}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label className="form-label">New Password * (Min 6 characters)</label>
            <input
              type="password"
              className="form-control"
              required
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
