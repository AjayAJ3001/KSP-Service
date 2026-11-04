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
} from 'react-native';
import {
  UserCheck,
  Plus,
  Search,
  Calendar,
  Truck,
  CreditCard,
  Trash2,
  X,
  RefreshCw,
  Clock,
  FileText,
  Printer,
  Download,
  Wallet,
  RotateCcw,
  Navigation,
  Briefcase,
} from 'lucide-react-native';
import {
  adminDriverAdvanceService,
  adminDriverService,
  adminUserService,
  adminVehicleService,
  adminOwnerService,
  adminTripService,
} from '../../services/adminService';
import { DriverAdvance, Driver, User, Vehicle, Owner, Trip } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { printMastersPdf, downloadMastersPdf } from '../../utils/pdfGenerator';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';

const getTripStatusStyle = (status?: string) => {
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
      return { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' };
  }
};

const getTripStatusTextStyle = (status?: string) => {
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

export const AdminDriverAdvancesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [advances, setAdvances] = useState<DriverAdvance[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<number | undefined>(undefined);
  const [vehicleFilter, setVehicleFilter] = useState<number | undefined>(undefined);

  // Vehicles filtered by selected owner
  const availableVehicles = useMemo(() => {
    if (ownerFilter === undefined) return vehicles;
    return vehicles.filter((v) => v.owner_id === ownerFilter);
  }, [vehicles, ownerFilter]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<'print' | 'download' | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | 'form' | null>(null);

  const hasActiveFilters = Boolean(search || modeFilter !== '' || ownerFilter !== undefined || vehicleFilter !== undefined || fromDate || toDate);

  const handleClearAllFilters = () => {
    setSearch('');
    setModeFilter('');
    setOwnerFilter(undefined);
    setVehicleFilter(undefined);
    setFromDate('');
    setToDate('');
  };

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [driverTrips, setDriverTrips] = useState<Trip[]>([]);
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [notes, setNotes] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [dRes, uRes, vRes, oRes] = await Promise.all([
        adminDriverService.getDrivers({ limit: 100, status: 'ACTIVE' }),
        adminUserService.getUsers({ limit: 100, status: 'ACTIVE' }),
        adminVehicleService.getVehicles({ limit: 100, status: 'ACTIVE' }),
        adminOwnerService.getOwners({ limit: 100 }),
      ]);
      setDrivers(dRes.data.items || []);
      setManagers((uRes.data.items || []).filter(u => u.role === 'MANAGER' || u.role === 'ADMIN'));
      setVehicles(vRes.data.items || []);
      setOwners(oRes.data.items || []);
    } catch (e) {
      console.warn('Failed to load lookups', e);
    }
  }, []);

  const loadAdvances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminDriverAdvanceService.getDriverAdvances({
        search: search.trim() || undefined,
        payment_mode: modeFilter || undefined,
        owner_id: ownerFilter,
        vehicle_id: vehicleFilter !== undefined ? String(vehicleFilter) : undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
        limit: 100,
      });
      setAdvances(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (err: any) {
      console.error('Failed to load driver advances', err);
      Alert.alert('Error', err.message || 'Could not fetch driver advances.');
    } finally {
      setIsLoading(false);
    }
  }, [search, modeFilter, ownerFilter, vehicleFilter, fromDate, toDate]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const loadDriverTripsForModal = async (driverId: number) => {
    try {
      const res = await adminTripService.getTrips({ driver_id: String(driverId), limit: 100 });
      const items: Trip[] = res.data?.items || [];
      setDriverTrips(items.filter(t => !['CANCELLED', 'DRAFT'].includes(t.status)));
    } catch {
      setDriverTrips([]);
    }
  };

  const openAddModal = () => {
    const firstDriver = drivers.length > 0 ? drivers[0] : null;
    setSelectedDriverId(firstDriver ? firstDriver.id : null);
    setSelectedManagerId(managers.length > 0 ? managers[0].id : null);
    setSelectedVehicleId(null);
    setSelectedTripId(null);
    setDriverTrips([]);
    setAmount('');
    setAdvanceDate(getTodayISO());
    setPaymentMode('CASH');
    setNotes('');
    if (firstDriver) loadDriverTripsForModal(firstDriver.id);
    setIsModalOpen(true);
  };

  const handleSaveAdvance = async () => {
    if (!selectedDriverId) return Alert.alert('Required', 'Please select a driver');
    if (!selectedManagerId) return Alert.alert('Required', 'Please select a manager');
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return Alert.alert('Required', 'Enter a valid advance amount');

    try {
      setIsSubmitting(true);
      await adminDriverAdvanceService.createDriverAdvance({
        driver_id: selectedDriverId,
        manager_id: selectedManagerId,
        vehicle_id: selectedVehicleId || undefined,
        trip_id: selectedTripId || undefined,
        amount: amt,
        advance_date: advanceDate.trim() || undefined,
        payment_mode: paymentMode,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Driver advance recorded successfully.');
      setIsModalOpen(false);
      loadAdvances();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not save driver advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdvance = (adv: DriverAdvance) => {
    Alert.alert(
      'Delete Driver Advance',
      `Delete advance entry #${adv.id} of ${formatCurrency(adv.amount)} for driver ${adv.driver_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDriverAdvanceService.deleteDriverAdvance(adv.id);
              Alert.alert('Deleted', 'Driver advance entry removed.');
              loadAdvances();
            } catch (e: any) {
              Alert.alert('Delete Failed', e.message);
            }
          },
        },
      ]
    );
  };

  const loadDriverAdvancePdfData = async () => {
    const [advRes, sumRes] = await Promise.all([
      adminDriverAdvanceService.getDriverAdvances({
        search: search.trim() || undefined,
        payment_mode: modeFilter || undefined,
        owner_id: ownerFilter,
        vehicle_id: vehicleFilter !== undefined ? String(vehicleFilter) : undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
        limit: 5000,
      }),
      adminDriverAdvanceService.getDriverSummary({
        owner_id: ownerFilter,
        vehicle_id: vehicleFilter,
        search: search.trim() || undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
      }),
    ]);
    return {
      tab: 'DRIVER_ADVANCES' as const,
      tabLabel: 'Driver Advance Summary',
      driverAdvances: advRes.data.items || [],
      driverSummaries: sumRes.data?.drivers || [],
    };
  };

  const handlePrintPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading('print');
      await printMastersPdf(await loadDriverAdvancePdfData());
    } catch (err: any) {
      console.error('Print driver advances PDF failed', err);
      Alert.alert('Print Error', err.message || 'Failed to print driver advances.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading('download');
      const result = await downloadMastersPdf(await loadDriverAdvancePdfData());
      if (result.success && result.savedDirectly) {
        Alert.alert('PDF Saved', `Driver advances directory saved:\n${result.filename}`);
      }
    } catch (err: any) {
      console.error('Download driver advances PDF failed', err);
      Alert.alert('Download Error', err.message || 'Failed to download PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search & Actions Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search driver, manager, vehicle..."
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
            style={[styles.pdfBtn, styles.printBtn, pdfLoading === 'print' && { opacity: 0.7 }]}
            onPress={handlePrintPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'print' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Printer size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>Print</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pdfBtn, styles.downloadBtn, pdfLoading === 'download' && { opacity: 0.7 }]}
            onPress={handleDownloadPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'download' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Download size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>


        </View>

        {/* Mode Filter Pills & Clear */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.modeRow, { flex: 1 }]}>
            {['', 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modePill, modeFilter === m && styles.modePillActive]}
                onPress={() => setModeFilter(modeFilter === m ? '' : m)}
              >
                <Text style={[styles.modePillText, modeFilter === m && styles.modePillTextActive]}>
                  {m === '' ? 'All Modes' : m.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

        {/* Owner Filter Chips */}
        {owners.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.ownerPill, ownerFilter === undefined && styles.ownerPillActive]}
              onPress={() => setOwnerFilter(undefined)}
            >
              <Text style={[styles.ownerPillText, ownerFilter === undefined && styles.ownerPillTextActive]}>
                All Owners
              </Text>
            </TouchableOpacity>
            {owners.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.ownerPill, ownerFilter === o.id && styles.ownerPillActive]}
                onPress={() => {
                  if (ownerFilter === o.id) {
                    setOwnerFilter(undefined);
                  } else {
                    setOwnerFilter(o.id);
                    if (vehicleFilter !== undefined) {
                      const veh = vehicles.find((v) => v.id === vehicleFilter);
                      if (veh && veh.owner_id !== o.id) {
                        setVehicleFilter(undefined);
                      }
                    }
                  }
                }}
              >
                <Text style={[styles.ownerPillText, ownerFilter === o.id && styles.ownerPillTextActive]}>
                  {o.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Vehicle / Truck Filter Chips (Filtered by Selected Owner) */}
        {availableVehicles.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modePill, vehicleFilter === undefined && styles.modePillActive]}
              onPress={() => setVehicleFilter(undefined)}
            >
              <Text style={[styles.modePillText, vehicleFilter === undefined && styles.modePillTextActive]}>
                {ownerFilter !== undefined ? 'All Trucks of Owner' : 'All Trucks'}
              </Text>
            </TouchableOpacity>
            {availableVehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.modePill, vehicleFilter === v.id && styles.modePillActive]}
                onPress={() => {
                  if (vehicleFilter === v.id) {
                    setVehicleFilter(undefined);
                  } else {
                    setVehicleFilter(v.id);
                    if (v.owner_id && ownerFilter === undefined) {
                      setOwnerFilter(v.owner_id);
                    }
                  }
                }}
              >
                <Text style={[styles.modePillText, vehicleFilter === v.id && styles.modePillTextActive]}>
                  {v.lorry_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Date Range Filter */}
        <View style={{ paddingHorizontal: SPACING.sm, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
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
        </View>

        {/* Total Summary Banner */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL DRIVER ADVANCES GIVEN</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summarySub}>{total} Entries</Text>
            <TouchableOpacity onPress={loadAdvances} style={styles.reloadBtn}>
              <RefreshCw size={14} color={COLORS.primaryDark} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Advance Records List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Driver Advances...</Text>
        </View>
      ) : advances.length === 0 ? (
        <View style={styles.centerBox}>
          <Wallet size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No driver advances found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {advances.map((adv) => (
            <View key={adv.id} style={styles.card}>
              {/* Advance Source & Balance Badges */}
              <View style={styles.sourceBadgesRow}>
                {adv.source_type === 'TRIP_TRUCK_ADVANCE' ? (
                  <View style={styles.truckAdvSourceBadge}>
                    <Truck size={10} color="#0284c7" />
                    <Text style={styles.truckAdvSourceBadgeText}>VIA TRUCK ADVANCE</Text>
                  </View>
                ) : adv.source_type === 'OWNER_DIRECT_ADVANCE' ? (
                  <View style={[styles.directAdvSourceBadge, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                    <Briefcase size={10} color="#7c3aed" />
                    <Text style={[styles.directAdvSourceBadgeText, { color: '#7c3aed' }]}>DIRECT OWNER ADVANCE</Text>
                  </View>
                ) : (
                  <View style={styles.directAdvSourceBadge}>
                    <UserCheck size={10} color="#047857" />
                    <Text style={styles.directAdvSourceBadgeText}>DIRECT DRIVER ADVANCE</Text>
                  </View>
                )}
                {adv.driver_balance_in_hand !== undefined && (
                  <View style={[styles.balanceBadge, { backgroundColor: Number(adv.driver_balance_in_hand) <= 0 ? '#f8fafc' : '#ecfdf5', borderColor: Number(adv.driver_balance_in_hand) <= 0 ? '#e2e8f0' : '#a7f3d0' }]}>
                    <Text style={[styles.balanceBadgeText, { color: Number(adv.driver_balance_in_hand) <= 0 ? '#64748b' : '#047857' }]}>
                      In Hand: {formatCurrency(Math.max(0, Number(adv.driver_balance_in_hand)))}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardTop}>
                <View style={styles.driverTag}>
                  <UserCheck size={16} color="#059669" />
                  <View>
                    <Text style={styles.driverName}>{adv.driver_name}</Text>
                    {adv.driver_mobile ? (
                      <Text style={styles.driverSub}>{adv.driver_mobile}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>{formatCurrency(adv.amount)}</Text>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeText}>{adv.payment_mode || 'CASH'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Manager:</Text>
                  <Text style={styles.detailValue}>{adv.manager_name}</Text>
                </View>
                {adv.lorry_number ? (
                  <View style={styles.detailItem}>
                    <Truck size={12} color={COLORS.textMuted} />
                    <Text style={styles.detailValue}>{adv.lorry_number}</Text>
                  </View>
                ) : null}
              </View>

              {adv.owner_name ? (
                <View style={styles.ownerBadgeRow}>
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>👤 Owner: {adv.owner_name}</Text>
                  </View>
                </View>
              ) : null}

              {/* Trip Details Section (based on truck advance / linked trip) */}
              {(adv.trip_id || adv.party_name || adv.from_location || adv.source_type === 'TRIP_TRUCK_ADVANCE') ? (
                <View style={styles.tripDetailsBox}>
                  <View style={styles.tripHeaderRow}>
                    <View style={styles.tripIdTag}>
                      <Navigation size={12} color={COLORS.primary} />
                      <Text style={styles.tripIdText}>
                        {adv.trip_id ? `TRIP #${adv.trip_id}` : 'TRIP DETAILS'}
                      </Text>
                    </View>
                    {adv.trip_status ? (
                      <View style={[styles.tripStatusBadge, getTripStatusStyle(adv.trip_status)]}>
                        <Text style={[styles.tripStatusText, getTripStatusTextStyle(adv.trip_status)]}>
                          {adv.trip_status}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {adv.party_name ? (
                    <Text style={styles.tripPartyText} numberOfLines={1}>
                      🏢 Party: <Text style={{ fontWeight: '800' }}>{adv.party_name}</Text>
                    </Text>
                  ) : null}

                  {(adv.from_location || adv.to_location) ? (
                    <Text style={styles.tripRouteText} numberOfLines={1}>
                      📍 Route: {adv.from_location || '—'} → {adv.to_location || '—'}
                    </Text>
                  ) : null}

                  <View style={styles.tripMetricsGrid}>
                    {adv.goods_weight ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Weight</Text>
                        <Text style={styles.tripMetricVal}>
                          {adv.goods_weight} {adv.unit_abbreviation || adv.unit_name || 'MT'}
                        </Text>
                      </View>
                    ) : null}
                    {adv.total_freight ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Freight</Text>
                        <Text style={[styles.tripMetricVal, { color: COLORS.primary }]}>
                          {formatCurrency(adv.total_freight)}
                        </Text>
                      </View>
                    ) : null}
                    {adv.trip_advance_paid ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Trip Adv</Text>
                        <Text style={[styles.tripMetricVal, { color: '#d97706' }]}>
                          {formatCurrency(adv.trip_advance_paid)}
                        </Text>
                      </View>
                    ) : null}
                    {adv.trip_driver_expenses ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Expenses</Text>
                        <Text style={[styles.tripMetricVal, { color: '#dc2626' }]}>
                          {formatCurrency(adv.trip_driver_expenses)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {adv.trip_date ? (
                    <Text style={styles.tripDateFooter}>
                      📅 Trip Date: {formatDateDMY(adv.trip_date)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Calendar size={12} color={COLORS.textMuted} />
                  <Text style={styles.dateText}>
                    {adv.advance_date ? formatDateDMY(adv.advance_date) : '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.delBtn}
                  onPress={() => handleDeleteAdvance(adv)}
                >
                  <Trash2 size={13} color="#dc2626" />
                  <Text style={styles.delBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>

              {adv.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>Note: {adv.notes}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Advance Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Give Driver Advance</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              {/* Select Driver */}
              <Text style={styles.label}>DRIVER *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {drivers.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.selectPill, selectedDriverId === d.id && styles.selectPillActive]}
                    onPress={() => {
                      setSelectedDriverId(d.id);
                      setSelectedTripId(null);
                      loadDriverTripsForModal(d.id);
                    }}
                  >
                    <Text style={[styles.selectPillText, selectedDriverId === d.id && styles.selectPillTextActive]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Link to Trip (Optional) */}
              <Text style={styles.label}>LINK TO TRIP (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.selectPill, selectedTripId === null && styles.selectPillActive]}
                  onPress={() => setSelectedTripId(null)}
                >
                  <Text style={[styles.selectPillText, selectedTripId === null && styles.selectPillTextActive]}>
                    No Trip · General
                  </Text>
                </TouchableOpacity>
                {driverTrips.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.selectPill, selectedTripId === t.id && styles.selectPillActive]}
                    onPress={() => setSelectedTripId(t.id)}
                  >
                    <Text style={[styles.selectPillText, selectedTripId === t.id && styles.selectPillTextActive]}>
                      T-{t.id} · {(t as any).from_location ?? ''}→{(t as any).to_location ?? ''}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!selectedDriverId && (
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, alignSelf: 'center', paddingHorizontal: 8 }}>Select driver to see trips</Text>
                )}
                {selectedDriverId && driverTrips.length === 0 && (
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, alignSelf: 'center', paddingHorizontal: 8 }}>No active trips for this driver</Text>
                )}
              </ScrollView>

              {/* Select Manager */}
              <Text style={styles.label}>GIVEN BY (MANAGER / ADMIN) *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {managers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.selectPill, selectedManagerId === m.id && styles.selectPillActive]}
                    onPress={() => setSelectedManagerId(m.id)}
                  >
                    <Text style={[styles.selectPillText, selectedManagerId === m.id && styles.selectPillTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Select Vehicle (Optional) */}
              <Text style={styles.label}>VEHICLE / LORRY (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.selectPill, selectedVehicleId === null && styles.selectPillActive]}
                  onPress={() => setSelectedVehicleId(null)}
                >
                  <Text style={[styles.selectPillText, selectedVehicleId === null && styles.selectPillTextActive]}>
                    None / General
                  </Text>
                </TouchableOpacity>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.selectPill, selectedVehicleId === v.id && styles.selectPillActive]}
                    onPress={() => setSelectedVehicleId(v.id)}
                  >
                    <Text style={[styles.selectPillText, selectedVehicleId === v.id && styles.selectPillTextActive]}>
                      {v.lorry_number}{v.owner_name ? ` (${v.owner_name})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Amount */}
              <Text style={styles.label}>ADVANCE AMOUNT (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Date */}
              <Text style={styles.label}>ADVANCE DATE (DD-MM-YYYY)</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setDatePickerTarget('form')}
              >
                <Text style={{ fontSize: 13, color: advanceDate ? COLORS.text : COLORS.textMuted, fontWeight: advanceDate ? '600' : '400' }}>
                  {advanceDate ? toDisplayDate(advanceDate) : 'Select Date (DD-MM-YYYY)'}
                </Text>
                <Calendar size={15} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Payment Mode */}
              <Text style={styles.label}>PAYMENT MODE *</Text>
              <View style={styles.modeBtnGroup}>
                {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeBtn, paymentMode === mode && styles.modeBtnActive]}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Text style={[styles.modeBtnText, paymentMode === mode && styles.modeBtnTextActive]}>
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={styles.label}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                placeholder="Reason or reference..."
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSaveAdvance}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Advance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Calendar Date Picker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={
          datePickerTarget === 'from' ? fromDate :
          datePickerTarget === 'to' ? toDate :
          datePickerTarget === 'form' ? advanceDate : ''
        }
        title={
          datePickerTarget === 'from' ? 'Filter: From Date' :
          datePickerTarget === 'to' ? 'Filter: To Date' :
          'Select Advance Date'
        }
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          else if (datePickerTarget === 'form') setAdvanceDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  printBtn: {
    backgroundColor: '#0284c7',
  },
  downloadBtn: {
    backgroundColor: '#059669',
  },
  pdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
  },
  modeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  ownerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3e8ff',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  ownerPillActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  ownerPillText: {
    fontSize: 11,
    color: '#6d28d9',
    fontWeight: '600',
  },
  ownerPillTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  ownerBadge: {
    backgroundColor: '#f3e8ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6d28d9',
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  modePillActive: {
    backgroundColor: COLORS.primary,
  },
  modePillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modePillTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: RADIUS.lg,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
  },
  summarySub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  reloadBtn: {
    marginTop: 4,
    padding: 4,
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  driverSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  modeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sourceBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  truckAdvSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  truckAdvSourceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.3,
  },
  directAdvSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  directAdvSourceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.3,
  },
  balanceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  balanceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tripDetailsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.md,
    padding: 8,
    gap: 3,
    marginTop: 4,
    marginBottom: 2,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tripIdTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tripStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tripStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tripPartyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  tripRouteText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tripMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tripMetricItem: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripMetricLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tripMetricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
  },
  tripDateFooter: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  delBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fef2f2',
  },
  delBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: RADIUS.sm,
  },
  notesText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  selectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  selectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectPillTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
  },
  modeBtnGroup: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modeBtnTextActive: {
    color: COLORS.white,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
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
    borderRadius: 20,
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
