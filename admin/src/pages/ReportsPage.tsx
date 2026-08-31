import React, { useState, useEffect } from 'react';
import { BarChart3, Filter, Printer, Download, TrendingUp, CreditCard, FileCheck } from 'lucide-react';
import { reportService, partyService, driverService, vehicleService } from '../services/adminService';
import { Party, Driver, Vehicle } from '../types';
import { StatusBadge } from '../components/Common/StatusBadge';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trips' | 'payments' | 'settlements'>('trips');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [status, setStatus] = useState('');

  // Lookups
  const [parties, setParties] = useState<Party[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Report Data
  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [settlementData, setSettlementData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadReport();
  }, [activeTab, fromDate, toDate, partyId, driverId, vehicleId, status]);

  const loadLookups = async () => {
    try {
      const [p, d, v] = await Promise.all([
        partyService.getParties({ limit: 100 }),
        driverService.getDrivers({ limit: 100 }),
        vehicleService.getVehicles({ limit: 100 }),
      ]);
      setParties(p.data.items);
      setDrivers(d.data.items);
      setVehicles(v.data.items);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const params = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: partyId || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        status: status || undefined,
      };

      if (activeTab === 'trips') {
        const res = await reportService.getTripReport(params);
        setTripData(res.data);
      } else if (activeTab === 'payments') {
        const res = await reportService.getPaymentReport(params);
        setPaymentData(res.data);
      } else {
        const res = await reportService.getSettlementReport(params);
        setSettlementData(res.data);
      }
    } catch (err) {
      console.error('Failed to load report data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Business Reports & Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Comprehensive operational audits, freight receivables, payment logs & driver expense reports
          </p>
        </div>
        <button onClick={handlePrint} className="btn btn-outline">
          <Printer size={16} /> Print / Export Report
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'trips' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('trips')}
        >
          <TrendingUp size={16} /> Trip Dispatch Reports
        </button>
        <button
          className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('payments')}
        >
          <CreditCard size={16} /> Party Payment Reports
        </button>
        <button
          className={`btn ${activeTab === 'settlements' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('settlements')}
        >
          <FileCheck size={16} /> Settlement Vouchers Report
        </button>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px' }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px' }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <select
            className="form-control form-select"
            style={{ width: '180px' }}
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
          >
            <option value="">All Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {activeTab === 'trips' && (
            <>
              <select
                className="form-control form-select"
                style={{ width: '180px' }}
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">All Drivers</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                className="form-control form-select"
                style={{ width: '180px' }}
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.lorry_number}</option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
              setPartyId('');
              setDriverId('');
              setVehicleId('');
              setStatus('');
            }}
            className="btn btn-outline btn-sm"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Report Content */}
      {activeTab === 'trips' && (
        <>
          {/* Summary KPIs */}
          <div className="grid-cols-4" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value">{tripData.summary?.total_trips || 0}</div>
                <div className="stat-label">Total Filtered Trips</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value" style={{ color: 'var(--accent-hover)' }}>
                  {formatCurrency(tripData.summary?.total_freight || 0)}
                </div>
                <div className="stat-label">Total Freight Revenue</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value" style={{ color: 'var(--success-700)' }}>
                  {formatCurrency(tripData.summary?.total_received || 0)}
                </div>
                <div className="stat-label">Total Received Payments</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value" style={{ color: 'var(--danger-700)' }}>
                  {formatCurrency(tripData.summary?.total_balance || 0)}
                </div>
                <div className="stat-label">Outstanding Balance Due</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Lorry</th>
                    <th>Party</th>
                    <th>Unit Name</th>
                    <th>Weight</th>
                    <th>Total Freight</th>
                    <th>Received</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tripData.trips.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No records match the selected report criteria.
                      </td>
                    </tr>
                  ) : (
                    tripData.trips.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.trip_date).toLocaleDateString('en-IN')}</td>
                        <td><strong>{t.lorry_number}</strong></td>
                        <td>{t.party_name}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                            {t.to_location || t.from_location}
                          </span>
                        </td>
                        <td>{t.goods_weight} {t.unit_name || 'Tons'}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(t.total_freight)}</td>
                        <td style={{ color: 'var(--success-700)' }}>{formatCurrency(t.total_received)}</td>
                        <td style={{ color: t.balance_due > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
                          {formatCurrency(t.balance_due)}
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'payments' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Party</th>
                  <th>Unit Name</th>
                  <th>Lorry</th>
                  <th>Amount Received</th>
                  <th>Remaining Balance</th>
                  <th>Collected By</th>
                  <th>Payment Notes</th>
                </tr>
              </thead>
              <tbody>
                {paymentData.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No payment entries found for the selected period.
                    </td>
                  </tr>
                ) : (
                  paymentData.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                      <td><strong>{p.party_name}</strong></td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                          {p.to_location || p.from_location}
                        </span>
                      </td>
                      <td>{p.lorry_number}</td>
                      <td style={{ color: 'var(--success-700)', fontWeight: 700, fontSize: '14px' }}>
                        {formatCurrency(p.received_amount)}
                      </td>
                      <td>{formatCurrency(p.balance_due)}</td>
                      <td>{p.created_by_name || 'Admin'}</td>
                      <td>{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settlements' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Trip Date</th>
                  <th>Lorry Number</th>
                  <th>Driver</th>
                  <th>Party</th>
                  <th>Unit Name</th>
                  <th>Total Freight</th>
                  <th>Advance Paid</th>
                  <th>Balance to Driver</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {settlementData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No settlement slips recorded for the selected period.
                    </td>
                  </tr>
                ) : (
                  settlementData.map((s) => (
                    <tr key={s.id}>
                      <td>{s.trip_date ? new Date(s.trip_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td><strong>{s.lorry_number}</strong></td>
                      <td>{s.driver_name}</td>
                      <td>{s.party_name}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                          {s.to_location || s.from_location}
                        </span>
                      </td>
                      <td>{formatCurrency(s.total_freight)}</td>
                      <td>{formatCurrency(s.advance_paid)}</td>
                      <td style={{ fontWeight: 700, color: s.balance_to_driver >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                        {formatCurrency(s.balance_to_driver)}
                      </td>
                      <td><StatusBadge status={s.settlement_status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
