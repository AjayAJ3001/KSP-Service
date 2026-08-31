import React, { useState, useEffect } from 'react';
import { FileCheck, CheckCircle, Printer, Eye, Search, PlusCircle, Trash2 } from 'lucide-react';
import { settlementService, tripService } from '../services/adminService';
import { Settlement, Trip } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const SettlementsPage: React.FC = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [unsettledTrips, setUnsettledTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [selectedTripToSettle, setSelectedTripToSettle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSettlements();
    loadUnsettledTrips();
  }, [page, statusFilter]);

  const loadSettlements = async () => {
    try {
      setIsLoading(true);
      const res = await settlementService.getSettlements({
        page,
        limit: 10,
        status: statusFilter || undefined,
      });
      setSettlements(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load settlements', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnsettledTrips = async () => {
    try {
      const res = await tripService.getTrips({ limit: 100 });
      // Show trips not yet settled
      const eligible = res.data.items.filter((t) => t.status !== 'SETTLED' && t.status !== 'CANCELLED');
      setUnsettledTrips(eligible);
    } catch (err) {
      console.error('Failed to load unsettled trips', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripToSettle) return;

    try {
      setIsSubmitting(true);
      await settlementService.generateSettlement(parseInt(selectedTripToSettle));
      setIsGenerateModalOpen(false);
      setSelectedTripToSettle('');
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to generate settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (id: number) => {
    if (!confirm('Are you sure you want to mark this settlement as VERIFIED?')) return;
    try {
      await settlementService.verifySettlement(id);
      loadSettlements();
    } catch (err: any) {
      alert(err.message || 'Failed to verify settlement.');
    }
  };

  const handleDeleteSettlement = async (settlement: Settlement) => {
    if (!confirm(`Are you sure you want to delete Settlement #${settlement.id} for Trip #${settlement.trip_id}?`)) return;
    try {
      await settlementService.deleteSettlement(settlement.id);
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete settlement.');
    }
  };

  const openSlipModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setIsSlipModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: Column<Settlement>[] = [
    {
      header: 'Settlement ID',
      accessor: (s) => <strong>#{s.id}</strong>,
    },
    {
      header: 'Trip & Lorry',
      accessor: 'lorry_number',
      render: (s) => (
        <div>
          <strong>Trip #{s.trip_id}</strong> — {s.lorry_number}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {s.driver_name} | <span style={{ fontWeight: 600, color: '#1e40af' }}>{s.to_location || s.from_location}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Trip Date',
      accessor: (s) => (s.trip_date ? new Date(s.trip_date).toLocaleDateString('en-IN') : '—'),
    },
    { header: 'Total Freight', render: (s) => formatCurrency(s.total_freight) },
    { header: 'Total Expenses', render: (s) => formatCurrency(s.total_expenses) },
    { header: 'Advance Paid', render: (s) => formatCurrency(s.advance_paid) },
    {
      header: 'Balance to Driver',
      render: (s) => (
        <strong style={{ color: s.balance_to_driver >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
          {formatCurrency(s.balance_to_driver)}
        </strong>
      ),
    },
    { header: 'Status', accessor: 'settlement_status', render: (s) => <StatusBadge status={s.settlement_status} /> },
    {
      header: 'Actions',
      render: (s) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openSlipModal(s)} className="btn btn-outline btn-sm" title="View Settlement Slip">
            <Eye size={14} /> Slip
          </button>
          {s.settlement_status === 'PENDING' && (
            <button onClick={() => handleVerify(s.id)} className="btn btn-primary btn-sm" title="Verify Settlement">
              <CheckCircle size={14} /> Verify
            </button>
          )}
          <button
            onClick={() => handleDeleteSettlement(s)}
            className="btn btn-danger btn-sm"
            title="Delete Settlement"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Trip Settlements</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Generate final trip settlement slips, audit driver balances & print settlement vouchers
          </p>
        </div>
        <button onClick={() => setIsGenerateModalOpen(true)} className="btn btn-primary">
          <PlusCircle size={18} /> Settle Trip
        </button>
      </div>

      <div className="card">
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <select
            className="form-control form-select"
            style={{ width: '180px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Settlement Statuses</option>
            <option value="PENDING">PENDING Verification</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={settlements}
          isLoading={isLoading}
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
        />
      </div>

      {/* Settle Trip Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Trip Settlement"
      >
        <form onSubmit={handleGenerate}>
          <div className="form-group">
            <label className="form-label">Select Trip to Settle *</label>
            <select
              className="form-control form-select"
              required
              value={selectedTripToSettle}
              onChange={(e) => setSelectedTripToSettle(e.target.value)}
            >
              <option value="">-- Choose a Trip --</option>
              {unsettledTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  Trip #{t.id} — {t.lorry_number} ({t.driver_name}) | {t.party_name} | {formatCurrency(t.total_freight)}
                </option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Settling this trip will automatically tally all recorded driver expenses, deduct the trip advance, and create an official verified settlement voucher.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsGenerateModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !selectedTripToSettle}>
              {isSubmitting ? 'Calculating...' : 'Generate Settlement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Official Settlement Slip Modal */}
      <Modal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        title="Trip Settlement Slip"
        maxWidth="680px"
      >
        {selectedSettlement && (
          <div>
            <div className="settlement-slip" id="printable-settlement-slip">
              {/* Slip Header */}
              <div className="settlement-header">
                <div className="settlement-logo">KSP TRANSPORT</div>
                <div className="settlement-tagline">Logistics & Fleet Management</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '8px', color: 'var(--primary-800)' }}>
                  TRIP SETTLEMENT SLIP
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Voucher #{selectedSettlement.id} | Trip #{selectedSettlement.trip_id}
                </div>
              </div>

              {/* Status Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <strong>Trip Date:</strong> {selectedSettlement.trip_date ? new Date(selectedSettlement.trip_date).toLocaleDateString('en-IN') : '—'}
                </div>
                <div>
                  <strong>Settlement Status: </strong>
                  <StatusBadge status={selectedSettlement.settlement_status} />
                </div>
              </div>

              {/* Trip Context Grid */}
              <div className="slip-grid">
                <div className="slip-row">
                  <span>Party Name:</span>
                  <strong>{selectedSettlement.party_name}</strong>
                </div>
                <div className="slip-row">
                  <span>Unit / Destination:</span>
                  <strong>{selectedSettlement.to_location || selectedSettlement.from_location}</strong>
                </div>
                <div className="slip-row">
                  <span>Lorry Number:</span>
                  <strong>{selectedSettlement.lorry_number}</strong>
                </div>
                <div className="slip-row">
                  <span>Driver Name:</span>
                  <strong>{selectedSettlement.driver_name}</strong>
                </div>
              </div>

              {/* Expense Breakdown Table if items exist */}
              {selectedSettlement.expense_items && selectedSettlement.expense_items.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--primary-800)' }}>
                    Driver Expenses Breakdown:
                  </div>
                  <table className="table" style={{ fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 8px' }}>Category</th>
                        <th style={{ padding: '6px 8px' }}>Description</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSettlement.expense_items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '6px 8px' }}>{it.expense_type}</td>
                          <td style={{ padding: '6px 8px' }}>{it.description || '—'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Calculation Summary */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', margin: '16px 0' }}>
                <div className="slip-row" style={{ border: 'none' }}>
                  <span>Total Freight Billed:</span>
                  <strong>{formatCurrency(selectedSettlement.total_freight)}</strong>
                </div>
                <div className="slip-row" style={{ border: 'none' }}>
                  <span>Total Driver Expenses Incurred:</span>
                  <strong style={{ color: 'var(--accent-hover)' }}>{formatCurrency(selectedSettlement.total_expenses)}</strong>
                </div>
                <div className="slip-row" style={{ border: 'none' }}>
                  <span>Advance Already Paid to Driver:</span>
                  <strong>{formatCurrency(selectedSettlement.advance_paid)}</strong>
                </div>
                <div className="slip-row highlight">
                  <span style={{ fontSize: '15px' }}>Balance Payable to Driver:</span>
                  <span style={{ fontSize: '18px', color: selectedSettlement.balance_to_driver >= 0 ? '#15803d' : '#b91c1c' }}>
                    {formatCurrency(selectedSettlement.balance_to_driver)}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #cbd5e1', fontSize: '12px' }}>
                <div>
                  <div style={{ height: '30px' }} />
                  <div>_________________________</div>
                  <strong>Driver's Signature</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ height: '30px' }} />
                  <div>_________________________</div>
                  <strong>Authorized Signatory (KSP)</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <div>
                {selectedSettlement.settlement_status === 'PENDING' && (
                  <button onClick={() => handleVerify(selectedSettlement.id)} className="btn btn-primary">
                    <CheckCircle size={16} /> Mark as Verified
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handlePrint} className="btn btn-outline">
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button onClick={() => setIsSlipModalOpen(false)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
