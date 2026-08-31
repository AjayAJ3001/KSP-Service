import React, { useState, useEffect } from 'react';
import { Navigation, Plus, Eye, CheckCircle, Search, Filter, Trash2 } from 'lucide-react';
import { tripService, vehicleService, driverService, partyService, routeService, unitService, freightRateService } from '../services/adminService';
import { Trip, Vehicle, Driver, Party, Route, Unit, FreightRate } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const TripsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Lookups
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Form
  const [formData, setFormData] = useState({
    trip_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    driver_id: '',
    party_id: '',
    route_id: '',
    unit_id: '',
    freight_rate_id: '',
    freight_rate: '',
    goods_weight: '',
    advance_paid: '0',
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTrips();
    loadLookups();
  }, [page, statusFilter, partyFilter, fromDate, toDate]);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const res = await tripService.getTrips({
        page,
        limit: 10,
        status: statusFilter || undefined,
        party_id: partyFilter || undefined,
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
  };

  const loadLookups = async () => {
    try {
      const [vRes, dRes, pRes, rRes, uRes, frRes] = await Promise.all([
        vehicleService.getVehicles({ limit: 100, status: 'ACTIVE' }),
        driverService.getDrivers({ limit: 100, status: 'ACTIVE' }),
        partyService.getParties({ limit: 100, status: 'ACTIVE' }),
        routeService.getRoutes({ limit: 100, status: 'ACTIVE' }),
        unitService.getUnits('ACTIVE'),
        freightRateService.getFreightRates({ limit: 100, status: 'ACTIVE' }),
      ]);
      setVehicles(vRes.data.items);
      setDrivers(dRes.data.items);
      setParties(pRes.data.items);
      setRoutes(rRes.data.items);
      setUnits(uRes.data);
      setFreightRates(frRes.data.items);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  // Auto-fill freight rate when route or unit changes
  const handleRouteChange = (routeId: string) => {
    setFormData((prev) => {
      const updated = { ...prev, route_id: routeId };
      findAndApplyRate(updated.route_id, updated.unit_id, updated.party_id);
      return updated;
    });
  };

  const handleUnitChange = (unitId: string) => {
    setFormData((prev) => {
      const updated = { ...prev, unit_id: unitId };
      findAndApplyRate(updated.route_id, updated.unit_id, updated.party_id);
      return updated;
    });
  };

  const handlePartyChange = (partyId: string) => {
    setFormData((prev) => {
      const updated = { ...prev, party_id: partyId };
      findAndApplyRate(updated.route_id, updated.unit_id, updated.party_id);
      return updated;
    });
  };

  const findAndApplyRate = (routeId: string, unitId: string, partyId: string) => {
    if (!routeId || !unitId) return;
    const rId = Number(routeId);
    const uId = Number(unitId);
    const pId = partyId ? Number(partyId) : null;

    // Find party-specific rate first, then generic rate
    let match = freightRates.find((r) => r.route_id === rId && r.unit_id === uId && r.party_id === pId);
    if (!match && pId) {
      match = freightRates.find((r) => r.route_id === rId && r.unit_id === uId && !r.party_id);
    }

    if (match) {
      setFormData((prev) => ({
        ...prev,
        freight_rate_id: String(match.id),
        freight_rate: String(match.rate_per_unit),
      }));
    }
  };

  // Calculate live total freight preview
  const previewTotalFreight = () => {
    const weight = parseFloat(formData.goods_weight) || 0;
    const rate = parseFloat(formData.freight_rate) || 0;
    return (weight * rate).toFixed(2);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.driver_id || !formData.party_id || !formData.route_id || !formData.unit_id || !formData.freight_rate || !formData.goods_weight) {
      setFormError('Please fill in all mandatory trip details.');
      return;
    }
    if (parseFloat(formData.goods_weight) <= 0) {
      setFormError('Goods weight must be greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      await tripService.createTrip({
        trip_date: formData.trip_date,
        vehicle_id: Number(formData.vehicle_id),
        driver_id: Number(formData.driver_id),
        party_id: Number(formData.party_id),
        route_id: Number(formData.route_id),
        unit_id: Number(formData.unit_id),
        freight_rate_id: formData.freight_rate_id ? Number(formData.freight_rate_id) : undefined,
        freight_rate: parseFloat(formData.freight_rate),
        goods_weight: parseFloat(formData.goods_weight),
        advance_paid: parseFloat(formData.advance_paid) || 0,
      });

      setIsCreateModalOpen(false);
      resetForm();
      loadTrips();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      trip_date: new Date().toISOString().split('T')[0],
      vehicle_id: '',
      driver_id: '',
      party_id: '',
      route_id: '',
      unit_id: '',
      freight_rate_id: '',
      freight_rate: '',
      goods_weight: '',
      advance_paid: '0',
    });
    setFormError('');
  };

  const handleDeleteTrip = async (trip: Trip) => {
    if (!confirm(`Are you sure you want to delete Trip #${trip.id} (${trip.lorry_number} - ${trip.party_name})? This will also remove associated payments and expenses.`)) {
      return;
    }
    try {
      await tripService.deleteTrip(trip.id);
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip.');
    }
  };

  const openViewModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setIsViewModalOpen(true);
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns: Column<Trip>[] = [
    {
      header: 'Trip Date',
      accessor: (t) => new Date(t.trip_date).toLocaleDateString('en-IN'),
    },
    {
      header: 'Lorry Number',
      accessor: 'lorry_number',
      render: (t) => <strong>{t.lorry_number}</strong>,
    },
    { header: 'Party Name', accessor: 'party_name' },
    {
      header: 'Unit Name / Destination',
      render: (t) => (
        <span
          style={{
            fontWeight: 700,
            color: '#1e40af',
            background: '#eff6ff',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          {t.to_location || t.from_location}
        </span>
      ),
    },
    { header: 'Driver', accessor: 'driver_name' },
    {
      header: 'Weight / Qty',
      render: (t) => `${t.goods_weight} ${t.unit_abbreviation || 'Tons'}`,
    },
    {
      header: 'Total Freight',
      render: (t) => <strong style={{ color: 'var(--accent-hover)' }}>{formatCurrency(t.total_freight)}</strong>,
    },
    {
      header: 'Advance Paid',
      render: (t) => formatCurrency(t.advance_paid),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      header: 'Actions',
      render: (t) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => openViewModal(t)} className="btn btn-outline btn-sm" title="View Details">
            <Eye size={14} />
          </button>
          <button
            onClick={() => handleDeleteTrip(t)}
            className="btn btn-danger btn-sm"
            title="Delete Trip"
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
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Trip Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            Create and track freight dispatch trips, lorry allocations & delivery status
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} /> New Trip Entry
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="search-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select
              className="form-control form-select"
              style={{ width: '180px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
              <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
              <option value="SETTLED">SETTLED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              className="form-control form-select"
              style={{ width: '200px' }}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: '150px' }}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: '150px' }}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
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

      {/* Create Trip Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Trip Entry"
        maxWidth="700px"
      >
        {formError && (
          <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Trip Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={formData.trip_date}
                onChange={(e) => setFormData({ ...formData, trip_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Lorry Number *</label>
              <select
                className="form-control form-select"
                required
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              >
                <option value="">Select Vehicle / Lorry</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.lorry_number} ({v.capacity_tons || 0} Tons)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Driver Name *</label>
              <select
                className="form-control form-select"
                required
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
              >
                <option value="">Select Driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.mobile_number || 'No Mobile'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Party Name *</label>
              <select
                className="form-control form-select"
                required
                value={formData.party_id}
                onChange={(e) => handlePartyChange(e.target.value)}
              >
                <option value="">Select Party</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Unit Name / Destination *</label>
              <select
                className="form-control form-select"
                required
                value={formData.route_id}
                onChange={(e) => handleRouteChange(e.target.value)}
              >
                <option value="">Select Unit / Destination</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.to_location}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Measurement Unit *</label>
              <select
                className="form-control form-select"
                required
                value={formData.unit_id}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation || ''})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-cols-3">
            <div className="form-group">
              <label className="form-label">Goods Weight / Qty *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="form-control"
                required
                placeholder="e.g. 25.00"
                value={formData.goods_weight}
                onChange={(e) => setFormData({ ...formData, goods_weight: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Freight Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                placeholder="e.g. 1250.00"
                value={formData.freight_rate}
                onChange={(e) => setFormData({ ...formData, freight_rate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Advance Paid to Driver (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="e.g. 5000.00"
                value={formData.advance_paid}
                onChange={(e) => setFormData({ ...formData, advance_paid: e.target.value })}
              />
            </div>
          </div>

          {/* Live Calculated Total Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#fff',
              padding: '16px 20px',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '16px 0',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Calculated Total Freight
              </div>
              <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '2px' }}>
                Formula: {formData.goods_weight || 0} tons × ₹{formData.freight_rate || 0}
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-heading)' }}>
              ₹{parseFloat(previewTotalFreight()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Save & Create Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Trip Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
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
                Date: <strong>{new Date(selectedTrip.trip_date).toLocaleDateString('en-IN')}</strong>
              </div>
            </div>

            <div className="slip-grid" style={{ marginBottom: '20px' }}>
              <div className="slip-row">
                <span>Lorry Number:</span>
                <strong>{selectedTrip.lorry_number}</strong>
              </div>
              <div className="slip-row">
                <span>Driver:</span>
                <strong>{selectedTrip.driver_name}</strong>
              </div>
              <div className="slip-row">
                <span>Party Name:</span>
                <strong>{selectedTrip.party_name}</strong>
              </div>
              <div className="slip-row">
                <span>Unit / Destination:</span>
                <strong>{selectedTrip.to_location || selectedTrip.from_location}</strong>
              </div>
              <div className="slip-row">
                <span>Goods Weight:</span>
                <strong>{selectedTrip.goods_weight} {selectedTrip.unit_abbreviation || 'Tons'}</strong>
              </div>
              <div className="slip-row">
                <span>Freight Rate:</span>
                <strong>₹{parseFloat(String(selectedTrip.freight_rate)).toLocaleString('en-IN')}/{selectedTrip.unit_abbreviation || 'T'}</strong>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Total Freight Billed:</span>
                <strong style={{ fontSize: '16px', color: 'var(--primary-900)' }}>{formatCurrency(selectedTrip.total_freight)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Advance Paid to Driver:</span>
                <strong>{formatCurrency(selectedTrip.advance_paid)}</strong>
              </div>
              <div className="slip-row" style={{ border: 'none' }}>
                <span>Amount Received from Party:</span>
                <strong style={{ color: 'var(--success-700)' }}>{formatCurrency(selectedTrip.total_received || 0)}</strong>
              </div>
              <div className="slip-row" style={{ borderTop: '1px solid var(--border-medium)', paddingTop: '10px', marginTop: '6px' }}>
                <span>Balance Due from Party:</span>
                <strong style={{ color: 'var(--danger-700)', fontSize: '15px' }}>{formatCurrency(selectedTrip.balance_due || 0)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsViewModalOpen(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
