import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import {
  Navigation,
  Search,
  Truck,
  CreditCard,
  FileCheck,
  Building2,
  User,
  Plus,
  X,
  TrendingUp,
  Receipt,
  Trash2,
  FileText,
  Printer,
  Download,
  ChevronDown,
  Check,
  RotateCcw,
  Calendar,
} from 'lucide-react-native';
import { adminTripService, adminOwnerService, adminVehicleService } from '../../services/adminService';
import { Trip, Owner, Vehicle } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { downloadTripPdf, downloadReportsPdf, printReportsPdf } from '../../utils/pdfGenerator';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';

type TripStatusFilter = 'ALL' | 'NEW' | 'PAYMENT_PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'CANCELLED';

export const AdminTripsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [pickerModalType, setPickerModalType] = useState<'owner' | 'vehicle' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);

  // Available vehicles filtered dynamically by selected owner
  const availableVehicles = useMemo(() => {
    if (!ownerFilter) return vehicles;
    return vehicles.filter(v => String(v.owner_id) === String(ownerFilter));
  }, [vehicles, ownerFilter]);

  // Modal options filtered by search term
  const modalItems = useMemo(() => {
    if (pickerModalType === 'owner') {
      const allOwnersOption = { id: '', name: 'All Owners', mobile: '' };
      const list = owners.map(o => ({ id: String(o.id), name: o.name, mobile: (o as any).mobile_number || '' }));
      if (!modalSearch.trim()) return [allOwnersOption, ...list];
      const q = modalSearch.toLowerCase();
      return [
        allOwnersOption,
        ...list.filter(o => o.name.toLowerCase().includes(q) || (o.mobile && o.mobile.includes(q)))
      ];
    } else if (pickerModalType === 'vehicle') {
      const allVehiclesOption = {
        id: '',
        lorry_number: ownerFilter ? `All Trucks for Owner (${availableVehicles.length})` : 'All Trucks / Lorries',
        owner_name: ''
      };
      const list = availableVehicles.map(v => ({ id: String(v.id), lorry_number: v.lorry_number, owner_name: v.owner_name || '' }));
      if (!modalSearch.trim()) return [allVehiclesOption, ...list];
      const q = modalSearch.toLowerCase();
      return [
        allVehiclesOption,
        ...list.filter(v => v.lorry_number.toLowerCase().includes(q) || (v.owner_name && v.owner_name.toLowerCase().includes(q)))
      ];
    }
    return [];
  }, [pickerModalType, owners, availableVehicles, ownerFilter, modalSearch]);

  const hasActiveFilters = Boolean(search || statusFilter !== 'ALL' || ownerFilter || vehicleFilter || fromDate || toDate);

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setOwnerFilter('');
    setVehicleFilter('');
    setFromDate('');
    setToDate('');
  };

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminTripService.getTrips({
        limit: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        owner_id: ownerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
      });
      setTrips(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load trips', err);
      Alert.alert('Error', err.message || 'Could not fetch trips.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, ownerFilter, vehicleFilter, fromDate, toDate]);

  const loadOwners = useCallback(async () => {
    try {
      const res = await adminOwnerService.getOwners({ limit: 200 });
      setOwners(res.data.items || []);
    } catch (e) {
      console.warn('Failed to load owners', e);
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await adminVehicleService.getVehicles({ limit: 200 });
      setVehicles(res.data.items || []);
    } catch (e) {
      console.warn('Failed to load vehicles', e);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    loadOwners();
    loadVehicles();
  }, [loadOwners, loadVehicles]);


  const filteredTrips = trips.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.lorry_number && t.lorry_number.toLowerCase().includes(q)) ||
      (t.party_name && t.party_name.toLowerCase().includes(q)) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(q))
    );
  });

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const handleDownloadFilteredTripsPdf = async () => {
    try {
      setPdfLoading('trips_pdf');
      const activeOwner = owners.find(o => String(o.id) === ownerFilter);
      const activeVeh = vehicles.find(v => String(v.id) === vehicleFilter);
      const filterParts: string[] = [];
      if (statusFilter !== 'ALL') filterParts.push(`Status: ${statusFilter}`);
      if (activeOwner) filterParts.push(`Owner: ${activeOwner.name}`);
      if (activeVeh) filterParts.push(`Truck: ${activeVeh.lorry_number}`);
      if (search) filterParts.push(`Search: "${search}"`);

      const res = await downloadReportsPdf({
        type: 'TRIPS',
        title: 'Trips Operations Dispatch Report',
        filtersText: filterParts.length > 0 ? filterParts.join(' | ') : 'All Active Trips',
        items: filteredTrips,
      });
      if (res.savedDirectly) {
        Alert.alert('Trips Report Saved', `PDF report saved as:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export Trips PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePrintFilteredTripsPdf = async () => {
    try {
      setPdfLoading('trips_print');
      const activeOwner = owners.find(o => String(o.id) === ownerFilter);
      const activeVeh = vehicles.find(v => String(v.id) === vehicleFilter);
      const filterParts: string[] = [];
      if (statusFilter !== 'ALL') filterParts.push(`Status: ${statusFilter}`);
      if (activeOwner) filterParts.push(`Owner: ${activeOwner.name}`);
      if (activeVeh) filterParts.push(`Truck: ${activeVeh.lorry_number}`);
      if (search) filterParts.push(`Search: "${search}"`);

      await printReportsPdf({
        type: 'TRIPS',
        title: 'Trips Operations Dispatch Report',
        filtersText: filterParts.length > 0 ? filterParts.join(' | ') : 'All Active Trips',
        items: filteredTrips,
      });
    } catch (e: any) {
      Alert.alert('Print Error', e.message || 'Could not print Trips PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadTripChallan = async (trip: Trip) => {
    try {
      setPdfLoading(`challan_${trip.id}`);
      const res = await downloadTripPdf(trip);
      if (res.savedDirectly) {
        Alert.alert('Trip Slip Saved', `Challan PDF saved as:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not generate Trip Challan PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDeleteTrip = (trip: Trip) => {
    Alert.alert('Delete Trip', `Permanently delete Trip #${trip.id} (${trip.lorry_number})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminTripService.deleteTrip(trip.id);
            loadTrips();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lorry, party, driver..."
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('NewTrip')}
          >
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>New Trip</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {[
            { id: 'ALL', label: 'All Trips' },
            { id: 'NEW', label: 'New' },
            { id: 'PAYMENT_PENDING', label: 'Payment Pending' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'SETTLED', label: 'Settled' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, statusFilter === s.id && styles.chipActive]}
              onPress={() => setStatusFilter(statusFilter === s.id ? 'ALL' : (s.id as TripStatusFilter))}
            >
              <Text style={[styles.chipText, statusFilter === s.id && styles.chipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Linked Filter Bar (Owner & Truck) + PDF Export Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Owner Filter Button */}
            <TouchableOpacity
              style={[styles.chip, ownerFilter ? styles.chipActiveOwner : null, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}
              onPress={() => {
                setModalSearch('');
                setPickerModalType('owner');
              }}
            >
              <Building2 size={12} color={ownerFilter ? '#7c3aed' : COLORS.textMuted} />
              <Text style={[styles.chipText, ownerFilter && styles.chipTextActiveOwner]} numberOfLines={1}>
                {owners.find(o => String(o.id) === ownerFilter)?.name || 'All Owners'}
              </Text>
              {ownerFilter ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setOwnerFilter('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={11} color="#7c3aed" />
                </TouchableOpacity>
              ) : (
                <ChevronDown size={11} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>

            {/* Vehicle Filter Button (filtered by selected Owner) */}
            <TouchableOpacity
              style={[styles.chip, vehicleFilter ? styles.chipActive : null, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}
              onPress={() => {
                setModalSearch('');
                setPickerModalType('vehicle');
              }}
            >
              <Truck size={12} color={vehicleFilter ? '#fff' : COLORS.textMuted} />
              <Text style={[styles.chipText, vehicleFilter && styles.chipTextActive]} numberOfLines={1}>
                {vehicles.find(v => String(v.id) === vehicleFilter)?.lorry_number
                  ? vehicles.find(v => String(v.id) === vehicleFilter)!.lorry_number
                  : ownerFilter
                  ? `Lorries (${availableVehicles.length})`
                  : 'All Trucks'}
              </Text>
              {vehicleFilter ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setVehicleFilter('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={11} color="#fff" />
                </TouchableOpacity>
              ) : (
                <ChevronDown size={11} color={vehicleFilter ? '#fff' : COLORS.textMuted} />
              )}
            </TouchableOpacity>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={handleClearAllFilters}
                activeOpacity={0.7}
              >
                <RotateCcw size={11} color="#dc2626" />
                <Text style={styles.clearFiltersBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Range Filter */}
          <View style={styles.dateRangeRow}>
            <TouchableOpacity
              style={[styles.datePickerBtn, fromDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('from')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={fromDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, fromDate ? styles.datePickerBtnTextActive : null]}>
                {fromDate ? toDisplayDate(fromDate) : 'From (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '700' }}>–</Text>
            <TouchableOpacity
              style={[styles.datePickerBtn, toDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('to')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={toDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, toDate ? styles.datePickerBtnTextActive : null]}>
                {toDate ? toDisplayDate(toDate) : 'To (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            {(fromDate || toDate) && (
              <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* PDF Report and Print Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <TouchableOpacity
              style={styles.topActionPdfBtn}
              onPress={handleDownloadFilteredTripsPdf}
              disabled={pdfLoading === 'trips_pdf'}
            >
              {pdfLoading === 'trips_pdf' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FileText size={12} color="#fff" />
                  <Text style={styles.topActionPdfBtnText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topActionPrintBtn}
              onPress={handlePrintFilteredTripsPdf}
              disabled={pdfLoading === 'trips_print'}
            >
              {pdfLoading === 'trips_print' ? (
                <ActivityIndicator size="small" color="#1d4ed8" />
              ) : (
                <>
                  <Printer size={12} color="#1d4ed8" />
                  <Text style={styles.topActionPrintBtnText}>Print</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>


      {/* Trips List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Trips Operations...</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <View style={styles.centerBox}>
          <Navigation size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No trips found for selected filter</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredTrips.map((t) => (
            <View key={t.id} style={styles.tripCard}>
              <View style={styles.cardHeader}>
                <View style={styles.lorryTag}>
                  <Truck size={16} color={COLORS.primary} />
                  <Text style={styles.lorryText}>{t.lorry_number}</Text>
                  <Text style={styles.tripIdText}>#{t.id}</Text>
                </View>

                <View style={[styles.statusBadge, getStatusStyle(t.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(t.status)]}>
                    {t.status}
                  </Text>
                </View>
              </View>

              {/* Party & Route */}
              <Text style={styles.partyText}>{t.party_name}</Text>
              <Text style={styles.routeText}>
                {t.to_location || `${t.from_location} → ${t.to_location}`} • {t.goods_weight} {t.unit_name || 'Ton'} @ ₹{t.freight_rate}
              </Text>

              {/* Financial Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Freight</Text>
                  <Text style={styles.metricVal}>{formatCurrency(t.total_freight)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Advance</Text>
                  <Text style={styles.metricVal}>{formatCurrency(t.advance_paid)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Received</Text>
                  <Text style={[styles.metricVal, { color: '#10b981' }]}>
                    {formatCurrency(t.total_received || 0)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Balance Due</Text>
                  <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                    {formatCurrency(t.balance_due || 0)}
                  </Text>
                </View>
              </View>

              {/* Driver & Date footer */}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>📅 {formatDateDMY(t.trip_date)}</Text>
                <Text style={styles.metaText}>👤 {t.driver_name || 'No driver'}</Text>
              </View>

              {/* Owner badge */}
              {(t as any).owner_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3f0ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 }}>
                  <Building2 size={11} color="#7c3aed" />
                  <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '700' }}>Owner: {(t as any).owner_name}</Text>
                  {(t as any).owner_mobile ? <Text style={{ fontSize: 10, color: '#9ca3af' }}>({(t as any).owner_mobile})</Text> : null}
                </View>
              ) : null}

              {/* Action Buttons: Challan PDF, Party Payment, Driver Expenses, Settlement Slip */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1 }]}
                  onPress={() => handleDownloadTripChallan(t)}
                  disabled={pdfLoading === `challan_${t.id}`}
                >
                  {pdfLoading === `challan_${t.id}` ? (
                    <ActivityIndicator size="small" color="#b91c1c" />
                  ) : (
                    <FileText size={12} color="#b91c1c" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#b91c1c' }]}>Challan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                  onPress={() => navigation.navigate('PartyPayment', { trip: t })}
                >
                  <CreditCard size={12} color="#1d4ed8" />
                  <Text style={[styles.actionBtnText, { color: '#1d4ed8' }]}>Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]}
                  onPress={() => navigation.navigate('DriverExpenses', { trip: t })}
                >
                  <TrendingUp size={12} color="#b45309" />
                  <Text style={[styles.actionBtnText, { color: '#b45309' }]}>Expenses</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#ecfdf5' }]}
                  onPress={() => navigation.navigate('SettlementReceipt', { trip: t })}
                >
                  <Receipt size={12} color="#047857" />
                  <Text style={[styles.actionBtnText, { color: '#047857' }]}>Settlement</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={() => handleDeleteTrip(t)}
                >
                  <Trash2 size={12} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Native Modal Bottom Sheet for Owner / Vehicle Selection */}
      <Modal
        visible={pickerModalType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPickerModalType(null);
          setModalSearch('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setPickerModalType(null);
            setModalSearch('');
          }}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {pickerModalType === 'owner' ? 'Select Truck Owner' : 'Select Truck / Lorry'}
                </Text>
                {pickerModalType === 'vehicle' && ownerFilter ? (
                  <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '700', marginTop: 2 }}>
                    🏢 Filtered for {owners.find(o => String(o.id) === ownerFilter)?.name || 'Owner'} ({availableVehicles.length} vehicles)
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => { setPickerModalType(null); setModalSearch(''); }}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Search inside picker */}
            {((pickerModalType === 'owner' && owners.length > 4) || (pickerModalType === 'vehicle' && availableVehicles.length > 4)) && (
              <View style={styles.modalSearchBox}>
                <Search size={14} color={COLORS.textMuted} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder={`Search ${pickerModalType === 'owner' ? 'owner or phone' : 'lorry number'}...`}
                  placeholderTextColor={COLORS.textMuted}
                  value={modalSearch}
                  onChangeText={setModalSearch}
                  autoCapitalize="none"
                />
                {modalSearch ? (
                  <TouchableOpacity onPress={() => setModalSearch('')}>
                    <X size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <FlatList
              data={modalItems}
              keyExtractor={(item: any) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: { item: any }) => {
                const isSelected = pickerModalType === 'owner'
                  ? (item.id === '' && !ownerFilter) || ownerFilter === item.id
                  : (item.id === '' && !vehicleFilter) || vehicleFilter === item.id;

                const title = pickerModalType === 'owner' ? item.name : item.lorry_number;
                const subtitle = pickerModalType === 'owner'
                  ? item.mobile ? `📞 ${item.mobile}` : ''
                  : item.owner_name ? `🏢 ${item.owner_name}` : '';

                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (pickerModalType === 'owner') {
                        setOwnerFilter(item.id);
                        if (item.id && vehicleFilter) {
                          const curV = vehicles.find(v => String(v.id) === vehicleFilter);
                          if (curV && String(curV.owner_id) !== item.id) {
                            setVehicleFilter('');
                          }
                        }
                      } else {
                        setVehicleFilter(item.id);
                      }
                      setPickerModalType(null);
                      setModalSearch('');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{subtitle}</Text>
                      ) : null}
                    </View>
                    {isSelected && <Check size={18} color={COLORS.accentDark} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Date Picker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'from' ? fromDate : toDate}
        title={datePickerTarget === 'from' ? 'Filter: From Date' : 'Filter: To Date'}
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};


const getStatusStyle = (status: string) => {
  switch (status) {
    case 'SETTLED':
      return { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' };
    case 'PARTIALLY_PAID':
      return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
    case 'PAYMENT_PENDING':
      return { backgroundColor: '#fffbeb', borderColor: '#fde68a' };
    case 'CANCELLED':
      return { backgroundColor: '#fef2f2', borderColor: '#fca5a5' };
    default:
      return { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' };
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'SETTLED':
      return { color: '#047857' };
    case 'PARTIALLY_PAID':
      return { color: '#1d4ed8' };
    case 'PAYMENT_PENDING':
      return { color: '#b45309' };
    case 'CANCELLED':
      return { color: '#b91c1c' };
    default:
      return { color: '#475569' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipActiveOwner: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  chipTextActiveOwner: {
    color: '#7c3aed',
    fontWeight: '800',
  },

  topActionPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  topActionPdfBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  topActionPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  topActionPrintBtnText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 28,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tripCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lorryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lorryText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  tripIdText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  partyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  routeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: '#fffbeb',
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalItemTextSelected: {
    color: COLORS.accentDark,
    fontWeight: '800',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: SPACING.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  clearFiltersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    flexWrap: 'nowrap',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  datePickerBtnActive: {
    backgroundColor: '#eff6ff',
  },
  datePickerBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  datePickerBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dateInput: {
    fontSize: 11,
    color: COLORS.text,
    padding: 0,
    minWidth: 90,
    maxWidth: 110,
  },
});
