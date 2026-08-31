import React, { useState } from 'react';
import { UserCircle, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/adminService';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError('Please fill in current and new password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await authService.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Account Profile & Security</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Manage your administrator profile details and update account access credentials
          </p>
        </div>
      </div>

      <div className="grid-cols-2">
        {/* Profile Card */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCircle size={20} /> Administrator Information
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 800,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 700 }}>{user?.name}</h4>
              <div style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>@{user?.username}</div>
              <span className="badge badge-primary" style={{ marginTop: '4px' }}>{user?.role}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <div className="slip-row" style={{ border: 'none' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email Address:</span>
              <strong>{user?.email || '—'}</strong>
            </div>
            <div className="slip-row" style={{ border: 'none' }}>
              <span style={{ color: 'var(--text-muted)' }}>Mobile Number:</span>
              <strong>{user?.mobile_number || '—'}</strong>
            </div>
            <div className="slip-row" style={{ border: 'none' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Status:</span>
              <strong style={{ color: 'var(--success-700)' }}>ACTIVE</strong>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} /> Change Password
          </h3>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}

          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                className="form-control"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

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

            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                className="form-control"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
