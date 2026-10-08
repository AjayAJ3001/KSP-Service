import React, { useState, useEffect } from 'react';
import { Navigation, Plus, Eye, CheckCircle, Search, Filter, Trash2, AlertTriangle, Calendar, Truck } from 'lucide-react';
import { tripService, vehicleService, driverService, partyService, routeService, unitService, freightRateService } from '../services/adminService';
import { Trip, Vehicle, Driver, Party, Route, Unit, FreightRate } from '../types';
import { DataTable, Column } from '../components/Common/DataTable';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { formatDateDMY } from '../utils/dateUtils';
import { DateField } from '../components/Common/DateField';

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

  // Driver License Expiry Alert state for manager selecting driver
  const [driverAlertInfo, setDriverAlertInfo] = useState<{
    driver: Driver;
    days: number;
    isExpired: boolean;
  } | null>(null);

  const [vehicleAlertInfo, setVehicleAlertInfo] = useState<{
    vehicle: Vehicle;
    alerts: { name: string; date: string; days: number; isExpired: boolean }[];
  } | null>(null);

  const getDaysDifference = (expiryDateStr: string): number => {
    try {
      const expiry = new Date(expiryDateStr);
      const today = new Date();
      expiry.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  };

  const getVehicleDocAlerts = (v: Vehicle) => {
    const docs: { name: string; date?: string }[] = [
      { name: 'Insurance Policy', date: v.insurance_expiry_date },
      { name: 'Road Permit', date: v.permit_expiry_date },
      { name: 'Yearly Road Tax', date: v.tax_expiry_date },
      { name: 'RC (Registration)', date: v.rc_expiry_date },
    ];
    const alerts: { name: string; date: string; days: number; isExpired: boolean }[] = [];
    for (const doc of docs) {
      if (!doc.date) continue;
      const days = getDaysDifference(doc.date);
      if (days <= 30) {
        alerts.push({
          name: doc.name,
          date: formatDateDMY(doc.date),
          days,
          isExpired: days < 0,
        });
      }
    }
    return alerts.sort((a, b) => a.days - b.days);
  };

  const handleVehicleChange = (vehicleId: string) => {
    setFormData((prev) => ({ ...prev, vehicle_id: vehicleId }));
    if (!vehicleId) {
      setVehicleAlertInfo(null);
      return;
    }
    const selVehicle = vehicles.find((v) => v.id === Number(vehicleId));
    if (!selVehicle) return;
    const alerts = getVehicleDocAlerts(selVehicle);
    if (alerts.length > 0) {
      setVehicleAlertInfo({ vehicle: selVehicle, alerts });
    } else {
      setVehicleAlertInfo(null);
    }
  };

  const handleDriverChange = (driverId: string) => {
    setFormData((prev) => ({ ...prev, driver_id: driverId }));
    if (!driverId) return;
    const selDriver = drivers.find((d) => d.id === Number(driverId));
    if (selDriver && selDriver.license_expiry_date) {
      const days = getDaysDifference(selDriver.license_expiry_date);
      if (days <= 30) {
        setDriverAlertInfo({
          driver: selDriver,
          days,
          isExpired: days < 0,
        });
      }
    }
  };

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
    if (!routeId) return;
    const rId = Number(routeId);
    const uId = unitId ? Number(unitId) : null;
    const pId = partyId ? Number(partyId) : null;

    // Find party-specific rate first, then generic rate
    let match = freightRates.find((r) => r.route_id === rId && (!uId || r.unit_id === uId) && r.party_id === pId);
    if (!match && pId) {
      match = freightRates.find((r) => r.route_id === rId && (!uId || r.unit_id === uId) && !r.party_id);
    }

    if (match) {
      setFormData((prev) => ({
        ...prev,
        freight_rate_id: String(match.id),
        freight_rate: String(match.rate_per_unit),
      }));
    } else {
      // Fallback directly to the unit/destination configured under Parties and Units
      const selRoute = routes.find((r) => r.id === rId);
      if (selRoute && selRoute.rate_per_unit) {
        setFormData((prev) => ({
          ...prev,
          freight_rate: String(selRoute.rate_per_unit),
        }));
      }
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
      accessor: (t) => formatDateDMY(t.trip_date),
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
              <DateField
                style={{ width: '155px' }}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
              <DateField
                style={{ width: '155px' }}
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
              <DateField
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
                onChange={(e) => handleVehicleChange(e.target.value)}
              >
                <option value="">Select Vehicle / Lorry</option>
                {vehicles.map((v) => {
                  const alerts = getVehicleDocAlerts(v);
                  const hasExpired = alerts.some((a) => a.isExpired);
                  const expBadge = hasExpired
                    ? ' [⚠️ DOC EXPIRED]'
                    : alerts.length > 0
                    ? ` [⚠️ ${alerts.length} doc${alerts.length === 1 ? '' : 's'} ≤30d]`
                    : '';
                  return (
                    <option key={v.id} value={v.id}>
                      {v.lorry_number} ({v.capacity_tons || 0} Tons){expBadge}
                    </option>
                  );
                })}
              </select>
              {(() => {
                const selVehicle = vehicles.find((v) => v.id === Number(formData.vehicle_id));
                if (!selVehicle) return null;
                const alerts = getVehicleDocAlerts(selVehicle);
                if (alerts.length === 0) return null;
                const hasExpired = alerts.some((a) => a.isExpired);
                return (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '12px',
                      color: hasExpired ? '#b91c1c' : '#b45309',
                      background: hasExpired ? '#fef2f2' : '#fffbeb',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${hasExpired ? '#fecaca' : '#fde047'}`,
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <AlertTriangle size={14} color={hasExpired ? '#dc2626' : '#d97706'} />
                      <span>
                        {hasExpired
                          ? 'Truck documents EXPIRED or expiring within 30 days'
                          : 'Truck documents expiring within 30 days'}
                      </span>
                    </div>
                    {alerts.map((a) => (
                      <div key={a.name} style={{ fontWeight: 500, marginLeft: '20px' }}>
                        • {a.name}: {a.isExpired ? `EXPIRED (${a.date})` : a.days === 0 ? `Today (${a.date})` : `${a.days}d left (${a.date})`}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Driver Name *</label>
              <select
                className="form-control form-select"
                required
                value={formData.driver_id}
                onChange={(e) => handleDriverChange(e.target.value)}
              >
                <option value="">Select Driver</option>
                {drivers.map((d) => {
                  const days = d.license_expiry_date ? getDaysDifference(d.license_expiry_date) : null;
                  const isExp = days !== null && days < 0;
                  const isSoon = days !== null && days >= 0 && days <= 30;
                  const expBadge = isExp ? ' [⚠️ EXPIRED]' : isSoon ? ` [⚠️ Exp in ${days}d]` : '';
                  const typeBadge = d.license_type === 'REGULAR' ? ' [🚗 Regular]' : ' [🚛 Heavy]';
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.mobile_number || 'No Mobile'}){typeBadge}{expBadge}
                    </option>
                  );
                })}
              </select>

              {(() => {
                const selDriver = drivers.find((d) => d.id === Number(formData.driver_id));
                if (selDriver && selDriver.license_expiry_date) {
                  const days = getDaysDifference(selDriver.license_expiry_date);
                  if (days < 0) {
                    return (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <AlertTriangle size={14} color="#dc2626" />
                        <span>Driver license EXPIRED ({formatDateDMY(selDriver.license_expiry_date)})</span>
                      </div>
                    );
                  } else if (days <= 30) {
                    return (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fde047', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <AlertTriangle size={14} color="#d97706" />
                        <span>Driver license expires in ${days} day${days === 1 ? '' : 's'} (${formatDateDMY(selDriver.license_expiry_date)})</span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
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

      {/* Driver License Expiry Alert Popup for Manager */}
      {driverAlertInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10005,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
              border: `1px solid ${driverAlertInfo.isExpired ? '#fca5a5' : '#fde047'}`,
              overflow: 'hidden',
              animation: 'slideUp 0.25s ease',
            }}
          >
            <div
              style={{
                background: driverAlertInfo.isExpired
                  ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                padding: '18px 22px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
                  Driver License Expiry Alert
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  {driverAlertInfo.isExpired ? 'Driving License Has Expired!' : 'License Expiring Soon (Within 30 Days)'}
                </h3>
              </div>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                You have selected driver <strong>{driverAlertInfo.driver.name}</strong> for this trip. The system detected an active license expiry warning:
              </p>

              <div
                style={{
                  background: driverAlertInfo.isExpired ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${driverAlertInfo.isExpired ? '#fecaca' : '#fef08a'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                      Driver Name
                    </span>
                    <strong>{driverAlertInfo.driver.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                      Phone Number
                    </span>
                    <strong>{driverAlertInfo.driver.mobile_number || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                      License Expiry
                    </span>
                    <strong style={{ color: driverAlertInfo.isExpired ? '#dc2626' : '#d97706' }}>
                      {formatDateDMY(driverAlertInfo.driver.license_expiry_date)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                      Status
                    </span>
                    <strong style={{ color: driverAlertInfo.isExpired ? '#dc2626' : '#d97706' }}>
                      {driverAlertInfo.isExpired
                        ? `Expired ${Math.abs(driverAlertInfo.days)} days ago`
                        : driverAlertInfo.days === 0
                        ? 'Expires today'
                        : `Expires in ${driverAlertInfo.days} days`}
                    </strong>
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                {driverAlertInfo.isExpired
                  ? 'Dispatching a driver with an expired license poses legal and insurance compliance risks. Please ensure renewal before trip.'
                  : 'Please notify the driver to start the license renewal process with the RTO before expiry.'}
              </p>
            </div>

            <div
              style={{
                padding: '14px 22px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, driver_id: '' }));
                  setDriverAlertInfo(null);
                }}
                className="btn btn-outline"
              >
                Choose Another Driver
              </button>
              <button
                type="button"
                onClick={() => setDriverAlertInfo(null)}
                className="btn btn-primary"
                style={{
                  background: driverAlertInfo.isExpired ? '#dc2626' : '#d97706',
                  borderColor: driverAlertInfo.isExpired ? '#dc2626' : '#d97706',
                }}
              >
                Acknowledge & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      {vehicleAlertInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11000,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                background: vehicleAlertInfo.alerts.some((a) => a.isExpired)
                  ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                padding: '18px 22px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Truck size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
                  Truck / Lorry Compliance Alert
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  {vehicleAlertInfo.alerts.some((a) => a.isExpired)
                    ? 'Documents Expired or Due Within 30 Days'
                    : 'Insurance / Permit / Tax / RC — Within 30 Days'}
                </h3>
              </div>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                You selected lorry <strong>{vehicleAlertInfo.vehicle.lorry_number}</strong>. Please review these documents before dispatch:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {vehicleAlertInfo.alerts.map((a) => (
                  <div
                    key={a.name}
                    style={{
                      background: a.isExpired ? '#fef2f2' : '#fffbeb',
                      border: `1px solid ${a.isExpired ? '#fecaca' : '#fef08a'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>{a.name}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: a.isExpired ? '#dc2626' : '#d97706' }}>
                      {a.isExpired
                        ? `Expired ${Math.abs(a.days)} days ago (${a.date})`
                        : a.days === 0
                        ? `Expires today (${a.date})`
                        : `Expires in ${a.days} days (${a.date})`}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                Renew insurance, permit, yearly tax, and RC before expiry to avoid legal and dispatch issues.
              </p>
            </div>

            <div
              style={{
                padding: '14px 22px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, vehicle_id: '' }));
                  setVehicleAlertInfo(null);
                }}
                className="btn btn-outline"
              >
                Choose Another Truck
              </button>
              <button
                type="button"
                onClick={() => setVehicleAlertInfo(null)}
                className="btn btn-primary"
                style={{
                  background: vehicleAlertInfo.alerts.some((a) => a.isExpired) ? '#dc2626' : '#d97706',
                  borderColor: vehicleAlertInfo.alerts.some((a) => a.isExpired) ? '#dc2626' : '#d97706',
                }}
              >
                Acknowledge & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
