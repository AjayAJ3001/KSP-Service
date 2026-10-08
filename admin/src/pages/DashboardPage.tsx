import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Truck,
  Building2,
  Navigation,
  CreditCard,
  FileCheck,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  PlusCircle,
  Eye,
  Scale,
  HandCoins,
} from 'lucide-react';
import { dashboardService } from '../services/adminService';
import { DashboardData, Trip } from '../types';
import { StatCard } from '../components/Common/StatCard';
import { StatusBadge } from '../components/Common/StatusBadge';
import { Modal } from '../components/Common/Modal';
import { formatDateDMY } from '../utils/dateUtils';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await dashboardService.getAdminDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading Dashboard...</div>;
  }

  const stats = data?.stats;
  const financials = data?.financials;

  return (
    <div>
      {/* Top Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Welcome to KSP Transport Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Real-time overview of fleet operations, logistics, freight collections & driver settlements
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/trips')} className="btn btn-primary">
            <PlusCircle size={18} /> View All Trips
          </button>
        </div>
      </div>

      {/* ── 30-Day Compliance Expiry Alerts ──────────────────────────── */}
      {data?.compliance_alerts && data.compliance_alerts.length > 0 && (() => {
        const fmtD = (d?: string | null) => {
          if (!d) return null;
          return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        const dLeft = (d?: string | null) => {
          if (!d) return null;
          return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
        };
        const docBadge = (label: string, date?: string | null): string | null => {
          if (!date) return null;
          const left = dLeft(date);
          if (left === null || left > 30) return null;
          const expired = left < 0;
          const bg = expired ? '#fef2f2' : '#fffbeb';
          const color = expired ? '#b91c1c' : '#92400e';
          const border = expired ? '#fca5a5' : '#fcd34d';
          const text = expired ? `EXPIRED ${Math.abs(left)}d ago` : left === 0 ? 'Expires TODAY' : `${left}d left`;
          return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};border:1px solid ${border};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap">${expired ? '❌' : '⚠️'} ${label}: ${fmtD(date)} (${text})</span>`;
        };
        return (
          <div style={{
            background: '#fff7ed', border: '2px solid #f97316',
            borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} color="#ea580c" />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#c2410c' }}>
                COMPLIANCE EXPIRY ALERT — {data.compliance_alerts.length} Vehicle{data.compliance_alerts.length > 1 ? 's' : ''} Require Attention (Within 30 Days)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.compliance_alerts.map((a) => {
                const badges = [
                  docBadge('FC', a.fc_expiry_date),
                  docBadge('Insurance', a.insurance_expiry_date),
                  docBadge('Permit', a.permit_expiry_date),
                  docBadge('Road Tax', a.tax_expiry_date),
                ].filter(Boolean);
                if (!badges.length) return null;
                return (
                  <div key={a.lorry_number} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#fff', borderRadius: '8px', padding: '8px 14px',
                    border: '1px solid #fed7aa', flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontWeight: 800, fontSize: '13px', color: '#1e293b',
                      background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px',
                      minWidth: '110px', textAlign: 'center',
                    }}>🚛 {a.lorry_number}</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
                      dangerouslySetInnerHTML={{ __html: badges.join('') }} />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#7c3aed', fontWeight: 600 }}>
              → Go to{' '}
              <button onClick={() => navigate('/vehicles')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', padding: 0 }}>
                Fleet Vehicles
              </button>
              {' '}to renew documents.
            </div>
          </div>
        );
      })()}

      {/* Primary KPI Stats Grid */}

      <div className="grid-cols-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Today's Trips"
          value={stats?.trips_today || 0}
          icon={<Navigation size={26} />}
          variant="warning"
          subtitle="Trips dispatched today"
        />
        <StatCard
          title="Pending Payments"
          value={stats?.pending_payments || 0}
          icon={<CreditCard size={26} />}
          variant="primary"
          subtitle="Awaiting party settlement"
        />
        <StatCard
          title="Settled Trips"
          value={stats?.settled_trips || 0}
          icon={<FileCheck size={26} />}
          variant="success"
          subtitle="Fully settled operations"
        />
        <StatCard
          title="Pending Settlements"
          value={stats?.pending_settlements || 0}
          icon={<AlertTriangle size={26} />}
          variant="info"
          subtitle="Driver settlements pending"
        />
      </div>

      {/* Financials & Master Summary */}
      <div className="grid-cols-3" style={{ marginBottom: '28px' }}>
        {/* Financial Highlights */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Total Freight Billed
            </span>
            <div style={{ padding: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <TrendingUp size={18} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-heading)' }}>
            {formatCurrency(financials?.total_freight || 0)}
          </div>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Collected: </span>
              <strong style={{ color: '#10b981' }}>{formatCurrency(financials?.total_received || 0)}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Balance: </span>
              <strong style={{ color: '#ef4444' }}>{formatCurrency(financials?.total_balance || 0)}</strong>
            </div>
          </div>
        </div>

        {/* Fleet Master Counts */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <h3 className="card-title">Fleet & Masters</h3>
            <button onClick={() => navigate('/vehicles')} className="btn btn-outline btn-sm">
              Manage <ArrowUpRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Lorries</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.total_vehicles || 0}</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Registered Drivers</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.total_drivers || 0}</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Parties</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.total_parties || 0}</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>System Users</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats?.total_users || 0}</div>
            </div>
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Quick Navigation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => navigate('/payments')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
              <CreditCard size={16} /> Collect Party Payment
            </button>
            <button onClick={() => navigate('/owner-advances')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
              <HandCoins size={16} /> Owner Advances
            </button>
            <button onClick={() => navigate('/settlements')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
              <FileCheck size={16} /> Generate Settlement Slip
            </button>
            <button onClick={() => navigate('/reports')} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
              <TrendingUp size={16} /> View Analytical Reports
            </button>
          </div>
        </div>
      </div>

      {/* Recent Trips Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Trips Activity</h3>
          <button onClick={() => navigate('/trips')} className="btn btn-outline btn-sm">
            View All Trips <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lorry Number</th>
                <th>Party</th>
                <th>Unit / Destination</th>
                <th>Goods Weight</th>
                <th>Driver</th>
                <th>Total Freight</th>
                <th>Advance Paid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.recent_trips || data.recent_trips.length === 0) ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No trips recorded yet.
                  </td>
                </tr>
              ) : (
                data.recent_trips.map((trip: Trip) => (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view trip details"
                  >
                    <td>{formatDateDMY(trip.trip_date)}</td>
                    <td><strong>{trip.lorry_number}</strong></td>
                    <td>{trip.party_name}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                        {trip.to_location || trip.from_location}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0f766e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Scale size={13} color="#0f766e" />
                        {trip.goods_weight ? `${trip.goods_weight} ${trip.unit_abbreviation || trip.unit_name || 'Ton'}` : '—'}
                      </span>
                    </td>
                    <td>{trip.driver_name}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(trip.total_freight)}</td>
                    <td>{formatCurrency(trip.advance_paid)}</td>
                    <td><StatusBadge status={trip.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrip(trip);
                        }}
                        style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trip Details Modal */}
      <Modal
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={`Trip Details #${selectedTrip?.id}`}
        maxWidth="650px"
      >
        {selectedTrip && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status: </span>
                <StatusBadge status={selectedTrip.status} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Date: <strong>{formatDateDMY(selectedTrip.trip_date)}</strong>
              </div>
            </div>

            <div className="slip-grid" style={{ marginBottom: '20px' }}>
              <div className="slip-row">
                <span>Lorry Number:</span>
                <strong>{selectedTrip.lorry_number}</strong>
              </div>
              <div className="slip-row">
                <span>Driver:</span>
                <strong>{selectedTrip.driver_name || '—'}</strong>
              </div>
              <div className="slip-row">
                <span>Party Name:</span>
                <strong>{selectedTrip.party_name}</strong>
              </div>
              <div className="slip-row">
                <span>Route:</span>
                <strong>{selectedTrip.from_location} → {selectedTrip.to_location}</strong>
              </div>
              <div className="slip-row" style={{ background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Goods Weight:</span>
                <strong style={{ color: '#15803d', fontSize: '15px' }}>
                  {selectedTrip.goods_weight ? `${selectedTrip.goods_weight} ${selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}` : '—'}
                </strong>
              </div>
              <div className="slip-row">
                <span>Freight Rate:</span>
                <strong>
                  {selectedTrip.freight_rate
                    ? `₹${parseFloat(String(selectedTrip.freight_rate)).toLocaleString('en-IN')}/${selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}`
                    : '—'}
                </strong>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-light)' }}>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Freight Billed:</span>
                <strong style={{ fontSize: '16px', color: 'var(--primary-900)' }}>{formatCurrency(selectedTrip.total_freight)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Advance Paid to Driver:</span>
                <strong>{formatCurrency(selectedTrip.advance_paid || 0)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Payment Received:</span>
                <strong style={{ color: 'var(--success-color, #16a34a)' }}>{formatCurrency(selectedTrip.total_received || 0)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none', borderTop: '1px dashed var(--border-light)', paddingTop: '10px', marginTop: '6px' }}>
                <span style={{ fontWeight: 600 }}>Balance Due:</span>
                <strong style={{ fontSize: '16px', color: 'var(--danger-color, #dc2626)' }}>
                  {formatCurrency(
                    selectedTrip.balance_due ??
                      Math.max(0, (selectedTrip.total_freight || 0) - (selectedTrip.total_received || 0))
                  )}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedTrip(null);
                  navigate('/trips');
                }}
              >
                Go to Trips Manager →
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedTrip(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
