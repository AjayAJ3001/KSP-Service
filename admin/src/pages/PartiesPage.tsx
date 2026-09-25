import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Plus,
  Edit2,
  Search,
  Trash2,
  X,
  Phone,
  User,
  Compass,
  CheckCircle,
} from 'lucide-react';
import { partyService, routeService } from '../services/adminService';
import { Party, Route } from '../types';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';

export const PartiesPage: React.FC = () => {
  // Parties state
  const [parties, setParties] = useState<Party[]>([]);
  const [totalParties, setTotalParties] = useState(0);
  const [partiesPage, setPartiesPage] = useState(1);
  const [partySearch, setPartySearch] = useState('');
  const [partyStatusFilter, setPartyStatusFilter] = useState('');
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);

  // Selected party
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Units/Routes for selected party
  const [routes, setRoutes] = useState<Route[]>([]);
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [routesPage, setRoutesPage] = useState(1);
  const [routeSearch, setRouteSearch] = useState('');
  const [routeStatusFilter, setRouteStatusFilter] = useState('');
  const [isRoutesLoading, setIsRoutesLoading] = useState(false);

  // Party Modal
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyFormData, setPartyFormData] = useState({
    name: '',
    contact_person: '',
    mobile_number: '',
    address: '',
  });
  const [partyFormError, setPartyFormError] = useState('');
  const [isPartySubmitting, setIsPartySubmitting] = useState(false);

  // Route/Unit Modal
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeFormData, setRouteFormData] = useState({
    party_id: 0,
    from_location: 'Erode',
    to_location: '',
    distance_km: '',
    rate_per_unit: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [routeFormError, setRouteFormError] = useState('');
  const [isRouteSubmitting, setIsRouteSubmitting] = useState(false);

  // Load parties
  useEffect(() => {
    loadParties();
  }, [partiesPage, partySearch, partyStatusFilter]);

  // Load units when selected party or filters change
  useEffect(() => {
    loadRoutes();
  }, [selectedParty, routesPage, routeSearch, routeStatusFilter]);

  const loadParties = async () => {
    try {
      setIsPartiesLoading(true);
      const res = await partyService.getParties({
        page: partiesPage,
        limit: 15,
        search: partySearch || undefined,
        status: partyStatusFilter || undefined,
      });
      const items = res.data.items || [];
      setParties(items);
      setTotalParties(res.data.total || 0);

      // Auto-select first party on initial load
      if (items.length > 0) {
        setSelectedParty((current) => {
          if (!current) return items[0];
          const found = items.find((p) => p.id === current.id);
          return found || current;
        });
      }
    } catch (err) {
      console.error('Failed to load parties', err);
    } finally {
      setIsPartiesLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      setIsRoutesLoading(true);
      const res = await routeService.getRoutes({
        page: routesPage,
        limit: 15,
        search: routeSearch || undefined,
        party_id: selectedParty ? selectedParty.id : undefined,
        status: routeStatusFilter || undefined,
      });
      setRoutes(res.data.items || []);
      setTotalRoutes(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load routes', err);
    } finally {
      setIsRoutesLoading(false);
    }
  };

  // --- Party CRUD Handlers ---
  const openCreatePartyModal = () => {
    setEditingParty(null);
    setPartyFormData({ name: '', contact_person: '', mobile_number: '', address: '' });
    setPartyFormError('');
    setIsPartyModalOpen(true);
  };

  const openEditPartyModal = (party: Party, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingParty(party);
    setPartyFormData({
      name: party.name,
      contact_person: party.contact_person || '',
      mobile_number: party.mobile_number || '',
      address: party.address || '',
    });
    setPartyFormError('');
    setIsPartyModalOpen(true);
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyFormData.name.trim()) {
      setPartyFormError('Party name is required.');
      return;
    }

    try {
      setIsPartySubmitting(true);
      setPartyFormError('');
      if (editingParty) {
        await partyService.updateParty(editingParty.id, partyFormData);
      } else {
        const res = await partyService.createParty(partyFormData);
        if (res.data) {
          setSelectedParty(res.data);
        }
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      loadParties();
    } catch (err: any) {
      setPartyFormError(err.message || 'Failed to save party.');
    } finally {
      setIsPartySubmitting(false);
    }
  };

  const handleDeleteParty = async (party: Party, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete party "${party.name}"?`)) return;
    try {
      await partyService.deleteParty(party.id);
      if (selectedParty?.id === party.id) {
        setSelectedParty(null);
      }
      loadParties();
    } catch (err: any) {
      alert(err.message || 'Failed to delete party.');
    }
  };

  // --- Route/Unit CRUD Handlers ---
  const openCreateRouteModal = () => {
    setEditingRoute(null);
    setRouteFormData({
      party_id: selectedParty ? selectedParty.id : 0,
      from_location: 'Erode',
      to_location: '',
      distance_km: '',
      rate_per_unit: '',
      status: 'ACTIVE',
    });
    setRouteFormError('');
    setIsRouteModalOpen(true);
  };

  const openEditRouteModal = (route: Route) => {
    setEditingRoute(route);
    setRouteFormData({
      party_id: route.party_id || (selectedParty ? selectedParty.id : 0),
      from_location: route.from_location || 'Erode',
      to_location: route.to_location,
      distance_km: route.distance_km ? String(route.distance_km) : '',
      rate_per_unit: route.rate_per_unit ? String(route.rate_per_unit) : '',
      status: route.status,
    });
    setRouteFormError('');
    setIsRouteModalOpen(true);
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFormData.to_location.trim()) {
      setRouteFormError('Party Unit / Destination name is required.');
      return;
    }

    try {
      setIsRouteSubmitting(true);
      setRouteFormError('');
      const payload: any = {
        from_location: (routeFormData.from_location || 'Erode').trim(),
        to_location: routeFormData.to_location.trim(),
        distance_km: routeFormData.distance_km ? parseFloat(routeFormData.distance_km) : undefined,
        rate_per_unit: routeFormData.rate_per_unit ? parseFloat(routeFormData.rate_per_unit) : undefined,
        party_id: routeFormData.party_id || (selectedParty ? selectedParty.id : undefined),
        status: routeFormData.status,
      };

      if (editingRoute) {
        await routeService.updateRoute(editingRoute.id, payload);
      } else {
        await routeService.createRoute(payload);
      }

      setIsRouteModalOpen(false);
      setEditingRoute(null);
      loadRoutes();
      loadParties(); // Refresh route/unit count badges
    } catch (err: any) {
      setRouteFormError(err.message || 'Failed to save unit.');
    } finally {
      setIsRouteSubmitting(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm(`Are you sure you want to delete unit/destination "${route.to_location}"?`)) return;
    try {
      await routeService.deleteRoute(route.id);
      loadRoutes();
      loadParties(); // Refresh route/unit count badges
    } catch (err: any) {
      alert(err.message || 'Failed to delete unit.');
    }
  };

  return (
    <div>
      {/* Standard KSP Portal Page Header */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Parties and Units Master</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            Maintain customer accounts and manage their destination delivery units & freight rates
          </p>
        </div>
        <button onClick={openCreatePartyModal} className="btn btn-primary">
          <Plus size={18} /> Add New Party
        </button>
      </div>

      {/* Main Two-Column Master-Detail Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '310px minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Parties Master List */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: 0,
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color="var(--primary-800)" />
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--primary-900)' }}>
                Parties ({totalParties})
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedParty(null);
                setRoutesPage(1);
              }}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: !selectedParty ? '#1d4ed8' : '#64748b',
                background: !selectedParty ? '#dbeafe' : '#f1f5f9',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              View All Units
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={15} />
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '12.5px', padding: '7px 10px 7px 32px' }}
              placeholder="Search by name, phone..."
              value={partySearch}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setPartiesPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            className="form-control form-select"
            style={{ fontSize: '12px', padding: '6px 10px', height: '32px' }}
            value={partyStatusFilter}
            onChange={(e) => {
              setPartyStatusFilter(e.target.value);
              setPartiesPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          {/* Parties Scroll List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: 'calc(100vh - 300px)',
              minHeight: '400px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {isPartiesLoading ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading parties...
              </div>
            ) : parties.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No parties found.
              </div>
            ) : (
              parties.map((party) => {
                const isSelected = selectedParty?.id === party.id;
                const routesCount = Number(party.routes_count) || 0;

                return (
                  <div
                    key={party.id}
                    onClick={() => {
                      setSelectedParty(party);
                      setRoutesPage(1);
                      setRouteSearch('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderLeft: isSelected ? '4px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top Row: Name + Count Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: isSelected ? '#1e40af' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                        title={party.name}
                      >
                        {party.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: routesCount > 0 ? '#dbeafe' : '#f1f5f9',
                          color: routesCount > 0 ? '#1d4ed8' : '#64748b',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {routesCount} {routesCount === 1 ? 'Unit' : 'Units'}
                      </span>
                    </div>

                    {/* Contact Info (if available) */}
                    {(party.contact_person || party.mobile_number) && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#64748b',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {party.contact_person && <span>{party.contact_person}</span>}
                        {party.contact_person && party.mobile_number && <span> · </span>}
                        {party.mobile_number && <span>{party.mobile_number}</span>}
                      </div>
                    )}

                    {/* Bottom Row: Selected status indicator & Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: isSelected ? '1px dashed #bfdbfe' : '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        {isSelected ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {party.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => openEditPartyModal(party, e)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 6px', height: '24px', fontSize: '11px' }}
                          title="Edit Party Details"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteParty(party, e)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 6px', height: '24px', fontSize: '11px' }}
                          title="Delete Party"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Party Pagination */}
          {totalParties > 15 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '11.5px',
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                disabled={partiesPage <= 1}
                onClick={() => setPartiesPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ color: '#64748b' }}>
                {partiesPage} / {Math.ceil(totalParties / 15)}
              </span>
              <button
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                disabled={partiesPage >= Math.ceil(totalParties / 15)}
                onClick={() => setPartiesPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Specific Party's Delivery Units */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: 0,
            minHeight: '520px',
          }}
        >
          {/* Header Banner */}
          {selectedParty ? (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(30, 64, 175, 0.15)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#93c5fd" />
                  <h3
                    style={{
                      fontSize: '16.5px',
                      fontWeight: 800,
                      margin: 0,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {selectedParty.name}
                  </h3>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#bfdbfe',
                    marginTop: '3px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  {selectedParty.contact_person && <span>Contact: {selectedParty.contact_person}</span>}
                  {selectedParty.mobile_number && <span>Phone: {selectedParty.mobile_number}</span>}
                  {selectedParty.address && <span>{selectedParty.address}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={openCreateRouteModal}
                  className="btn"
                  style={{
                    background: '#ffffff',
                    color: '#1e40af',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                    padding: '7px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <Plus size={15} /> Add Delivery Unit
                </button>
                <button
                  onClick={() => setSelectedParty(null)}
                  className="btn"
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    fontSize: '12px',
                    padding: '7px 10px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="View units across all parties"
                >
                  <X size={14} /> View All
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                  All Delivery Units ({totalRoutes})
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Showing delivery units across all parties. Select a party on the left to filter.
                </p>
              </div>
              <button
                onClick={openCreateRouteModal}
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0 }}
              >
                <Plus size={14} /> Add Delivery Unit
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <Search size={15} />
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '13px', padding: '7px 12px 7px 34px' }}
                placeholder={
                  selectedParty
                    ? `Search units for ${selectedParty.name}...`
                    : 'Search delivery unit / destination...'
                }
                value={routeSearch}
                onChange={(e) => {
                  setRouteSearch(e.target.value);
                  setRoutesPage(1);
                }}
              />
            </div>

            <select
              className="form-control form-select"
              style={{ width: '140px', fontSize: '12px', height: '34px' }}
              value={routeStatusFilter}
              onChange={(e) => {
                setRouteStatusFilter(e.target.value);
                setRoutesPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {/* Units Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Party Unit / Destination</th>
                  {!selectedParty && <th>Applicable Party</th>}
                  <th>Origin</th>
                  <th>Freight Rate</th>
                  <th>Distance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isRoutesLoading ? (
                  <tr>
                    <td
                      colSpan={selectedParty ? 6 : 7}
                      style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}
                    >
                      Loading units...
                    </td>
                  </tr>
                ) : routes.length === 0 ? (
                  <tr>
                    <td colSpan={selectedParty ? 6 : 7} style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Compass size={36} color="#94a3b8" />
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '14.5px' }}>
                          {selectedParty
                            ? `No delivery units found for "${selectedParty.name}"`
                            : 'No delivery units found.'}
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: 0 }}>
                          {selectedParty
                            ? 'Add delivery destination units (e.g. SIPCOT, PALANI, KUNDADAM) for this party.'
                            : 'Click "+ Add Delivery Unit" to create a new delivery unit.'}
                        </p>
                        <button
                          onClick={openCreateRouteModal}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '6px' }}
                        >
                          <Plus size={14} /> Add First Unit
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  routes.map((route) => (
                    <tr key={route.id}>
                      {/* Destination Unit */}
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#1e40af',
                            background: '#eff6ff',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <MapPin size={12} /> {route.to_location}
                        </span>
                      </td>

                      {/* Applicable Party (shown only when View All mode is active) */}
                      {!selectedParty && (
                        <td>
                          {route.party_name ? (
                            <strong style={{ color: 'var(--primary-900)' }}>{route.party_name}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Common / All Parties</span>
                          )}
                        </td>
                      )}

                      {/* Origin */}
                      <td>
                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12.5px' }}>
                          {route.from_location || 'Erode'}
                        </span>
                      </td>

                      {/* Freight Rate */}
                      <td>
                        {route.rate_per_unit ? (
                          <strong style={{ color: '#d97706', fontSize: '13px', fontWeight: 800 }}>
                            ₹{parseFloat(String(route.rate_per_unit)).toLocaleString('en-IN')}/Ton
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Distance */}
                      <td>
                        <span style={{ fontSize: '12.5px', color: '#475569' }}>
                          {route.distance_km ? `${route.distance_km} KM` : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={route.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '5px' }}>
                          <button
                            onClick={() => openEditRouteModal(route)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '3px 6px', height: '26px' }}
                            title="Edit Unit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px', height: '26px' }}
                            title="Delete Unit"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Route Pagination */}
          {totalRoutes > 15 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                fontSize: '12.5px',
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                disabled={routesPage <= 1}
                onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ color: '#64748b' }}>
                Page {routesPage} of {Math.ceil(totalRoutes / 15)} ({totalRoutes} total units)
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={routesPage >= Math.ceil(totalRoutes / 15)}
                onClick={() => setRoutesPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Add / Edit Party */}
      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        title={editingParty ? `Edit Party: ${editingParty.name}` : 'Add New Party'}
      >
        {partyFormError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {partyFormError}
          </div>
        )}
        <form onSubmit={handlePartySubmit}>
          <div className="form-group">
            <label className="form-label">Party / Customer Company Name *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. KRISHI NUTRITION COMPANY"
              value={partyFormData.name}
              onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Arun Kumar"
                value={partyFormData.contact_person}
                onChange={(e) => setPartyFormData({ ...partyFormData, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={partyFormData.mobile_number}
                onChange={(e) => setPartyFormData({ ...partyFormData, mobile_number: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Office / Billing Address</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Enter full address"
              value={partyFormData.address}
              onChange={(e) => setPartyFormData({ ...partyFormData, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsPartyModalOpen(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPartySubmitting}>
              {isPartySubmitting ? 'Saving...' : 'Save Party'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Add / Edit Delivery Unit */}
      <Modal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title={
          editingRoute
            ? `Edit Delivery Unit`
            : `Add Delivery Unit for ${selectedParty?.name || 'Party'}`
        }
      >
        {routeFormError && (
          <div
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {routeFormError}
          </div>
        )}
        <form onSubmit={handleRouteSubmit}>
          <div className="form-group">
            <label className="form-label">Applicable Party *</label>
            <select
              className="form-control form-select"
              required
              value={routeFormData.party_id || ''}
              onChange={(e) =>
                setRouteFormData({ ...routeFormData, party_id: parseInt(e.target.value) || 0 })
              }
            >
              <option value="">Select Party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">From (Origin)</label>
              <input
                type="text"
                className="form-control"
                disabled
                value="Erode"
                style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                Fixed origin for dispatches
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">To (Party Unit Name / Destination) *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. SIPCOT, PALANI, KUNDADAM"
                value={routeFormData.to_location}
                onChange={(e) => setRouteFormData({ ...routeFormData, to_location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Freight Rate (₹ / Ton)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="e.g. 450"
                value={routeFormData.rate_per_unit}
                onChange={(e) => setRouteFormData({ ...routeFormData, rate_per_unit: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Distance (KM) (Optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                placeholder="e.g. 85"
                value={routeFormData.distance_km}
                onChange={(e) => setRouteFormData({ ...routeFormData, distance_km: e.target.value })}
              />
            </div>
          </div>

          {editingRoute && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control form-select"
                value={routeFormData.status}
                onChange={(e) =>
                  setRouteFormData({ ...routeFormData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsRouteModalOpen(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isRouteSubmitting}>
              {isRouteSubmitting ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PartiesPage;
