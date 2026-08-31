import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { tripService, expenseService } from '../services/adminService';
import { Trip, DriverExpense } from '../types';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const ExpensesPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [balanceToDriver, setBalanceToDriver] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DriverExpense | null>(null);
  const [formData, setFormData] = useState({
    expense_type: 'LOADING',
    description: '',
    amount: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      loadTripExpenses(Number(selectedTripId));
    } else {
      setExpenses([]);
      setSelectedTrip(null);
      setTotalExpenses(0);
      setAdvancePaid(0);
      setBalanceToDriver(0);
    }
  }, [selectedTripId]);

  const loadTrips = async () => {
    try {
      const res = await tripService.getTrips({ limit: 100 });
      setTrips(res.data.items);
      if (res.data.items.length > 0 && !selectedTripId) {
        setSelectedTripId(String(res.data.items[0].id));
      }
    } catch (err) {
      console.error('Failed to load trips', err);
    }
  };

  const loadTripExpenses = async (tripId: number) => {
    try {
      setIsLoading(true);
      const [expRes, tripRes] = await Promise.all([
        expenseService.getTripExpenses(tripId),
        tripService.getTripById(tripId),
      ]);
      setExpenses(expRes.data.expenses);
      setTotalExpenses(expRes.data.total_expenses);
      setAdvancePaid(expRes.data.advance_paid);
      setBalanceToDriver(expRes.data.balance_to_driver);
      setSelectedTrip(tripRes.data);
    } catch (err) {
      console.error('Failed to load trip expenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) {
      setFormError('Please enter a valid expense amount >= 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      if (editingExpense) {
        await expenseService.updateExpense(editingExpense.id, {
          expense_type: formData.expense_type as any,
          description: formData.description || undefined,
          amount,
        });
      } else {
        await expenseService.addExpense(Number(selectedTripId), {
          expense_type: formData.expense_type,
          description: formData.description || undefined,
          amount,
        });
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      resetForm();
      loadTripExpenses(Number(selectedTripId));
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await expenseService.deleteExpense(id);
      loadTripExpenses(Number(selectedTripId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (exp: DriverExpense) => {
    setEditingExpense(exp);
    setFormData({
      expense_type: exp.expense_type,
      description: exp.description || '',
      amount: String(exp.amount),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      expense_type: 'LOADING',
      description: '',
      amount: '',
    });
    setFormError('');
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Driver Expenses Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Record loading, unloading, toll, food & repair expenses per trip
          </p>
        </div>
        {selectedTrip && (
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={18} /> Add Trip Expense
          </button>
        )}
      </div>

      {/* Select Trip Filter */}
      <div className="card" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>Select Active Trip:</label>
          <select
            className="form-control form-select"
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
          >
            <option value="">-- Choose a Trip --</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                Trip #{t.id} — {t.lorry_number} ({t.driver_name}) | {t.to_location || t.from_location} ({new Date(t.trip_date).toLocaleDateString('en-IN')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTrip && (
        <>
          {/* Trip & Driver Expense Summary KPI Cards */}
          <div className="grid-cols-3" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-icon warning">
                <Wallet size={24} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{formatCurrency(totalExpenses)}</div>
                <div className="stat-label">Total Incurred Expenses</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon info">
                <Wallet size={24} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{formatCurrency(advancePaid)}</div>
                <div className="stat-label">Advance Given to Driver</div>
              </div>
            </div>

            <div
              className="stat-card"
              style={{
                background: balanceToDriver >= 0 ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${balanceToDriver >= 0 ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              <div className={`stat-icon ${balanceToDriver >= 0 ? 'success' : 'danger'}`}>
                <Wallet size={24} />
              </div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: balanceToDriver >= 0 ? '#15803d' : '#b91c1c' }}>
                  {formatCurrency(Math.abs(balanceToDriver))}
                </div>
                <div className="stat-label">
                  {balanceToDriver >= 0 ? 'Net Balance to Pay Driver' : 'Driver Advance Return Due'}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Expense Line Items for Trip #{selectedTrip.id}</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Driver: <strong>{selectedTrip.driver_name}</strong> | Lorry: <strong>{selectedTrip.lorry_number}</strong>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>S.No</th>
                    <th>Expense Category</th>
                    <th>Description / Details</th>
                    <th>Amount (₹)</th>
                    <th>Recorded By</th>
                    <th>Recorded On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No expenses logged for this trip yet. Click "+ Add Trip Expense" above.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp, idx) => (
                      <tr key={exp.id}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>
                          <span className="badge badge-info">{exp.expense_type}</span>
                        </td>
                        <td>{exp.description || '—'}</td>
                        <td style={{ fontWeight: 700, fontSize: '14px' }}>{formatCurrency(exp.amount)}</td>
                        <td>{exp.created_by_name || 'System User'}</td>
                        <td>{exp.created_at ? new Date(exp.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => openEditModal(exp)} className="btn btn-outline btn-sm" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(exp.id)} className="btn btn-danger btn-sm" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Driver Expense' : `Add Expense to Trip #${selectedTrip?.id}`}
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Expense Category Type *</label>
            <select
              className="form-control form-select"
              required
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
            >
              <option value="LOADING">LOADING Expense</option>
              <option value="UNLOADING">UNLOADING Expense</option>
              <option value="TOLL">TOLL Tax</option>
              <option value="FOOD">FOOD Allowance</option>
              <option value="REPAIR">REPAIRS & Maintenance</option>
              <option value="FREIGHT_BASED">FREIGHT BASED Expense</option>
              <option value="OTHER">OTHER Expense</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              required
              placeholder="e.g. 500.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Remarks</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Loading at factory warehouse or Fastag toll"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
