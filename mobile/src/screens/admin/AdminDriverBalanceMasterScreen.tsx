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
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  Truck,
  UserCheck,
  Briefcase,
  CreditCard,
  X,
  RefreshCw,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  HandCoins,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Printer,
  Download,
  Share2,
  Filter,
  Check,
  Building,
  Zap,
} from 'lucide-react-native';
import {
  adminDriverAdvanceService,
  adminOwnerAdvanceService,
  adminDriverService,
  adminUserService,
  adminOwnerService,
  adminVehicleService,
  adminTripService,
} from '../../services/adminService';
import {
  printDriverBalanceMasterPdf,
  downloadDriverBalanceMasterPdf,
  shareDriverBalanceMasterPdf,
  printDriverStatementPdf,
  downloadDriverStatementPdf,
  shareDriverStatementPdf,
  DriverBalanceMasterPdfData,
  DriverStatementPdfData,
} from '../../utils/pdfGenerator';
import { Driver, User, Owner, Vehicle, DriverAdvanceSummary, Trip } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';
import { useAuth } from '../../context/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DriverBalanceRow {
  driver_id: number;
  driver_name: string;
  driver_mobile?: string;
  driver_license?: string;
  status: string;
  lorry_number?: string;
  owner_id?: number;
  owner_name?: string;
  // Financials
  total_advance_given: number;
  total_expenses_reported: number;
  balance_in_hand: number;         // cash with driver
  need_to_pay: number;             // office owes driver
  settlement_status?: string;
  remaining_advance_balance: number;
  // Trip info
  trip_count: number;
  advance_count: number;
  // Active trip
  active_trip_id?: number;
  trip_status?: string;
  party_name?: string;
  from_location?: string;
  to_location?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminDriverBalanceMasterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser } = useAuth();
  const isManagerLogin = authUser?.role === 'MANAGER' || authUser?.role === 'TRANSPORT_USER';
  const [drivers, setDrivers] = useState<DriverBalanceRow[]>([]);
  const [tripDrivers, setTripDrivers] = useState<{ id: number; name: string }[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [grandTotals, setGrandTotals] = useState<any>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CASH_IN_HAND' | 'NEED_TO_PAY' | 'SETTLED'>('ALL');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<number | null>(null);
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<number | null>(null);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<number | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // PDF Action Loading states
  const [pdfActionLoading, setPdfActionLoading] = useState<'print' | 'download' | 'share' | null>(null);
  const [driverSlipLoading, setDriverSlipLoading] = useState<{ [driverId: number]: 'print' | 'download' | 'share' | null }>({});

  // Add Advance Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverBalanceRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [giverType, setGiverType] = useState<'MANAGER' | 'OWNER'>('MANAGER');
  const [formDriverId, setFormDriverId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [driverTrips, setDriverTrips] = useState<Trip[]>([]);
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [notes, setNotes] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'form' | null>(null);

  const formatCurrency = (val: number | string) => {
    const num = Math.max(0, parseFloat(String(val)) || 0);
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  // ── Load lookups ─────────────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    try {
      const [uRes, oRes, dRes, vRes] = await Promise.all([
        adminUserService.getUsers({ limit: 200, status: 'ACTIVE', for_advance: true }),
        adminOwnerService.getOwners({ limit: 100 }),
        adminDriverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        adminVehicleService.getVehicles({ limit: 100 }),
      ]);
      const mgrs = (uRes.data.items || []).filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN');
      setManagers(mgrs);
      if (mgrs.length > 0) setSelectedManagerId(mgrs[0].id);
      setOwners(oRes.data.items || []);
      if (oRes.data.items?.length > 0) setSelectedOwnerId(oRes.data.items[0].id);
      setAllDrivers(dRes.data.items || []);
      setVehicles(vRes.data.items || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  }, []);

  // ── Load driver balance summary ───────────────────────────────────────────
  const loadDriverBalances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminDriverAdvanceService.getDriverSummary({
        search: search || undefined,
        owner_id: selectedOwnerFilter || undefined,
        vehicle_id: selectedVehicleFilter || undefined,
      });
      const rows = res.data.drivers || [];

      // Parse rows
      const driverRows: DriverBalanceRow[] = rows.map((r) => ({
        driver_id: r.driver_id,
        driver_name: r.driver_name,
        driver_mobile: r.driver_mobile,
        driver_license: r.driver_license,
        status: r.status,
        lorry_number: r.lorry_number,
        owner_id: r.owner_id,
        owner_name: r.owner_name,
        total_advance_given: Math.max(0, parseFloat(String(r.total_advance_given || 0))),
        total_expenses_reported: Math.max(0, parseFloat(String(r.total_expenses_reported || 0))),
        balance_in_hand: Math.max(0, parseFloat(String(r.balance_in_hand || 0))),
        need_to_pay: Math.max(0, parseFloat(String(r.need_to_pay || 0))),
        settlement_status: r.settlement_status,
        remaining_advance_balance: Math.max(0, parseFloat(String(r.remaining_advance_balance || 0))),
        trip_count: r.trip_count || 0,
        advance_count: r.advance_count || 0,
        active_trip_id: r.trip_id,
        trip_status: r.trip_status,
        party_name: r.party_name,
        from_location: r.from_location,
        to_location: r.to_location,
      }));

      // Sort with highest balance or need_to_pay first
      driverRows.sort((a, b) => {
        const valA = Math.max(a.balance_in_hand, a.need_to_pay);
        const valB = Math.max(b.balance_in_hand, b.need_to_pay);
        return valB - valA;
      });

      setDrivers(driverRows);
      if (!selectedDriverFilter) {
        const unique = Array.from(
          new Map(driverRows.map((r) => [r.driver_id, { id: r.driver_id, name: r.driver_name }])).values()
        );
        setTripDrivers(unique);
      }
      setGrandTotals(res.data.grand_totals || {});
    } catch (err: any) {
      console.error('Failed to load driver balances', err);
      Alert.alert('Error', err.message || 'Could not fetch driver balances.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedOwnerFilter, selectedVehicleFilter, selectedDriverFilter]);

  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { loadDriverBalances(); }, [loadDriverBalances]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDriverBalances();
  };

  // ── Filtered Drivers ───────────────────────────────────────────────────────
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const balInHand = Math.max(0, d.balance_in_hand);
      const needToPay = Math.max(0, d.need_to_pay);

      if (statusFilter === 'CASH_IN_HAND') {
        if (balInHand <= 0) return false;
      } else if (statusFilter === 'NEED_TO_PAY') {
        if (needToPay <= 0 && d.settlement_status !== 'PENDING') return false;
      } else if (statusFilter === 'SETTLED') {
        if (balInHand > 0 || needToPay > 0) return false;
      }

      if (selectedDriverFilter) {
        if (d.driver_id !== selectedDriverFilter) return false;
      }

      if (selectedVehicleFilter) {
        const v = vehicles.find((veh) => veh.id === selectedVehicleFilter);
        if (v && d.lorry_number !== v.lorry_number) return false;
      }

      if (selectedOwnerFilter) {
        if (d.owner_id && d.owner_id !== selectedOwnerFilter) return false;
      }

      return true;
    });
  }, [drivers, statusFilter, selectedDriverFilter, selectedVehicleFilter, selectedOwnerFilter, vehicles]);

  // Dynamic totals of filtered
  const filteredTotals = useMemo(() => {
    return filteredDrivers.reduce(
      (acc, d) => ({
        total_advance_given: acc.total_advance_given + d.total_advance_given,
        total_expenses_reported: acc.total_expenses_reported + d.total_expenses_reported,
        balance_in_hand: acc.balance_in_hand + Math.max(0, d.balance_in_hand),
        total_need_to_pay: acc.total_need_to_pay + Math.max(0, d.need_to_pay),
      }),
      {
        total_advance_given: 0,
        total_expenses_reported: 0,
        balance_in_hand: 0,
        total_need_to_pay: 0,
      }
    );
  }, [filteredDrivers]);

  // ── Open Give Advance Modal ───────────────────────────────────────────────
  const loadDriverTripsForModal = async (driverId: number) => {
    try {
      const res = await adminTripService.getTrips({ driver_id: String(driverId), limit: 100 });
      const items: Trip[] = res.data?.items || [];
      setDriverTrips(items.filter(t => !['CANCELLED', 'DRAFT'].includes(t.status)));
    } catch {
      setDriverTrips([]);
    }
  };

  const openGiveAdvance = (driver?: DriverBalanceRow) => {
    const dId = driver?.driver_id || drivers[0]?.driver_id || allDrivers[0]?.id || null;
    if (driver) {
      setSelectedDriver(driver);
      setFormDriverId(driver.driver_id);
    } else {
      setSelectedDriver(drivers[0] || null);
      setFormDriverId(dId);
    }
    setGiverType('MANAGER');
    setSelectedManagerId(isManagerLogin && authUser ? authUser.id : (managers.length > 0 ? managers[0].id : null));
    setSelectedOwnerId(owners.length > 0 ? owners[0].id : null);
    setSelectedVehicleId(null);
    setSelectedTripId(null);
    setDriverTrips([]);
    setAmount('');
    setAdvanceDate(getTodayISO());
    setPaymentMode('CASH');
    setNotes('');
    if (dId) loadDriverTripsForModal(dId);
    setIsModalOpen(true);
  };

  const getFullTimestamp = (dateInput?: string) => {
    const now = new Date();
    if (!dateInput?.trim()) return now.toISOString();
    const clean = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (clean === todayLocal) return now.toISOString();
      const [y, m, d] = clean.split('-').map(Number);
      return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
    }
    return clean;
  };

  // ── Give Advance (Manager → Driver or Owner → Driver) ────────────────────
  const handleGiveAdvance = async () => {
    const effectiveDriverId = formDriverId || selectedDriver?.driver_id;
    if (!effectiveDriverId) {
      Alert.alert('Required', 'Please select a driver.');
      return;
    }
    if (giverType === 'MANAGER' && !selectedManagerId) {
      Alert.alert('Required', 'Please select a manager.');
      return;
    }
    if (giverType === 'OWNER' && !selectedOwnerId) {
      Alert.alert('Required', 'Please select an owner.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Required', 'Please enter a valid amount greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (giverType === 'MANAGER') {
        await adminDriverAdvanceService.createDriverAdvance({
          driver_id: effectiveDriverId,
          manager_id: selectedManagerId!,
          vehicle_id: selectedVehicleId || undefined,
          trip_id: selectedTripId || undefined,
          amount: numAmount,
          advance_date: getFullTimestamp(advanceDate),
          payment_mode: paymentMode,
          notes: notes.trim() || undefined,
        });
      } else {
        await adminOwnerAdvanceService.createOwnerAdvance({
          owner_id: selectedOwnerId!,
          recipient_type: 'DRIVER',
          driver_id: effectiveDriverId,
          vehicle_id: selectedVehicleId || null,
          amount: numAmount,
          advance_date: getFullTimestamp(advanceDate),
          payment_mode: paymentMode,
          notes: notes.trim() || undefined,
        });
      }

      setIsModalOpen(false);
      const targetDriverName = allDrivers.find((d) => d.id === effectiveDriverId)?.name || selectedDriver?.driver_name || 'Driver';
      Alert.alert(
        '✅ Advance Added',
        `₹${numAmount.toLocaleString('en-IN')} added to ${targetDriverName}'s account immediately.`
      );
      loadDriverBalances();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not record advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── PDF Actions for Driver Balance Master ──────────────────────────────────
  const preparePdfData = (): DriverBalanceMasterPdfData => {
    let filterSummary = '';
    if (statusFilter !== 'ALL') filterSummary += `Status: ${statusFilter} `;
    if (selectedOwnerFilter) {
      const o = owners.find((x) => x.id === selectedOwnerFilter);
      if (o) filterSummary += `Owner: ${o.name} `;
    }
    if (selectedVehicleFilter) {
      const v = vehicles.find((x) => x.id === selectedVehicleFilter);
      if (v) filterSummary += `Vehicle: ${v.lorry_number} `;
    }

    return {
      drivers: filteredDrivers,
      grandTotals: {
        total_advance_given: filteredTotals.total_advance_given,
        total_expenses_reported: filteredTotals.total_expenses_reported,
        balance_in_hand: filteredTotals.balance_in_hand,
        total_need_to_pay: filteredTotals.total_need_to_pay,
      },
      filterSummary: filterSummary.trim() || undefined,
      generatedAt: new Date().toLocaleString('en-IN'),
    };
  };

  const handlePrintMasterPdf = async () => {
    if (filteredDrivers.length === 0) {
      Alert.alert('No Data', 'No driver records to print.');
      return;
    }
    try {
      setPdfActionLoading('print');
      await printDriverBalanceMasterPdf(preparePdfData());
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Failed to print PDF report.');
    } finally {
      setPdfActionLoading(null);
    }
  };

  const handleShareMasterPdf = async () => {
    if (filteredDrivers.length === 0) {
      Alert.alert('No Data', 'No driver records to share.');
      return;
    }
    try {
      setPdfActionLoading('share');
      await shareDriverBalanceMasterPdf(preparePdfData());
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share PDF report.');
    } finally {
      setPdfActionLoading(null);
    }
  };

  const handleDownloadMasterPdf = async () => {
    if (filteredDrivers.length === 0) {
      Alert.alert('No Data', 'No driver records to download.');
      return;
    }
    try {
      setPdfActionLoading('download');
      const res = await downloadDriverBalanceMasterPdf(preparePdfData());
      if (res.success && res.savedDirectly) {
        Alert.alert('✅ Saved', `Saved directly as ${res.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download PDF report.');
    } finally {
      setPdfActionLoading(null);
    }
  };

  // ── Individual Driver Statement Actions ─────────────────────────────────────
  const fetchDriverStatementData = async (driverId: number): Promise<DriverStatementPdfData> => {
    const res = await adminDriverAdvanceService.getDriverStatement(driverId);
    const data = res.data;
    return {
      driver: data.driver,
      summary: data.summary,
      timeline: data.timeline,
      advances: data.advances,
      trips_and_expenses: data.trips_and_expenses,
      settlement_payments: data.settlement_payments,
    };
  };

  const handlePrintDriverSlip = async (driver: DriverBalanceRow) => {
    try {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: 'print' }));
      const pdfData = await fetchDriverStatementData(driver.driver_id);
      await printDriverStatementPdf(pdfData);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not print driver statement.');
    } finally {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: null }));
    }
  };

  const handleShareDriverSlip = async (driver: DriverBalanceRow) => {
    try {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: 'share' }));
      const pdfData = await fetchDriverStatementData(driver.driver_id);
      await shareDriverStatementPdf(pdfData);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share driver statement.');
    } finally {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: null }));
    }
  };

  const handleDownloadDriverSlip = async (driver: DriverBalanceRow) => {
    try {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: 'download' }));
      const pdfData = await fetchDriverStatementData(driver.driver_id);
      const res = await downloadDriverStatementPdf(pdfData);
      if (res.success && res.savedDirectly) {
        Alert.alert('✅ Saved', `Saved driver statement as ${res.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not download driver statement.');
    } finally {
      setDriverSlipLoading((prev) => ({ ...prev, [driver.driver_id]: null }));
    }
  };

  const activeFiltersCount =
    (selectedDriverFilter ? 1 : 0) +
    (selectedOwnerFilter ? 1 : 0) +
    (selectedVehicleFilter ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0);

  const resetAllFilters = () => {
    setStatusFilter('ALL');
    setSelectedDriverFilter(null);
    setSelectedOwnerFilter(null);
    setSelectedVehicleFilter(null);
    setSearch('');
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Search & Actions Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search driver, mobile, truck..."
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Modal Button */}
          <TouchableOpacity
            style={[styles.actionBtn, activeFiltersCount > 0 && styles.actionBtnActive]}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Filter size={16} color={activeFiltersCount > 0 ? COLORS.white : COLORS.primary} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Refresh Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => loadDriverBalances()}>
            <RefreshCw size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Master PDF Export Bar */}
        <View style={styles.pdfToolbar}>
          <TouchableOpacity
            style={styles.pdfToolBtn}
            onPress={handlePrintMasterPdf}
            disabled={pdfActionLoading !== null}
          >
            {pdfActionLoading === 'print' ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <Printer size={13} color="#2563eb" />
                <Text style={styles.pdfToolBtnText}>Print PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfToolBtn}
            onPress={handleDownloadMasterPdf}
            disabled={pdfActionLoading !== null}
          >
            {pdfActionLoading === 'download' ? (
              <ActivityIndicator size="small" color="#16a34a" />
            ) : (
              <>
                <Download size={13} color="#16a34a" />
                <Text style={[styles.pdfToolBtnText, { color: '#16a34a' }]}>Download</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfToolBtn}
            onPress={handleShareMasterPdf}
            disabled={pdfActionLoading !== null}
          >
            {pdfActionLoading === 'share' ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <>
                <Share2 size={13} color="#7c3aed" />
                <Text style={[styles.pdfToolBtnText, { color: '#7c3aed' }]}>Share</Text>
              </>
            )}
          </TouchableOpacity>


        </View>

        {/* Quick Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'ALL' && styles.filterChipTextActive]}>
              All Drivers ({drivers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'CASH_IN_HAND' && styles.filterChipActiveCash]}
            onPress={() => setStatusFilter('CASH_IN_HAND')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'CASH_IN_HAND' && styles.filterChipTextActiveCash]}>
              Cash in Hand
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'NEED_TO_PAY' && styles.filterChipActiveDue]}
            onPress={() => setStatusFilter('NEED_TO_PAY')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'NEED_TO_PAY' && styles.filterChipTextActiveDue]}>
              Need to Pay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'SETTLED' && styles.filterChipActive]}
            onPress={() => setStatusFilter('SETTLED')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'SETTLED' && styles.filterChipTextActive]}>
              Settled
            </Text>
          </TouchableOpacity>

          {selectedDriverFilter ? (
            <TouchableOpacity
              style={[styles.filterChip, styles.filterChipActive]}
              onPress={() => setSelectedDriverFilter(null)}
            >
              <Text style={[styles.filterChipText, styles.filterChipTextActive]}>
                Driver: {tripDrivers.find((d) => d.id === selectedDriverFilter)?.name || 'Selected'} ✕
              </Text>
            </TouchableOpacity>
          ) : null}

          {activeFiltersCount > 0 && (
            <TouchableOpacity style={styles.clearFilterChip} onPress={resetAllFilters}>
              <X size={12} color="#dc2626" />
              <Text style={styles.clearFilterChipText}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Driver List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Driver Balances...</Text>
        </View>
      ) : filteredDrivers.length === 0 ? (
        <View style={styles.centerBox}>
          <Wallet size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No driver balances matching filter</Text>
          <TouchableOpacity onPress={resetAllFilters} style={{ marginTop: 8 }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.accent]} />}
        >
          {/* Summary totals banner */}
          {filteredDrivers.length > 0 && (
            <View style={styles.summaryBanner}>
              <View style={styles.summaryItem}>
                <TrendingUp size={14} color="#1e40af" />
                <View>
                  <Text style={styles.summaryItemLabel}>Total Advance</Text>
                  <Text style={[styles.summaryItemValue, { color: '#1e40af' }]}>
                    {formatCurrency(filteredTotals.total_advance_given)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <HandCoins size={14} color="#b45309" />
                <View>
                  <Text style={styles.summaryItemLabel}>Expenses</Text>
                  <Text style={[styles.summaryItemValue, { color: '#b45309' }]}>
                    {formatCurrency(filteredTotals.total_expenses_reported)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ArrowDownCircle size={14} color="#059669" />
                <View>
                  <Text style={styles.summaryItemLabel}>In Hand</Text>
                  <Text style={[styles.summaryItemValue, { color: '#059669' }]}>
                    {formatCurrency(filteredTotals.balance_in_hand)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ArrowUpCircle size={14} color="#dc2626" />
                <View>
                  <Text style={styles.summaryItemLabel}>To Pay</Text>
                  <Text style={[styles.summaryItemValue, { color: '#dc2626' }]}>
                    {formatCurrency(filteredTotals.total_need_to_pay)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {filteredDrivers.map((driver) => {
            const balInHand = Math.max(0, driver.balance_in_hand);
            const needToPay = Math.max(0, driver.need_to_pay);
            const slipLoading = driverSlipLoading[driver.driver_id];

            return (
              <View key={driver.driver_id} style={styles.driverCard}>
                {/* Card Top: Driver Info & Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatarRow}>
                      <View style={styles.driverAvatar}>
                        <UserCheck size={18} color="#059669" />
                      </View>
                      <View>
                        <Text style={styles.driverName}>{driver.driver_name}</Text>
                        <Text style={styles.driverMobile}>
                          {driver.driver_mobile || 'No Mobile'}
                          {driver.driver_license ? ` · ${driver.driver_license}` : ''}
                        </Text>
                      </View>
                    </View>

                    {driver.lorry_number ? (
                      <View style={styles.lorryPill}>
                        <Truck size={11} color={COLORS.primary} />
                        <Text style={styles.lorryPillText}>{driver.lorry_number}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Cash in Hand Badge */}
                  {needToPay > 0 ? (
                    <View style={[styles.balanceBadge, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                      <Text style={[styles.balanceLabel, { color: '#dc2626' }]}>Need to Pay</Text>
                      <Text style={[styles.balanceValue, { color: '#dc2626' }]}>
                        {formatCurrency(needToPay)}
                      </Text>
                      <Text style={[styles.balanceStatus, { color: '#b91c1c' }]}>Office owes driver</Text>
                    </View>
                  ) : balInHand > 0 ? (
                    <View style={[styles.balanceBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[styles.balanceLabel, { color: '#059669' }]}>Cash in Hand</Text>
                      <Text style={[styles.balanceValue, { color: '#059669' }]}>
                        {formatCurrency(balInHand)}
                      </Text>
                      <Text style={[styles.balanceStatus, { color: '#047857' }]}>Driver holds cash</Text>
                    </View>
                  ) : (
                    <View style={[styles.balanceBadge, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                      <Text style={styles.balanceLabel}>Balance</Text>
                      <Text style={[styles.balanceValue, { color: '#64748b' }]}>₹0</Text>
                      <Text style={[styles.balanceStatus, { color: '#64748b' }]}>Settled ✓</Text>
                    </View>
                  )}
                </View>



                {/* Owner info */}
                {driver.owner_name ? (
                  <View style={styles.ownerRow}>
                    <Briefcase size={11} color={COLORS.textMuted} />
                    <Text style={styles.ownerText}>Owner: {driver.owner_name}</Text>
                  </View>
                ) : null}

                {/* Financial Stats Row — like admin panel */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Advance</Text>
                    <Text style={[styles.statValue, { color: '#1e40af' }]}>
                      {formatCurrency(driver.total_advance_given)}
                    </Text>
                    <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 1 }}>
                      {driver.advance_count} advance{driver.advance_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Expenses</Text>
                    <Text style={[styles.statValue, { color: '#b45309' }]}>
                      {formatCurrency(driver.total_expenses_reported)}
                    </Text>
                    <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 1 }}>
                      {driver.trip_count} trip{driver.trip_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    {needToPay > 0 ? (
                      <>
                        <Text style={[styles.statLabel, { color: '#dc2626' }]}>Need to Pay</Text>
                        <Text style={[styles.statValue, { color: '#dc2626' }]}>
                          {formatCurrency(needToPay)}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#b91c1c', marginTop: 1 }}>Office owes driver</Text>
                      </>
                    ) : balInHand > 0 ? (
                      <>
                        <Text style={[styles.statLabel, { color: '#059669' }]}>Cash in Hand</Text>
                        <Text style={[styles.statValue, { color: '#059669' }]}>
                          {formatCurrency(balInHand)}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#047857', marginTop: 1 }}>Driver holds cash</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.statLabel}>Net Balance</Text>
                        <Text style={[styles.statValue, { color: '#64748b' }]}>₹0</Text>
                        <Text style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>Settled ✓</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.giveAdvanceBtn}
                    onPress={() => openGiveAdvance(driver)}
                  >
                    <HandCoins size={13} color={COLORS.white} />
                    <Text style={styles.giveAdvanceBtnText}>Give Advance</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.slipBtn}
                    onPress={() => handlePrintDriverSlip(driver)}
                    disabled={slipLoading !== undefined && slipLoading !== null}
                  >
                    {slipLoading === 'print' ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <>
                        <Printer size={13} color="#2563eb" />
                        <Text style={styles.slipBtnText}>Print</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.slipBtn}
                    onPress={() => handleDownloadDriverSlip(driver)}
                    disabled={slipLoading !== undefined && slipLoading !== null}
                  >
                    {slipLoading === 'download' ? (
                      <ActivityIndicator size="small" color="#16a34a" />
                    ) : (
                      <>
                        <Download size={13} color="#16a34a" />
                        <Text style={[styles.slipBtnText, { color: '#16a34a' }]}>PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.slipBtn}
                    onPress={() => handleShareDriverSlip(driver)}
                    disabled={slipLoading !== undefined && slipLoading !== null}
                  >
                    {slipLoading === 'share' ? (
                      <ActivityIndicator size="small" color="#7c3aed" />
                    ) : (
                      <>
                        <Share2 size={13} color="#7c3aed" />
                        <Text style={[styles.slipBtnText, { color: '#7c3aed' }]}>Share</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Filter Modal (Owner & Vehicle Selectors) ──────────────────────── */}
      <Modal
        visible={isFilterModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Driver Balances</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Driver Selector */}
            <Text style={styles.label}>Select Driver</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.chip, selectedDriverFilter === null && styles.chipActive]}
                onPress={() => setSelectedDriverFilter(null)}
              >
                <Text style={[styles.chipText, selectedDriverFilter === null && styles.chipTextActive]}>
                  All Drivers
                </Text>
              </TouchableOpacity>
              {tripDrivers.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, selectedDriverFilter === d.id && styles.chipActive]}
                  onPress={() => setSelectedDriverFilter(d.id)}
                >
                  <Text style={[styles.chipText, selectedDriverFilter === d.id && styles.chipTextActive]}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Owner Selector */}
            <Text style={styles.label}>Select Owner</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.chip, selectedOwnerFilter === null && styles.chipActive]}
                onPress={() => setSelectedOwnerFilter(null)}
              >
                <Text style={[styles.chipText, selectedOwnerFilter === null && styles.chipTextActive]}>
                  All Owners
                </Text>
              </TouchableOpacity>
              {owners.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.chip, selectedOwnerFilter === o.id && styles.chipActive]}
                  onPress={() => setSelectedOwnerFilter(o.id)}
                >
                  <Text style={[styles.chipText, selectedOwnerFilter === o.id && styles.chipTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Vehicle Selector */}
            <Text style={styles.label}>Select Vehicle / Lorry</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.chip, selectedVehicleFilter === null && styles.chipActive]}
                onPress={() => setSelectedVehicleFilter(null)}
              >
                <Text style={[styles.chipText, selectedVehicleFilter === null && styles.chipTextActive]}>
                  All Vehicles
                </Text>
              </TouchableOpacity>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, selectedVehicleFilter === v.id && styles.chipActive]}
                  onPress={() => setSelectedVehicleFilter(v.id)}
                >
                  <Text style={[styles.chipText, selectedVehicleFilter === v.id && styles.chipTextActive]}>
                    {v.lorry_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filter Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setSelectedDriverFilter(null);
                  setSelectedOwnerFilter(null);
                  setSelectedVehicleFilter(null);
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => setIsFilterModalOpen(false)}
              >
                <Text style={styles.saveBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Give Advance Modal ───────────────────────────────────────────── */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Give Advance to Driver</Text>
                <Text style={styles.modalSubtitle}>
                  {allDrivers.find((d) => d.id === formDriverId)?.name || selectedDriver?.driver_name || 'Select Driver'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Driver Selector if not preselected */}
            <Text style={styles.label}>Recipient Driver *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {allDrivers.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, formDriverId === d.id && styles.chipActive]}
                  onPress={() => {
                    setFormDriverId(d.id);
                    setSelectedTripId(null);
                    loadDriverTripsForModal(d.id);
                  }}
                >
                  <Text style={[styles.chipText, formDriverId === d.id && styles.chipTextActive]}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Link to Trip (Manager advances only) */}
            {giverType === 'MANAGER' && (
              <>
                <Text style={styles.label}>DISPATCH OPTION / LINK TO TRIP</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.chip, selectedTripId === null && styles.chipActive]}
                    onPress={() => setSelectedTripId(null)}
                  >
                    <Text style={[styles.chipText, selectedTripId === null && styles.chipTextActive]}>
                      Without Trip · Direct Advance
                    </Text>
                  </TouchableOpacity>
                  {driverTrips.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, selectedTripId === t.id && styles.chipActive]}
                      onPress={() => setSelectedTripId(t.id)}
                    >
                      <Text style={[styles.chipText, selectedTripId === t.id && styles.chipTextActive]}>
                        T-{t.id} · {(t as any).from_location ?? ''}→{(t as any).to_location ?? ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {formDriverId && driverTrips.length === 0 && (
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, alignSelf: 'center', paddingHorizontal: 8 }}>No active trips</Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#eff6ff',
                    borderWidth: 1,
                    borderColor: '#bfdbfe',
                    borderRadius: 8,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    setIsModalOpen(false);
                    navigation.navigate('NewTrip', {
                      preselectedDriverId: formDriverId,
                      preselectedVehicleId: selectedVehicleId || undefined,
                      advancePaid: parseFloat(amount) || 0,
                    });
                  }}
                >
                  <Zap size={14} color="#1d4ed8" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1d4ed8' }}>
                    Start New Trip Now with this Driver & Advance ➔
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Giver Type Toggle */}
            {!isManagerLogin && (
            <>
            <Text style={styles.label}>Advance Given By *</Text>
            <View style={styles.giverToggleRow}>
              <TouchableOpacity
                style={[styles.giverToggleBtn, giverType === 'MANAGER' && styles.giverToggleBtnActive]}
                onPress={() => setGiverType('MANAGER')}
              >
                <UserCheck size={14} color={giverType === 'MANAGER' ? COLORS.white : COLORS.textMuted} />
                <Text style={[styles.giverToggleText, giverType === 'MANAGER' && styles.giverToggleTextActive]}>
                  Manager
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.giverToggleBtn, giverType === 'OWNER' && styles.giverToggleBtnActiveOwner]}
                onPress={() => setGiverType('OWNER')}
              >
                <Briefcase size={14} color={giverType === 'OWNER' ? COLORS.white : COLORS.textMuted} />
                <Text style={[styles.giverToggleText, giverType === 'OWNER' && styles.giverToggleTextActive]}>
                  Owner / Direct
                </Text>
              </TouchableOpacity>
            </View>
            </>
            )}

            {/* Giver Selector */}
            {giverType === 'MANAGER' ? (
              isManagerLogin ? (
                <View style={{ marginBottom: 12, padding: 10, backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>Given by</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e40af', marginTop: 2 }}>{authUser?.name || 'Manager'}</Text>
                </View>
              ) : (
              <>
                <Text style={styles.label}>Select Manager *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {managers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.chip, selectedManagerId === m.id && styles.chipActive]}
                      onPress={() => setSelectedManagerId(m.id)}
                    >
                      <Text style={[styles.chipText, selectedManagerId === m.id && styles.chipTextActive]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
              )
            ) : (
              <>
                <Text style={styles.label}>Select Owner *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {owners.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.chip, selectedOwnerId === o.id && styles.chipActive]}
                      onPress={() => setSelectedOwnerId(o.id)}
                    >
                      <Text style={[styles.chipText, selectedOwnerId === o.id && styles.chipTextActive]}>
                        {o.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Optional Vehicle */}
            <Text style={styles.label}>Vehicle / Truck (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.chip, selectedVehicleId === null && styles.chipActive]}
                onPress={() => setSelectedVehicleId(null)}
              >
                <Text style={[styles.chipText, selectedVehicleId === null && styles.chipTextActive]}>
                  None / General
                </Text>
              </TouchableOpacity>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, selectedVehicleId === v.id && styles.chipActive]}
                  onPress={() => setSelectedVehicleId(v.id)}
                >
                  <Text style={[styles.chipText, selectedVehicleId === v.id && styles.chipTextActive]}>
                    {v.lorry_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount */}
            <Text style={styles.label}>Advance Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 5000"
              keyboardType="numeric"
            />

            {/* Date */}
            <Text style={styles.label}>Advance Date *</Text>
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
            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.modePickerRow}>
              {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, paymentMode === m && styles.modeBtnActive]}
                  onPress={() => setPaymentMode(m)}
                >
                  <Text style={[styles.modeBtnText, paymentMode === m && styles.modeBtnTextActive]}>
                    {m === 'BANK_TRANSFER' ? 'BANK' : m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Enter notes or remarks..."
              multiline
            />

            {/* Notice */}
            <View style={styles.noticeBox}>
              <AlertCircle size={14} color="#0284c7" />
              <Text style={styles.noticeText}>
                This advance is added to driver account <Text style={{ fontWeight: '800' }}>immediately</Text> and adjusts their live balance in hand, whether trip is ongoing or not.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleGiveAdvance}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Disburse Advance</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Date Picker */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={advanceDate}
        title="Select Advance Date"
        onConfirm={(iso) => { setAdvanceDate(iso); setDatePickerTarget(null); }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  headerSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 8,
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
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 0 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    position: 'relative',
  },
  actionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#dc2626',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  pdfToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pdfToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pdfToolBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  chipsScroll: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  filterChipActiveCash: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  filterChipActiveDue: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  filterChipTextActive: { color: '#2563eb', fontWeight: '700' },
  filterChipTextActiveCash: { color: '#059669', fontWeight: '700' },
  filterChipTextActiveDue: { color: '#dc2626', fontWeight: '700' },

  clearFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2',
    marginRight: 6,
  },
  clearFilterChipText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },

  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  summaryItemLabel: { fontSize: 9.5, color: COLORS.textMuted, fontWeight: '600' },
  summaryItemValue: { fontSize: 12, fontWeight: '800' },
  summaryDivider: { width: 1, height: 26, backgroundColor: COLORS.border, marginHorizontal: 6 },

  listContainer: { padding: SPACING.md, gap: 8, paddingBottom: 40 },

  driverCard: {
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
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  driverInfo: { flex: 1, marginRight: 8 },
  driverAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },
  driverName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  driverMobile: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  lorryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  lorryPillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  balanceLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  balanceValue: { fontSize: 15, fontWeight: '900', marginTop: 1 },
  balanceStatus: { fontSize: 9.5, fontWeight: '700', marginTop: 1 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9.5, color: COLORS.textMuted, fontWeight: '600' },
  statValue: { fontSize: 12, fontWeight: '800', marginTop: 1 },
  statDivider: { width: 1, height: 20, backgroundColor: COLORS.border },

  activeTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    marginBottom: 6,
  },
  tripStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  activeTripText: { fontSize: 11, color: '#1e40af', fontWeight: '600', flex: 1 },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  ownerText: { fontSize: 11, color: COLORS.textMuted },

  cardActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  giveAdvanceBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  giveAdvanceBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },

  slipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  slipBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 11 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  centerText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginTop: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  filterModalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalSubtitle: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#2563eb', fontWeight: '700' },

  giverToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  giverToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc',
  },
  giverToggleBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  giverToggleBtnActiveOwner: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  giverToggleText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  giverToggleTextActive: { color: COLORS.white },

  modePickerRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  modeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  modeBtnText: { fontSize: 10.5, fontWeight: '700', color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.white },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 16,
  },
  noticeText: { fontSize: 11, color: '#0369a1', flex: 1, lineHeight: 16 },

  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
});

export default AdminDriverBalanceMasterScreen;
