import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, Download, Calendar, RefreshCw,
} from 'lucide-react';
import { reportService, partyService, driverService, vehicleService, unitService } from '../services/adminService';
import { Party, Driver, Vehicle, Unit } from '../types';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
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

function fmtCur(val: number | string) {
  return (parseFloat(String(val)) || 0).toFixed(2);
}

function formatCurrency(val: number | string) {
  const num = parseFloat(String(val)) || 0;
  return `${String.fromCharCode(8377)}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export const ReportsPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState('');

  const [parties, setParties] = useState<Party[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [isLoading, setIsLoading] = useState(false);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  useEffect(() => {
    loadLookups();
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: partyId || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        unit_id: unitId || undefined,
        status: status || undefined,
      };

      const res = await reportService.getTripReport(params);
      setTripData(res.data);
    } catch (err) {
      console.error('Failed to load trip report', err);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, partyId, driverId, vehicleId, unitId, status]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadLookups = async () => {
    try {
      const [p, d, v, u] = await Promise.all([
        partyService.getParties({ limit: 200 }),
        driverService.getDrivers({ limit: 200 }),
        vehicleService.getVehicles({ limit: 200 }),
        unitService.getUnits('ACTIVE').catch(() => unitService.getUnits()),
      ]);
      setParties(p.data.items || (Array.isArray(p.data) ? p.data : []));
      setDrivers(d.data.items || (Array.isArray(d.data) ? d.data : []));
      setVehicles(v.data.items || (Array.isArray(v.data) ? v.data : []));
      setUnits(Array.isArray(u.data) ? u.data : (u.data as any)?.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const handleThisWeekClick = () => {
    if (isThisWeekActive) {
      setFromDate('');
      setToDate('');
    } else {
      setFromDate(thisWeek.from);
      setToDate(thisWeek.to);
    }
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setPartyId('');
    setDriverId('');
    setVehicleId('');
    setUnitId('');
    setStatus('');
  };

  // CSV formatters
  const tripHeaders = [
    'Trip ID', 'Trip Date', 'Lorry Number', 'Party Name', 'Driver Name',
    'Route', 'Unit', 'Weight', 'Total Freight (INR)', 'Advance Paid (INR)',
    'Total Received (INR)', 'Balance Due (INR)', 'Status'
  ];
  const tripRow = (t: any) => [
    String(t.id),
    formatDateDMY(t.trip_date),
    t.lorry_number,
    t.party_name,
    t.driver_name || '',
    `${t.from_location} -> ${t.to_location}`,
    t.unit_name || '',
    String(t.goods_weight || 0),
    fmtCur(t.total_freight),
    fmtCur(t.advance_paid),
    fmtCur(t.total_received),
    fmtCur(t.balance_due),
    t.status
  ];

  const downloadFullReport = () => {
    const dateTag = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'All';
    downloadCSV(`Trips_Dispatch_Report_${dateTag}.csv`, tripHeaders, tripData.trips.map(tripRow));
  };

  const downloadSingleTripCSV = (t: any) => {
    const filename = `Trip_${t.id}_${t.lorry_number}_${formatDateDMY(t.trip_date)}.csv`;
    downloadCSV(filename, tripHeaders, [tripRow(t)]);
  };

  return (
    <div>
      {/* ── Executive Header ────────────────────────────────────────────── */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Trip Dispatch Report</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
            Comprehensive freight dispatch audit and trip logistics report
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> Print Report
          </button>
          <button onClick={downloadFullReport} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {/* ── Professional Unified Filter Toolbar ─────────────────────────── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '22px', borderRadius: '10px' }}>
        {/* Top Control Line: Date Range + This Week */}
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
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <DateField
              style={{ width: '160px', height: '38px' }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
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

        {/* Bottom Control Line: Entity Filters (Party, Truck, Unit, Driver, Status, Reset) */}
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
          <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
            >
              <option value="">All Parties</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Truck Wise */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">All Trucks</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.lorry_number}</option>)}
            </select>
          </div>

          {/* Unit Wise */}
          <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
            >
              <option value="">All Units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Driver Wise */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <select
              className="form-control form-select"
              style={{ width: '100%', height: '38px' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="SETTLED">Settled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Reset Filters */}
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

      {/* ── Trips Table ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lorry</th>
                <th>Party</th>
                <th>Route / Destination</th>
                <th>Unit &amp; Weight</th>
                <th style={{ textAlign: 'right' }}>Total Freight</th>
                <th style={{ textAlign: 'right' }}>Received</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading trip report records...
                  </td>
                </tr>
              ) : tripData.trips.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No trip records match the selected report criteria.
                  </td>
                </tr>
              ) : (
                tripData.trips.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateDMY(t.trip_date)}</td>
                    <td><strong>{t.lorry_number}</strong></td>
                    <td>{t.party_name}</td>
                    <td style={{ fontSize: '13px' }}>{t.from_location} &rarr; {t.to_location}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.goods_weight} {t.unit_name || 'Tons'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.total_freight)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success-700)', fontWeight: 600 }}>{formatCurrency(t.total_received)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: Number(t.balance_due) > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
                      {formatCurrency(t.balance_due)}
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={t.status} /></td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => downloadSingleTripCSV(t)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Download this trip (CSV)"
                      >
                        <Download size={13} />
                        <span>CSV</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
