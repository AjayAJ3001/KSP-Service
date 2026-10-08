import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, History, Trash2, Download, Printer, Calendar, RefreshCw, Clock } from 'lucide-react';
import { tripService, paymentService, partyService, vehicleService, routeService } from '../services/adminService';
import { Trip, TripPayment, Party, Vehicle, Route } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';
import { OverduePaymentAlertModal } from '../components/Common/OverduePaymentAlertModal';

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getThisWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(start), to: fmt(end) };
}

export const PaymentsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Overdue payment alert
  const [isOverdueAlertOpen, setIsOverdueAlertOpen] = useState(false);

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

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  const loadLookups = async () => {
    try {
      const [pRes, vRes, rRes] = await Promise.all([
        partyService.getParties({ limit: 200, status: 'ACTIVE' }),
        vehicleService.getVehicles({ limit: 200, status: 'ACTIVE' }),
        routeService.getRoutes({ limit: 500, status: 'ACTIVE' }),
      ]);
      setParties(pRes.data.items || (Array.isArray(pRes.data) ? pRes.data : []));
      setVehicles(vRes.data.items || (Array.isArray(vRes.data) ? vRes.data : []));
      setRoutes(rRes.data.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await tripService.getTrips({
        page,
        limit: 10,
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setTrips(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load trips', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, partyFilter, vehicleFilter, routeFilter, fromDate, toDate]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleThisWeekClick = () => {
    if (isThisWeekActive) {
      setFromDate('');
      setToDate('');
    } else {
      setFromDate(thisWeek.from);
      setToDate(thisWeek.to);
    }
    setPage(1);
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setPartyFilter('');
    setVehicleFilter('');
    setRouteFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const openPaymentModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setReceivedAmount(String(trip.balance_due ?? trip.total_freight));
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
    if (amount > currentBalance + 0.01) {
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

  // Full CSV Export of all matching records
  const handleDownloadFiltered = async () => {
    try {
      setIsDownloading(true);
      const res = await tripService.getTrips({
        page: 1,
        limit: 10000,
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        route_id: routeFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      const items = res.data.items || [];
      const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'All';
      downloadCSV(
        `Party_Payments_${dateTag}.csv`,
        [
          'S.No',
          'Trip ID',
          'Date',
          'Party Name',
          'Unit / Destination',
          'Lorry Number',
          'Total Freight (INR)',
          'Received Amount (INR)',
          'Balance Due (INR)',
          'Payment Status',
          'Trip Status',
        ],
        items.map((t, idx) => [
          idx + 1,
          `#${t.id}`,
          formatDateDMY(t.trip_date),
          t.party_name || '',
          t.to_location || t.from_location || '',
          t.lorry_number || '',
          (parseFloat(String(t.total_freight)) || 0).toFixed(2),
          (parseFloat(String(t.total_received || 0)) || 0).toFixed(2),
          (parseFloat(String(t.balance_due ?? t.total_freight)) || 0).toFixed(2),
          Number(t.balance_due ?? t.total_freight) <= 0
            ? 'Fully Paid'
            : Number(t.total_received) > 0
            ? 'Partially Paid'
            : 'Pending',
          t.status || '',
        ])
      );
    } catch (err) {
      console.error('Failed to download payments CSV', err);
      alert('Failed to download CSV report.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Single-row CSV export
  const handleDownloadSingleTrip = (t: Trip) => {
    const filename = `Party_Payment_Trip_${t.id}_${(t.party_name || 'party').replace(/[^a-zA-Z0-9]/g, '_')}_${formatDateDMY(t.trip_date)}.csv`;
    downloadCSV(
      filename,
      [
        'Trip ID',
        'Date',
        'Party Name',
        'Unit / Destination',
        'Lorry Number',
        'Total Freight (INR)',
        'Received Amount (INR)',
        'Balance Due (INR)',
        'Payment Status',
        'Trip Status',
      ],
      [[
        `#${t.id}`,
        formatDateDMY(t.trip_date),
        t.party_name || '',
        t.to_location || t.from_location || '',
        t.lorry_number || '',
        (parseFloat(String(t.total_freight)) || 0).toFixed(2),
        (parseFloat(String(t.total_received || 0)) || 0).toFixed(2),
        (parseFloat(String(t.balance_due ?? t.total_freight)) || 0).toFixed(2),
        Number(t.balance_due ?? t.total_freight) <= 0
          ? 'Fully Paid'
          : Number(t.total_received) > 0
          ? 'Partially Paid'
          : 'Pending',
        t.status || '',
      ]]
    );
  };

  const columns: Column<Trip>[] = [
    { header: 'Trip ID', accessor: (t) => `#${t.id}` },
    { header: 'Date', accessor: (t) => formatDateDMY(t.trip_date) },
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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(t.balance_due ?? t.total_freight) > 0 && t.status !== 'CANCELLED' && (
            <button onClick={() => openPaymentModal(t)} className="btn btn-primary btn-sm" title="Collect Payment">
              <CreditCard size={14} /> Collect
            </button>
          )}
          <button onClick={() => openHistoryModal(t)} className="btn btn-outline btn-sm" title="Payment History">
            <History size={14} /> History
          </button>
          <button
            onClick={() => handleDownloadSingleTrip(t)}
            className="btn btn-outline btn-sm"
            style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Download this record (CSV)"
          >
            <Download size={13} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>CSV</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Overdue Payment Alert Modal ───────────────────────── */}
      <OverduePaymentAlertModal
        isOpenManually={isOverdueAlertOpen || undefined}
        onCloseManual={() => setIsOverdueAlertOpen(false)}
      />
      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Party Payments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Record customer freight payments, view balance dues &amp; transaction ledger
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsOverdueAlertOpen(true)}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#d97706', color: '#b45309' }}
            title="View overdue payments (pending 30+ days)"
          >
            <Clock size={16} /> Overdue Alerts
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={handleDownloadFiltered}
            disabled={isDownloading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} /> {isDownloading ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* ── Professional Unified Filter Toolbar (Matching Report Master) ─── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Top Control Line: Date Range + This Week Quick Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>
              Filter by Date:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleThisWeekClick}
            className={`btn btn-sm ${isThisWeekActive ? 'btn-primary' : 'btn-outline'}`}
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px',
              flexShrink: 0,
            }}
            title="Filter by current week"
          >
            <Calendar size={14} />
            This Week
          </button>
        </div>

        {/* Bottom Control Line: Entity Filters (Party, Truck, Unit, Payment Status, Reset) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '14px',
          }}
        >
          {/* Party Wise */}
          <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
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

          {/* Truck Wise */}
          <div style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={vehicleFilter}
              onChange={(e) => {
                setVehicleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Vehicle Numbers</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lorry_number}
                </option>
              ))}
            </select>
          </div>

          {/* Party Delivery Unit (Route) Filter */}
          <div style={{ flex: '1 1 160px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={routeFilter}
              onChange={(e) => {
                setRouteFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Units</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.to_location}{r.party_name ? ` (${r.party_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div style={{ flex: '1 1 170px', minWidth: '150px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
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
          </div>

          {/* Reset Filters Button */}
          <button
            type="button"
            onClick={resetFilters}
            className="btn btn-outline"
            style={{ height: '38px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Reset all filters"
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="card">
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
                  <DateField
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
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
                    Remaining Balance Due After Payment
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                    {calculatePreviewBalance() === 0 ? 'Full Payment — Status will be SETTLED' : 'Partial Payment'}
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>
                  {formatCurrency(calculatePreviewBalance())}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Payment'}
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
        <div>
          {paymentsList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No payments recorded yet for this trip.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Remaining</th>
                    <th>Collected By</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateDMY(p.payment_date)}</td>
                      <td style={{ color: 'var(--success-700)', fontWeight: 700 }}>
                        {formatCurrency(p.received_amount)}
                      </td>
                      <td>{formatCurrency(p.balance_due)}</td>
                      <td>{p.created_by_name || 'Admin'}</td>
                      <td>{p.notes || '—'}</td>
                      <td>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--danger-700)', padding: '4px 8px' }}
                          title="Delete payment record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
