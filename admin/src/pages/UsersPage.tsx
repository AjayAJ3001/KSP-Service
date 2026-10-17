import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Key, CheckCircle, XCircle, UserPlus, Search, Trash2, Printer, Download, Loader2 } from 'lucide-react';
import { userService, driverService } from '../services/adminService';
import { User, Driver } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatIST } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  const handlePrintUsers = async () => {
    try {
      setIsPrinting(true);
      const res = await userService.getUsers({
        limit: 10000,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      const items: User[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No user accounts found to print.');
        setIsPrinting(false);
        return;
      }

      const totalCount = items.length;
      const activeCount = items.filter(u => u.status === 'ACTIVE').length;
      const adminCount = items.filter(u => u.role === 'ADMIN').length;
      const managerCount = items.filter(u => u.role === 'MANAGER').length;
      const operatorCount = items.filter(u => u.role === 'TRANSPORT_USER').length;
      const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KSP Transport - User Management Directory</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; font-size: 12px; }
    @page { size: portrait; margin: 12mm; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; margin: 0 0 4px 0; }
    .report-subtitle { font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-text { font-size: 11px; color: #64748b; margin: 0; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .card-box { padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11.5px; }
    .card-box strong { font-size: 14px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 6px; }
    th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 11px; }
    th.center, td.center { text-align: center; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-align: center; }
    .badge-admin { background: #e0e7ff; color: #3730a3; }
    .badge-manager { background: #fef3c7; color: #92400e; }
    .badge-operator { background: #e0f2fe; color: #0369a1; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
    .footer-row td { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
    .print-btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 14px; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">Print Report / Save as PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">Close</button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="company-title">KSP TRANSPORT</h1>
      <div class="report-subtitle">User Management Directory</div>
      <p class="meta-text">System users, access roles, and credential status</p>
    </div>
    <div style="text-align: right;">
      <p class="meta-text"><strong>Generated On:</strong> ${generatedAt}</p>
      <p class="meta-text"><strong>Total Users:</strong> ${totalCount}</p>
      ${roleFilter ? `<p class="meta-text"><strong>Role:</strong> ${roleFilter}</p>` : ''}
      ${statusFilter ? `<p class="meta-text"><strong>Status:</strong> ${statusFilter}</p>` : ''}
    </div>
  </div>

  <div class="summary-cards">
    <div class="card-box">Total Users: <strong>${totalCount}</strong></div>
    <div class="card-box">Admins: <strong style="color:#4338ca">${adminCount}</strong></div>
    <div class="card-box">Managers: <strong style="color:#d97706">${managerCount}</strong></div>
    <div class="card-box">Operators: <strong style="color:#0284c7">${operatorCount}</strong></div>
    <div class="card-box">Active: <strong style="color:#16a34a">${activeCount}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45px;" class="center">S.No</th>
        <th>Username</th>
        <th>Full Name</th>
        <th class="center">Role</th>
        <th>Mobile Number</th>
        <th>Email</th>
        <th class="center">Status</th>
        <th>Last Login</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((u, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong style="color: #0f172a; font-family: monospace;">${u.username}</strong></td>
          <td>${u.name || '—'}</td>
          <td class="center">
            <span class="badge ${u.role === 'ADMIN' ? 'badge-admin' : u.role === 'MANAGER' ? 'badge-manager' : 'badge-operator'}">
              ${u.role}
            </span>
          </td>
          <td>${u.mobile_number || '—'}</td>
          <td>${u.email || '—'}</td>
          <td class="center">
            <span class="badge ${u.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">
              ${u.status}
            </span>
          </td>
          <td style="font-size: 11px; color: #64748b;">${u.last_login ? formatIST(u.last_login) : 'Never'}</td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td class="center" colspan="2">TOTAL USERS</td>
        <td colspan="5"><strong>${totalCount} Users (${activeCount} Active, ${totalCount - activeCount} Inactive)</strong></td>
        <td class="center"><strong>${totalCount} Accounts</strong></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
    <span>KSP Service Management ERP · User Management</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>
      `;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        alert('Please allow pop-ups for this website to print.');
        setIsPrinting(false);
        return;
      }
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
    } catch (err: any) {
      console.error('Failed to print users', err);
      alert(err.message || 'Failed to print users list.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await userService.getUsers({
        limit: 10000,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      const items: User[] = res?.data?.items || [];
      if (items.length === 0) {
        alert('No user records found to export.');
        setIsExporting(false);
        return;
      }

      const excelRows: any[] = items.map((u, idx) => ({
        'S.No': idx + 1,
        'Username': u.username,
        'Full Name': u.name || '—',
        'Role': u.role,
        'Mobile Number': u.mobile_number || '—',
        'Email': u.email || '—',
        'Status': u.status,
        'Last Login': u.last_login ? formatIST(u.last_login) : 'Never',
      }));

      // Blank separator
      excelRows.push({
        'S.No': '',
        'Username': '',
        'Full Name': '',
        'Role': '',
        'Mobile Number': '',
        'Email': '',
        'Status': '',
        'Last Login': '',
      });

      // Total row
      excelRows.push({
        'S.No': '',
        'Username': 'TOTAL USERS',
        'Full Name': `Count: ${items.length}`,
        'Role': `Admins: ${items.filter(u => u.role === 'ADMIN').length}, Managers: ${items.filter(u => u.role === 'MANAGER').length}`,
        'Mobile Number': `Active: ${items.filter(u => u.status === 'ACTIVE').length}`,
        'Email': '',
        'Status': `Total: ${items.length}`,
        'Last Login': '',
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 18 }, // Username
        { wch: 24 }, // Full Name
        { wch: 18 }, // Role
        { wch: 18 }, // Mobile Number
        { wch: 24 }, // Email
        { wch: 12 }, // Status
        { wch: 22 }, // Last Login
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `KSP_Users_List_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export users', err);
      alert(err.message || 'Failed to export users.');
    } finally {
      setIsExporting(false);
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
      accessor: (u) => (u.last_login ? formatIST(u.last_login) : 'Never'),
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

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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

            {(search || roleFilter || statusFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
                className="btn btn-outline"
                style={{ height: '38px', padding: '0 14px', fontSize: '13px' }}
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrintUsers}
              disabled={isPrinting}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff',
                fontWeight: 600,
                height: '38px',
                padding: '0 14px',
                fontSize: '13px',
              }}
              title="Print User Management Directory"
            >
              {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {isPrinting ? 'Preparing...' : 'Print'}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#10b981',
                color: '#059669',
                background: '#ecfdf5',
                fontWeight: 600,
                height: '38px',
                padding: '0 14px',
                fontSize: '13px',
              }}
              title="Download Users List as Excel"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExporting ? 'Exporting...' : 'Download'}
            </button>
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
