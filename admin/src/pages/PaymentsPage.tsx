import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Eye, CheckCircle2, History, Search, Trash2 } from 'lucide-react';
import { tripService, paymentService, partyService } from '../services/adminService';
import { Trip, TripPayment, Party } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const PaymentsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [paymentsList, setPaymentsList] = useState<TripPayment[]>([]);

  useEffect(() => {
    loadTrips();
    loadParties();
  }, [page, statusFilter, partyFilter]);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const res = await tripService.getTrips({
        page,
        limit: 10,
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
      });
      setTrips(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load trips', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadParties = async () => {
    try {
      const res = await partyService.getParties({ limit: 100, status: 'ACTIVE' });
      setParties(res.data.items);
    } catch (err) {
      console.error('Failed to load parties', err);
    }
  };

  const openPaymentModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setReceivedAmount(String(trip.balance_due || trip.total_freight));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormError('');
    setIsPaymentModalOpen(true);
  };

  const openHistoryModal = async (trip: Trip) => {
    setSelectedTrip(trip);
    try {
      const res = await paymentService.getTripPayments(trip.id);
      setPaymentsList(res.data);
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error('Failed to load payment history', err);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Are you sure you want to delete this payment receipt?')) return;
    try {
      await paymentService.deletePayment(paymentId);
      if (selectedTrip) {
        const res = await paymentService.getTripPayments(selectedTrip.id);
        setPaymentsList(res.data);
      }
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment receipt.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    const amount = parseFloat(receivedAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid received payment amount > 0.');
      return;
    }

    const currentBalance = parseFloat(String(selectedTrip.balance_due ?? selectedTrip.total_freight));
    if (amount > currentBalance) {
      setFormError(`Payment amount cannot exceed balance due of ₹${currentBalance.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await paymentService.addPayment(selectedTrip.id, {
        received_amount: amount,
        payment_date: paymentDate,
        notes: notes || undefined,
      });

      setIsPaymentModalOpen(false);
      setSelectedTrip(null);
      loadTrips();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculatePreviewBalance = () => {
    if (!selectedTrip) return 0;
    const currentBalance = parseFloat(String(selectedTrip.balance_due ?? selectedTrip.total_freight));
    const paid = parseFloat(receivedAmount) || 0;
    return Math.max(0, currentBalance - paid);
  };

  const columns: Column<Trip>[] = [
    { header: 'Trip ID', accessor: (t) => `#${t.id}` },
    { header: 'Date', accessor: (t) => new Date(t.trip_date).toLocaleDateString('en-IN') },
    { header: 'Party Name', accessor: 'party_name', render: (t) => <strong>{t.party_name}</strong> },
    {
      header: 'Unit Name',
      render: (t) => (
        <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
          {t.to_location || t.from_location}
        </span>
      ),
    },
    { header: 'Total Freight', render: (t) => formatCurrency(t.total_freight) },
    {
      header: 'Received Amount',
      render: (t) => <strong style={{ color: 'var(--success-700)' }}>{formatCurrency(t.total_received || 0)}</strong>,
    },
    {
      header: 'Balance Due',
      render: (t) => (
        <strong style={{ color: (t.balance_due || 0) > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
          {formatCurrency(t.balance_due ?? t.total_freight)}
        </strong>
      ),
    },
    { header: 'Status', accessor: 'status', render: (t) => <StatusBadge status={t.status} /> },
    {
      header: 'Actions',
      render: (t) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {(t.balance_due ?? t.total_freight) > 0 && t.status !== 'CANCELLED' && (
            <button onClick={() => openPaymentModal(t)} className="btn btn-primary btn-sm" title="Collect Payment">
              <CreditCard size={14} /> Collect
            </button>
          )}
          <button onClick={() => openHistoryModal(t)} className="btn btn-outline btn-sm" title="Payment History">
            <History size={14} /> History
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Party Payments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Record customer freight payments, view balance dues & transaction ledger
          </p>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select
              className="form-control form-select"
              style={{ width: '200px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Payment Statuses</option>
              <option value="PAYMENT_PENDING">Pending Payments</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="SETTLED">Fully Settled</option>
            </select>

            <select
              className="form-control form-select"
              style={{ width: '220px' }}
              value={partyFilter}
              onChange={(e) => {
                setPartyFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={trips}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Party Payment for Trip #${selectedTrip?.id}`}
        maxWidth="600px"
      >
        {selectedTrip && (
          <div>
            {formError && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            {/* Trip Context Card */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Party:</span>
                <strong>{selectedTrip.party_name}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Unit / Destination:</span>
                <strong>{selectedTrip.to_location || selectedTrip.from_location}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Freight Billed:</span>
                <strong>{formatCurrency(selectedTrip.total_freight)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Already Received:</span>
                <strong style={{ color: 'var(--success-700)' }}>{formatCurrency(selectedTrip.total_received || 0)}</strong>
              </div>
              <div className="slip-row" style={{ borderTop: '1px solid var(--border-medium)', paddingTop: '8px', marginTop: '6px' }}>
                <span>Current Balance Due:</span>
                <strong style={{ color: 'var(--danger-700)', fontSize: '15px' }}>
                  {formatCurrency(selectedTrip.balance_due ?? selectedTrip.total_freight)}
                </strong>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Received Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    required
                    placeholder="Enter received payment"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Notes / Reference No.</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Bank NEFT #123456 or Cash receipt"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Real-time Calculation Summary */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#fff',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Remaining Balance Due After Payment</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                    {calculatePreviewBalance() === 0 ? 'Full Payment — Status will be SETTLED' : 'Partial Payment'}
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: calculatePreviewBalance() === 0 ? '#10b981' : '#f59e0b' }}>
                  {formatCurrency(calculatePreviewBalance())}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <CheckCircle2 size={16} /> {isSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Payment History for Trip #${selectedTrip?.id}`}
        maxWidth="650px"
      >
        {selectedTrip && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '13.5px' }}>
              <strong>Party:</strong> {selectedTrip.party_name} | <strong>Freight:</strong> {formatCurrency(selectedTrip.total_freight)}
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                    <th>Date</th>
                    <th>Received Amount</th>
                    <th>Remaining Balance</th>
                    <th>Recorded By</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No payments recorded yet for this trip.
                      </td>
                    </tr>
                  ) : (
                    paymentsList.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                        <td style={{ color: 'var(--success-700)', fontWeight: 700 }}>{formatCurrency(p.received_amount)}</td>
                        <td>{formatCurrency(p.balance_due)}</td>
                        <td>{p.created_by_name || 'System User'}</td>
                        <td>{p.notes || '—'}</td>
                        <td>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="btn btn-danger btn-sm"
                            title="Delete Payment Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsHistoryModalOpen(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
