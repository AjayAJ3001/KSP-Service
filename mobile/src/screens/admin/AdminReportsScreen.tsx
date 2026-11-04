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
  FileText,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Truck,
  Building2,
  Share2,
  Check,
  ChevronDown,
  X,
  Printer,
  Sparkles,
  RotateCcw,
} from 'lucide-react-native';
import {
  adminReportService,
  adminPartyService,
  adminVehicleService,
  adminUnitService,
  adminOwnerService,
} from '../../services/adminService';
import { Party, Vehicle, Unit, Owner } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { exportCSV } from '../../utils/exportUtils';
import {
  downloadReportsPdf,
  printReportsPdf,
  shareReportsPdf,
  downloadTripPdf,
  downloadPaymentPdf,
  downloadSettlementPdf,
  ReportsPdfData,
} from '../../utils/pdfGenerator';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';

type Tab = 'trips' | 'payments' | 'settlements';

export const AdminReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const isOwnerUser = user?.role === 'OWNER';
  const ownerScopeIds = (user?.ownerIds?.length ? user.ownerIds : (user?.owners || []).map((o) => o.id)).map(Number);
  const [activeTab, setActiveTab] = useState<Tab>('trips');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [calendarPickerTarget, setCalendarPickerTarget] = useState<'from' | 'to' | null>(null);
  const [quickDateFilter, setQuickDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [selectedPartyId, setSelectedPartyId] = useState<number | undefined>(undefined);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>(undefined);

  // Dropdown options
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);

  // Filter vehicles dynamically based on selected Owner
  const availableVehicles = useMemo(() => {
    if (!selectedOwnerId) return vehicles;
    return vehicles.filter((v) => v.owner_id === selectedOwnerId);
  }, [vehicles, selectedOwnerId]);

  // Picker Modal
  const [pickerModalType, setPickerModalType] = useState<'party' | 'owner' | 'vehicle' | 'unit' | 'status' | null>(null);

  // Data
  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [settlementData, setSettlementData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
  const hasActiveFilters = Boolean(
    selectedOwnerId ||
    selectedVehicleId ||
    selectedPartyId ||
    selectedUnitId ||
    selectedStatus ||
    fromDate ||
    toDate ||
    quickDateFilter !== 'all'
  );

  const handleClearAllFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedPartyId(undefined);
    setSelectedVehicleId(undefined);
    setSelectedUnitId(undefined);
    setSelectedStatus('');
    setSelectedOwnerId(isOwnerUser && ownerScopeIds.length === 1 ? ownerScopeIds[0] : undefined);
    setQuickDateFilter('all');
  };


  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [pRes, vRes, uRes, oRes] = await Promise.all([
        adminPartyService.getParties({ limit: 200 }),
        adminVehicleService.getVehicles({ limit: 500 }),
        adminUnitService.getUnits('ACTIVE'),
        adminOwnerService.getOwners({ limit: 200 }),
      ]);
      setParties(pRes.data.items || []);
      setUnits(uRes.data || []);
      const allVehicles = vRes.data.items || [];
      const allOwners = oRes.data.items || [];
      if (isOwnerUser && ownerScopeIds.length) {
        setOwners(allOwners.filter((ow) => ownerScopeIds.includes(Number(ow.id))));
        setVehicles(allVehicles.filter((veh) => ownerScopeIds.includes(Number(veh.owner_id))));
        if (ownerScopeIds.length === 1) setSelectedOwnerId(ownerScopeIds[0]);
      } else if (isOwnerUser && (user?.vehicleIds || []).length) {
        setOwners(allOwners);
        setVehicles(allVehicles.filter((veh) => (user?.vehicleIds || []).includes(Number(veh.id))));
      } else {
        setVehicles(allVehicles);
        setOwners(allOwners);
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const setQuickRange = (type: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    setQuickDateFilter(type);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (quickDateFilter === type && type !== 'all') {
      setQuickDateFilter('all');
      setFromDate('');
      setToDate('');
      return;
    }

    const today = new Date();
    if (type === 'all') {
      setFromDate('');
      setToDate('');
    } else if (type === 'today') {
      const d = fmt(today);
      setFromDate(d);
      setToDate(d);
    } else if (type === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const d = fmt(y);
      setFromDate(d);
      setToDate(d);
    } else if (type === 'week') {
      const day = today.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const start = new Date(today);
      start.setDate(today.getDate() + diffToMonday);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setFromDate(fmt(start));
      setToDate(fmt(end));
    } else if (type === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(fmt(start));
      setToDate(fmt(end));
    }
  };

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: selectedPartyId || undefined,
        vehicle_id: selectedVehicleId || undefined,
        unit_id: selectedUnitId || undefined,
        status: selectedStatus || undefined,
        owner_id: selectedOwnerId || undefined,
      };

      if (activeTab === 'trips') {
        const res = await adminReportService.getTripReport(params);
        setTripData(res.data);
      } else if (activeTab === 'payments') {
        const res = await adminReportService.getPaymentReport(params);
        setPaymentData(res.data || []);
      } else {
        const res = await adminReportService.getSettlementReport(params);
        setSettlementData(res.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load report', err);
      Alert.alert('Report Error', err.message || 'Failed to fetch report.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, fromDate, toDate, selectedPartyId, selectedVehicleId, selectedUnitId, selectedStatus, selectedOwnerId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const renderAdvancePaid = (s: any) => {
    const manager = Math.round(parseFloat(String(s.manager_advance ?? s.initial_trip_advance ?? 0)) || 0);
    const leftoverUsed = Math.round(parseFloat(String(s.owner_leftover_used ?? 0)) || 0);
    const ownerAdvance = Math.round(Number(s.owner_given || 0));
    const ownerAdvanceBal = Math.round(parseFloat(String(s.owner_balance ?? 0)) || 0);
    const isOwnerLeftover = leftoverUsed > 0 && ownerAdvance <= 0 && manager <= 0;
    const rows: { label: string; value: number; color: string; bg: string }[] = [
      { label: 'Advance', value: manager, color: '#1d4ed8', bg: '#eff6ff' },
    ];
    const ownName = String(s.advance_owner_name || '').trim();
    const ownAdvLabel = ownName ? `Owner Advance (${ownName})` : 'Owner Advance';
    const ownBalLabel = ownName ? `Advance Balance in Hand (${ownName})` : 'Advance Balance in Hand';
    const lessAmt = Math.round(Number(s.owner_applied || 0));
    const priorDeficit = Math.round(Number(s.prior_deficit_deduction || 0));
    if (!isOwnerLeftover && ownerAdvance > 0) {
      rows.push({ label: ownAdvLabel, value: ownerAdvance, color: '#6d28d9', bg: '#f5f3ff' });
    }
    if (priorDeficit > 0) {
      rows.push({ label: 'Less (prior dues)', value: priorDeficit, color: '#c2410c', bg: '#fff7ed' });
    }
    if (!isOwnerLeftover && lessAmt > 0) {
      rows.push({ label: 'Less', value: lessAmt, color: '#c2410c', bg: '#fff7ed' });
    }
    if (ownerAdvanceBal > 0) {
      rows.push({ label: ownBalLabel, value: ownerAdvanceBal, color: '#047857', bg: '#ecfdf5' });
    }
    if (isOwnerLeftover) {
      rows.push({ label: ownBalLabel, value: leftoverUsed, color: '#047857', bg: '#ecfdf5' });
    }
    return (
      <View style={styles.advanceStack}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.advanceRow, { backgroundColor: row.bg }]}>
            <Text style={[styles.advanceLabel, { color: row.color }]}>{row.label}</Text>
            <Text style={[styles.advanceValue, { color: row.color }]}>{formatCurrency(row.value)}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Full Report Download
  const handleExportFullReport = async () => {
    try {
      setIsExporting(true);
      if (activeTab === 'trips') {
        const headers = ['ID', 'Date', 'Lorry No', 'Owner', 'Party', 'Driver', 'Route', 'Unit', 'Weight', 'Rate', 'Total Freight', 'Driver Advance', 'Driver Expenses', 'Expense Settled', 'Expense To Pay', 'Driver Expense Status', 'Need to Pay', 'In Hand', 'Party Received', 'Party Balance', 'Status'];
        const rows = (tripData.trips || []).map((t) => [
          t.id,
          formatDateDMY(t.trip_date),
          t.lorry_number,
          t.owner_name || '—',
          t.party_name,
          t.driver_name || '—',
          `${t.from_location} -> ${t.to_location}`,
          t.unit_name,
          t.goods_weight,
          t.freight_rate,
          t.total_freight,
          t.manager_advance ?? t.advance_paid,
          t.total_expenses,
          driverExpenseBalance(t).settled,
          driverExpenseBalance(t).toPay,
          driverExpenseStatus(t),
          t.need_to_pay,
          t.in_hand,
          t.total_received,
          t.balance_due,
          t.status,
        ]);
        await exportCSV(`KSP_Trips_Report_${Date.now()}`, headers, rows);
      } else if (activeTab === 'payments') {
        const headers = ['Payment ID', 'Trip ID', 'Date', 'Party', 'Lorry No', 'Owner', 'Amount Received', 'Trip Total', 'Balance Due', 'Status'];
        const rows = paymentData.map((p) => [
          p.id,
          p.trip_id,
          formatDateDMY(p.payment_date),
          p.party_name,
          p.lorry_number,
          p.owner_name || '—',
          p.received_amount,
          p.total_freight,
          p.balance_due,
          p.payment_status,
        ]);
        await exportCSV(`KSP_Payments_Report_${Date.now()}`, headers, rows);
      } else {
        const headers = ['Settlement ID', 'Trip ID', 'Date', 'Lorry No', 'Owner', 'Driver', 'Party', 'Total Freight', 'Expenses', 'Advance', 'Need to Pay', 'Balance in Hand', 'Status'];
        const rows = settlementData.map((s) => [
          s.id,
          s.trip_id,
          formatDateDMY(s.created_at || s.trip_date),
          s.lorry_number,
          s.owner_name || '—',
          s.driver_name,
          s.party_name,
          s.total_freight,
          s.total_expenses,
          s.advance_paid,
          Math.max(0, Number(s.owner_balance || 0) > 0 ? 0 : Number(s.balance_to_driver || 0)),
          Math.max(0, Number(s.owner_balance || 0)),
          s.settlement_status,
        ]);
        await exportCSV(`KSP_Settlements_Report_${Date.now()}`, headers, rows);
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Single Row Download
  const handleExportSingleTrip = async (trip: any) => {
    const headers = ['Trip ID', 'Date', 'Lorry Number', 'Truck Owner', 'Party', 'Driver', 'Route', 'Unit', 'Weight', 'Rate', 'Total Freight', 'Driver Advance', 'Driver Expenses', 'Expense Settled', 'Expense To Pay', 'Driver Expense Status', 'Need to Pay', 'In Hand', 'Party Received', 'Party Balance', 'Status'];
    const rows = [[
      trip.id,
      formatDateDMY(trip.trip_date),
      trip.lorry_number,
      trip.owner_name || '-',
      trip.party_name,
      trip.driver_name,
      `${trip.from_location} -> ${trip.to_location}`,
      trip.unit_name,
      trip.goods_weight,
      trip.freight_rate,
      trip.total_freight,
      trip.manager_advance ?? trip.advance_paid,
      trip.total_expenses,
      driverExpenseBalance(trip).settled,
      driverExpenseBalance(trip).toPay,
      driverExpenseStatus(trip),
      trip.need_to_pay,
      trip.in_hand,
      trip.total_received,
      trip.balance_due,
      trip.status,
    ]];
    await exportCSV(`Trip_${trip.lorry_number}_${trip.id}`, headers, rows);
  };

  const handleExportSinglePayment = async (p: any) => {
    const headers = ['Payment ID', 'Trip ID', 'Date', 'Party', 'Lorry Number', 'Truck Owner', 'Received Amount', 'Balance Due', 'Status'];
    const rows = [[
      p.id,
      p.trip_id,
      formatDateDMY(p.payment_date),
      p.party_name,
      p.lorry_number,
      p.owner_name || '-',
      p.received_amount,
      p.balance_due,
      p.payment_status,
    ]];
    await exportCSV(`Payment_${p.trip_id}_${p.id}`, headers, rows);
  };

  const handleExportSingleSettlement = async (s: any) => {
    const headers = ['Settlement ID', 'Trip ID', 'Date', 'Lorry', 'Truck Owner', 'Driver', 'Party', 'Total Freight', 'Expenses', 'Advance', 'Need to Pay', 'Balance in Hand', 'Status'];
    const rows = [[
      s.id,
      s.trip_id,
      formatDateDMY(s.created_at || s.trip_date),
      s.lorry_number,
      s.owner_name || '-',
      s.driver_name,
      s.party_name,
      s.total_freight,
      s.total_expenses,
      s.advance_paid,
      Math.max(0, Number(s.owner_balance || 0) > 0 ? 0 : Number(s.balance_to_driver || 0)),
      Math.max(0, Number(s.owner_balance || 0)),
      s.settlement_status,
    ]];
    await exportCSV(`Settlement_Trip_${s.trip_id}`, headers, rows);
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const selectedOwner = owners.find((o) => o.id === selectedOwnerId);

  const getActiveFilterSummary = () => {
    const parts: string[] = [];
    if (selectedOwner) parts.push(`Owner: ${selectedOwner.name}`);
    if (selectedVehicle) parts.push(`Truck: ${selectedVehicle.lorry_number}`);
    if (selectedParty) parts.push(`Party: ${selectedParty.name}`);
    if (selectedUnit) parts.push(`Unit: ${selectedUnit.name}`);
    if (selectedStatus) parts.push(`Status: ${selectedStatus}`);
    if (fromDate || toDate) parts.push(`Dates: ${toDisplayDate(fromDate) || 'Start'} to ${toDisplayDate(toDate) || 'Present'}`);
    return parts.length > 0 ? parts.join(' | ') : 'All Active Records';
  };

  // Full Report PDF Export & Print
  const handleExportFullPdf = async () => {
    try {
      setPdfGenerating('full_pdf');
      const dateRange = fromDate || toDate ? `${toDisplayDate(fromDate) || 'Start'} to ${toDisplayDate(toDate) || 'Present'}` : 'All Dates';
      const filtersText = getActiveFilterSummary();

      let pdfData: ReportsPdfData;

      if (activeTab === 'trips') {
        pdfData = {
          type: 'TRIPS',
          title: 'Trip Dispatch Audit Report',
          dateRange,
          filtersText,
          items: tripData.trips || [],
          summary: tripData.summary,
        };
      } else if (activeTab === 'payments') {
        pdfData = {
          type: 'PAYMENTS',
          title: 'Party Freight Payments Audit Report',
          dateRange,
          filtersText,
          items: paymentData || [],
        };
      } else {
        pdfData = {
          type: 'SETTLEMENTS',
          title: 'Driver Settlements Audit Report',
          dateRange,
          filtersText,
          items: settlementData || [],
        };
      }

      const res = await downloadReportsPdf(pdfData);
      if (res.savedDirectly) {
        Alert.alert('Report PDF Saved', `PDF report successfully saved to storage:\n${res.filename}`);
      }
    } catch (err: any) {
      console.error('Export full PDF failed', err);
      Alert.alert('PDF Export Error', err.message || 'Could not export PDF report.');
    } finally {
      setPdfGenerating(null);
    }
  };

  const handlePrintFullPdf = async () => {
    try {
      setPdfGenerating('full_print');
      const dateRange = fromDate || toDate ? `${toDisplayDate(fromDate) || 'Start'} to ${toDisplayDate(toDate) || 'Present'}` : 'All Dates';
      const filtersText = getActiveFilterSummary();

      let pdfData: ReportsPdfData;

      if (activeTab === 'trips') {
        pdfData = {
          type: 'TRIPS',
          title: 'Trip Dispatch Audit Report',
          dateRange,
          filtersText,
          items: tripData.trips || [],
          summary: tripData.summary,
        };
      } else if (activeTab === 'payments') {
        pdfData = {
          type: 'PAYMENTS',
          title: 'Party Freight Payments Audit Report',
          dateRange,
          filtersText,
          items: paymentData || [],
        };
      } else {
        pdfData = {
          type: 'SETTLEMENTS',
          title: 'Driver Settlements Audit Report',
          dateRange,
          filtersText,
          items: settlementData || [],
        };
      }

      await printReportsPdf(pdfData);
    } catch (err: any) {
      console.error('Print full PDF failed', err);
      Alert.alert('Print Error', err.message || 'Could not print PDF report.');
    } finally {
      setPdfGenerating(null);
    }
  };

  // Single-Item PDF Handlers
  const handleDownloadSingleTripPdf = async (trip: any) => {
    try {
      setPdfGenerating(`trip_${trip.id}`);
      const res = await downloadTripPdf(trip);
      if (res.savedDirectly) {
        Alert.alert('Trip Challan Saved', `Challan PDF saved:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not generate Trip Challan PDF.');
    } finally {
      setPdfGenerating(null);
    }
  };

  const handleDownloadSinglePaymentPdf = async (payment: any) => {
    try {
      setPdfGenerating(`payment_${payment.id}`);
      const res = await downloadPaymentPdf(payment);
      if (res.savedDirectly) {
        Alert.alert('Voucher Saved', `Payment Voucher PDF saved:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not generate Payment Voucher PDF.');
    } finally {
      setPdfGenerating(null);
    }
  };

  const handleDownloadSingleSettlementPdf = async (settlement: any) => {
    try {
      setPdfGenerating(`settlement_${settlement.id}`);
      const res = await downloadSettlementPdf(
        {
          id: settlement.trip_id,
          trip_date: settlement.trip_date || settlement.created_at,
          lorry_number: settlement.lorry_number,
          driver_name: settlement.driver_name,
          party_name: settlement.party_name,
          status: settlement.settlement_status || 'SETTLED',
        } as any,
        settlement
      );
      if (res.savedDirectly) {
        Alert.alert('Settlement Slip Saved', `Settlement Slip PDF saved:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not generate Settlement Slip PDF.');
    } finally {
      setPdfGenerating(null);
    }
  };


  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'trips' && styles.tabBtnActive]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, activeTab === 'trips' && styles.tabTextActive]}>Trips Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'payments' && styles.tabBtnActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>Party Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'settlements' && styles.tabBtnActive]}
          onPress={() => setActiveTab('settlements')}
        >
          <Text style={[styles.tabText, activeTab === 'settlements' && styles.tabTextActive]}>Driver Settlements</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick Date Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickDateRow}>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'all' && styles.quickPillActive]}
            onPress={() => setQuickRange('all')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'all' && styles.quickPillTextActive]}>All Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'today' && styles.quickPillActive]}
            onPress={() => setQuickRange('today')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'today' && styles.quickPillTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'yesterday' && styles.quickPillActive]}
            onPress={() => setQuickRange('yesterday')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'yesterday' && styles.quickPillTextActive]}>Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'week' && styles.quickPillActive]}
            onPress={() => setQuickRange('week')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'week' && styles.quickPillTextActive]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'month' && styles.quickPillActive]}
            onPress={() => setQuickRange('month')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'month' && styles.quickPillTextActive]}>This Month</Text>
          </TouchableOpacity>
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearQuickPill}
              onPress={handleClearAllFilters}
              activeOpacity={0.7}
            >
              <RotateCcw size={11} color="#dc2626" />
              <Text style={styles.clearQuickPillText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Filter Selectors Bar */}
        <View style={styles.filtersCard}>
          <View style={styles.filterCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Filter size={15} color={COLORS.primary} />
              <Text style={styles.filterCardTitle}>Filter Controls</Text>
            </View>
            {hasActiveFilters ? (
              <TouchableOpacity
                onPress={handleClearAllFilters}
                style={styles.quickResetLink}
              >
                <RotateCcw size={11} color="#dc2626" />
                <Text style={styles.quickResetText}>Clear All</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Row 1: Party Wise & Truck Owner Wise (matched to Admin Panel) */}
          <View style={styles.filterRow}>
            {/* Party Selector */}
            <TouchableOpacity
              style={[styles.dropdownBtn, selectedPartyId ? styles.dropdownBtnActive : null]}
              onPress={() => setPickerModalType('party')}
            >
              <Building2 size={15} color={selectedPartyId ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.dropdownText, selectedPartyId ? styles.dropdownTextActive : null]} numberOfLines={1}>
                {selectedParty ? selectedParty.name : 'All Parties'}
              </Text>
              <ChevronDown size={14} color={selectedPartyId ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>

            {!isOwnerUser && (
            <TouchableOpacity
              style={[styles.dropdownBtn, selectedOwnerId ? { borderColor: '#7c3aed', borderWidth: 1.5, backgroundColor: '#faf5ff' } : null]}
              onPress={() => setPickerModalType('owner')}
            >
              <Text style={{ fontSize: 13 }}>🏢</Text>
              <Text style={[styles.dropdownText, selectedOwnerId ? { color: '#7c3aed', fontWeight: '800' } : null]} numberOfLines={1}>
                {selectedOwner ? selectedOwner.name : 'All Owners'}
              </Text>
              <ChevronDown size={14} color={selectedOwnerId ? '#7c3aed' : COLORS.textMuted} />
            </TouchableOpacity>
            )}
          </View>

          {/* Row 2: Truck Selector (filtered by Owner) & Unit Selector */}
          <View style={styles.filterRow}>
            {/* Truck Selector */}
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                selectedVehicleId ? styles.dropdownBtnActive : null,
                selectedOwnerId ? { borderColor: '#c4b5fd' } : null,
              ]}
              onPress={() => setPickerModalType('vehicle')}
            >
              <Truck size={15} color={selectedVehicleId ? COLORS.primary : selectedOwnerId ? '#7c3aed' : COLORS.textMuted} />
              <Text style={[styles.dropdownText, selectedVehicleId ? styles.dropdownTextActive : null]} numberOfLines={1}>
                {selectedVehicle
                  ? selectedVehicle.lorry_number
                  : selectedOwnerId
                  ? `All Lorries (${availableVehicles.length})`
                  : isOwnerUser
                  ? 'My Trucks'
                  : 'All Trucks / Lorries'}
              </Text>
              <ChevronDown size={14} color={selectedVehicleId ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>

            {/* Unit Selector */}
            <TouchableOpacity
              style={[styles.dropdownBtn, selectedUnitId ? styles.dropdownBtnActive : null]}
              onPress={() => setPickerModalType('unit')}
            >
              <Text style={[styles.dropdownText, selectedUnitId ? styles.dropdownTextActive : null]} numberOfLines={1}>
                {selectedUnit ? selectedUnit.name : 'All Units'}
              </Text>
              <ChevronDown size={14} color={selectedUnitId ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Row 3: Status Selector (for Trips) */}
          {activeTab === 'trips' && (
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.dropdownBtn, selectedStatus ? styles.dropdownBtnActive : null]}
                onPress={() => setPickerModalType('status')}
              >
                <Text style={[styles.dropdownText, selectedStatus ? styles.dropdownTextActive : null]} numberOfLines={1}>
                  {selectedStatus ? `Status: ${selectedStatus}` : 'All Statuses'}
                </Text>
                <ChevronDown size={14} color={selectedStatus ? COLORS.primary : COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Active Owner Scope Notice */}
          {selectedOwner ? (
            <View style={styles.ownerScopeNotice}>
              <Text style={styles.ownerScopeText}>
                Scope: Showing {availableVehicles.length} vehicles owned by <Text style={{ fontWeight: '800' }}>{selectedOwner.name}</Text>
              </Text>
              <TouchableOpacity onPress={() => setSelectedOwnerId(undefined)}>
                <X size={13} color="#7c3aed" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Custom Date inputs */}
          <View style={styles.customDateRow}>
            <View style={styles.dateInputBox}>
              <Text style={styles.dateLabel}>From (DD-MM-YYYY):</Text>
              <TouchableOpacity
                style={[styles.datePickerCardBtn, fromDate ? styles.datePickerCardBtnActive : null]}
                onPress={() => setCalendarPickerTarget('from')}
                activeOpacity={0.7}
              >
                <Calendar size={13} color={fromDate ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.datePickerCardText, fromDate ? styles.datePickerCardTextActive : null]}>
                  {fromDate ? toDisplayDate(fromDate) : 'Select Date'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity
                    onPress={() => {
                      setFromDate('');
                      setQuickDateFilter('all');
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={12} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputBox}>
              <Text style={styles.dateLabel}>To (DD-MM-YYYY):</Text>
              <TouchableOpacity
                style={[styles.datePickerCardBtn, toDate ? styles.datePickerCardBtnActive : null]}
                onPress={() => setCalendarPickerTarget('to')}
                activeOpacity={0.7}
              >
                <Calendar size={13} color={toDate ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.datePickerCardText, toDate ? styles.datePickerCardTextActive : null]}>
                  {toDate ? toDisplayDate(toDate) : 'Select Date'}
                </Text>
                {toDate ? (
                  <TouchableOpacity
                    onPress={() => {
                      setToDate('');
                      setQuickDateFilter('all');
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={12} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          {/* Action buttons (Clear & Apply) */}
          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearAllFilters}
            >
              <Text style={styles.clearBtnText}>Reset Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={loadReport}>
              <RefreshCw size={14} color={COLORS.white} />
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Banner & Full Export Button Group (PDF, Print, CSV) */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryStats}>
            {activeTab === 'trips' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Trips</Text>
                  <Text style={styles.summaryValue}>{tripData.summary?.total_trips || tripData.trips?.length || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Freight</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(tripData.summary?.total_freight || 0)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Driver Exp</Text>
                  <Text style={[styles.summaryValue, { color: '#7c3aed' }]}>
                    {formatCurrency(tripData.summary?.total_expenses || 0)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Collected</Text>
                  <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                    {formatCurrency(tripData.summary?.total_received || 0)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Balance</Text>
                  <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                    {formatCurrency(tripData.summary?.total_balance || 0)}
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'payments' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Payments</Text>
                  <Text style={styles.summaryValue}>{paymentData.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Received</Text>
                  <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                    {formatCurrency(paymentData.reduce((acc, p) => acc + (parseFloat(p.received_amount) || 0), 0))}
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'settlements' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Settlements</Text>
                  <Text style={styles.summaryValue}>{settlementData.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Driver Balance</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.accent }]}>
                    {formatCurrency(settlementData.reduce((acc, s) => acc + (parseFloat(s.balance_to_driver) || 0), 0))}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Full Report Export Actions: PDF, Print, CSV */}
          <View style={styles.fullExportRow}>
            <TouchableOpacity
              style={[styles.exportBtnBase, styles.exportPdfBtn]}
              onPress={handleExportFullPdf}
              disabled={pdfGenerating === 'full_pdf'}
            >
              {pdfGenerating === 'full_pdf' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FileText size={14} color="#fff" />
                  <Text style={styles.exportBtnTextWhite}>PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtnBase, styles.exportPrintBtn]}
              onPress={handlePrintFullPdf}
              disabled={pdfGenerating === 'full_print'}
            >
              {pdfGenerating === 'full_print' ? (
                <ActivityIndicator size="small" color="#1d4ed8" />
              ) : (
                <>
                  <Printer size={14} color="#1d4ed8" />
                  <Text style={styles.exportBtnTextBlue}>Print</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtnBase, styles.exportCsvBtn]}
              onPress={handleExportFullReport}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Download size={14} color="#fff" />
                  <Text style={styles.exportBtnTextWhite}>CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Cards List */}
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.centerText}>Loading Report Data...</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {/* TRIPS TAB LIST */}
            {activeTab === 'trips' && (
              tripData.trips?.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No trips found for selected filters</Text>
                </View>
              ) : (
                tripData.trips?.map((trip: any) => (
                  <View key={trip.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBadgeLorry}>
                        <Truck size={14} color={COLORS.primary} />
                        <Text style={styles.cardLorryText}>{trip.lorry_number}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '700' }}>#{trip.id}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <View style={[styles.cardStatus, getStatusStyle(trip.status)]}>
                          <Text style={[styles.cardStatusText, getStatusTextStyle(trip.status)]}>
                            {trip.status}
                          </Text>
                        </View>
                        {/* Single PDF Challan button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnPdf}
                          onPress={() => handleDownloadSingleTripPdf(trip)}
                          disabled={pdfGenerating === `trip_${trip.id}`}
                        >
                          {pdfGenerating === `trip_${trip.id}` ? (
                            <ActivityIndicator size="small" color="#b91c1c" />
                          ) : (
                            <FileText size={13} color="#b91c1c" />
                          )}
                          <Text style={styles.cardActionIconTextPdf}>PDF</Text>
                        </TouchableOpacity>

                        {/* Single CSV button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnCsv}
                          onPress={() => handleExportSingleTrip(trip)}
                        >
                          <Download size={13} color="#1d4ed8" />
                          <Text style={styles.cardActionIconTextCsv}>CSV</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.cardPartyText}>{trip.party_name}</Text>
                    <Text style={styles.cardRouteText}>
                      {trip.from_location} → {trip.to_location} • {trip.goods_weight} {trip.unit_name || 'Ton'}
                    </Text>

                    {trip.owner_name ? (
                      <View style={styles.ownerBadgeInCard}>
                        <Text style={styles.ownerBadgeInCardText}>🏢 Owner: {trip.owner_name}</Text>
                      </View>
                    ) : null}

                    <View style={styles.cardMetricsGrid}>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Freight</Text>
                        <Text style={styles.metricVal}>{formatCurrency(trip.total_freight)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Driver Exp</Text>
                        <Text style={[styles.metricVal, { color: '#7c3aed' }]}>{formatCurrency(driverExpenseBalance(trip).total)}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d', marginTop: 2 }}>
                          Settled {formatCurrency(driverExpenseBalance(trip).settled)}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: driverExpenseBalance(trip).toPay > 0 ? '#b91c1c' : '#15803d', marginTop: 1 }}>
                          To Pay {formatCurrency(driverExpenseBalance(trip).toPay)}
                        </Text>
                        <View style={[styles.cardStatus, getStatusStyle(driverExpenseStatusKey(trip)), { marginTop: 4, alignSelf: 'flex-start' }]}>
                          <Text style={[styles.cardStatusText, getStatusTextStyle(driverExpenseStatusKey(trip))]}>
                            {driverExpenseStatus(trip)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Drv Advance</Text>
                        <Text style={styles.metricVal}>{formatCurrency(trip.manager_advance ?? trip.advance_paid)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Need to Pay</Text>
                        <Text style={[styles.metricVal, { color: '#ef4444' }]}>{formatCurrency(trip.need_to_pay)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>In Hand</Text>
                        <Text style={[styles.metricVal, { color: '#10b981' }]}>{formatCurrency(trip.in_hand)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Party Recd</Text>
                        <Text style={[styles.metricVal, { color: '#10b981' }]}>
                          {formatCurrency(trip.total_received)}
                        </Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Party Bal</Text>
                        <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                          {formatCurrency(trip.balance_due)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardDate}>📅 {formatDateDMY(trip.trip_date)}</Text>
                      <Text style={styles.cardDriver}>👤 Driver: {trip.driver_name || 'N/A'}</Text>
                    </View>
                  </View>
                ))
              )
            )}

            {/* PAYMENTS TAB LIST */}
            {activeTab === 'payments' && (
              paymentData.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No payment records found</Text>
                </View>
              ) : (
                paymentData.map((p: any) => (
                  <View key={p.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardPartyText}>{p.party_name}</Text>
                      <View style={styles.cardActions}>
                        <Text style={[styles.metricVal, { color: '#10b981', fontSize: 15 }]}>
                          +{formatCurrency(p.received_amount)}
                        </Text>

                        {/* Single PDF Voucher button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnPdf}
                          onPress={() => handleDownloadSinglePaymentPdf(p)}
                          disabled={pdfGenerating === `payment_${p.id}`}
                        >
                          {pdfGenerating === `payment_${p.id}` ? (
                            <ActivityIndicator size="small" color="#b91c1c" />
                          ) : (
                            <FileText size={13} color="#b91c1c" />
                          )}
                          <Text style={styles.cardActionIconTextPdf}>PDF</Text>
                        </TouchableOpacity>

                        {/* Single CSV button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnCsv}
                          onPress={() => handleExportSinglePayment(p)}
                        >
                          <Download size={13} color="#1d4ed8" />
                          <Text style={styles.cardActionIconTextCsv}>CSV</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.cardRowDetails}>
                      <Text style={styles.cardLorryText}>🚛 {p.lorry_number}</Text>
                      <Text style={styles.cardDate}>📅 {formatDateDMY(p.payment_date)}</Text>
                    </View>

                    {p.owner_name ? (
                      <View style={styles.ownerBadgeInCard}>
                        <Text style={styles.ownerBadgeInCardText}>🏢 Owner: {p.owner_name}</Text>
                      </View>
                    ) : null}

                    <View style={styles.cardFooter}>
                      <Text style={styles.metricLabel}>Trip #{p.trip_id} Balance Due:</Text>
                      <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                        {formatCurrency(p.balance_due)}
                      </Text>
                    </View>
                  </View>
                ))
              )
            )}

            {/* SETTLEMENTS TAB LIST */}
            {activeTab === 'settlements' && (
              settlementData.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No settlement records found</Text>
                </View>
              ) : (
                settlementData.map((s: any) => (
                  <View key={s.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBadgeLorry}>
                        <Truck size={14} color={COLORS.primary} />
                        <Text style={styles.cardLorryText}>{s.lorry_number}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '700' }}>#{s.id}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <View style={[styles.cardStatus, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                          <Text style={[styles.cardStatusText, { color: '#047857' }]}>
                            {s.settlement_status}
                          </Text>
                        </View>

                        {/* Single PDF Settlement Slip button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnPdf}
                          onPress={() => handleDownloadSingleSettlementPdf(s)}
                          disabled={pdfGenerating === `settlement_${s.id}`}
                        >
                          {pdfGenerating === `settlement_${s.id}` ? (
                            <ActivityIndicator size="small" color="#b91c1c" />
                          ) : (
                            <FileText size={13} color="#b91c1c" />
                          )}
                          <Text style={styles.cardActionIconTextPdf}>PDF</Text>
                        </TouchableOpacity>

                        {/* Single CSV button */}
                        <TouchableOpacity
                          style={styles.cardActionIconBtnCsv}
                          onPress={() => handleExportSingleSettlement(s)}
                        >
                          <Download size={13} color="#1d4ed8" />
                          <Text style={styles.cardActionIconTextCsv}>CSV</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.cardPartyText}>Driver: {s.driver_name}</Text>
                    <Text style={styles.cardRouteText}>Party: {s.party_name}</Text>

                    {s.owner_name ? (
                      <View style={styles.ownerBadgeInCard}>
                        <Text style={styles.ownerBadgeInCardText}>🏢 Owner: {s.owner_name}</Text>
                      </View>
                    ) : null}

                    <View style={styles.cardMetricsGrid}>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Total Freight</Text>
                        <Text style={styles.metricVal}>{formatCurrency(s.total_freight)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Expenses</Text>
                        <Text style={styles.metricVal}>{formatCurrency(s.total_expenses)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>To Driver</Text>
                        <Text style={[styles.metricVal, { color: COLORS.accentDark }]}>
                          {formatCurrency(s.balance_to_driver)}
                        </Text>
                      </View>
                    </View>
                    {renderAdvancePaid(s)}

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardDate}>📅 {formatDateDMY(s.created_at || s.trip_date)}</Text>
                      <Text style={styles.cardDriver}>Trip #{s.trip_id}</Text>
                    </View>
                  </View>
                ))
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* Picker Modal for Truck / Party / Unit / Status */}
      <Modal
        visible={pickerModalType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPickerModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {pickerModalType === 'vehicle' && 'Select Truck / Lorry'}
                  {pickerModalType === 'party' && 'Select Party'}
                  {pickerModalType === 'unit' && 'Select Unit'}
                  {pickerModalType === 'status' && 'Select Trip Status'}
                  {pickerModalType === 'owner' && 'Select Truck Owner'}
                </Text>
                {pickerModalType === 'vehicle' && selectedOwner ? (
                  <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '700', marginTop: 2 }}>
                    🏢 Filtered by Owner: {selectedOwner.name} ({availableVehicles.length} vehicles)
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setPickerModalType(null)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* All Options list */}
            <FlatList
              data={
                pickerModalType === 'vehicle'
                  ? [{ id: 0, lorry_number: selectedOwner ? `All Lorries for ${selectedOwner.name}` : (isOwnerUser ? 'My Trucks' : 'All Trucks / Lorries') }, ...availableVehicles]
                  : pickerModalType === 'party'
                  ? [{ id: 0, name: 'All Parties' }, ...parties]
                  : pickerModalType === 'unit'
                  ? [{ id: 0, name: 'All Units' }, ...units]
                  : pickerModalType === 'owner'
                  ? [{ id: 0, name: isOwnerUser ? 'My Owners' : 'All Owners' }, ...owners]
                  : [
                      { id: 0, label: 'All Statuses', value: '' },
                      { id: 1, label: 'NEW', value: 'NEW' },
                      { id: 2, label: 'PAYMENT_PENDING', value: 'PAYMENT_PENDING' },
                      { id: 3, label: 'PARTIALLY_PAID', value: 'PARTIALLY_PAID' },
                      { id: 4, label: 'SETTLED', value: 'SETTLED' },
                      { id: 5, label: 'CANCELLED', value: 'CANCELLED' },
                    ]
              }
              keyExtractor={(item: any) => String(item.id || item.value)}
              renderItem={({ item }: { item: any }) => {
                let isSelected = false;
                let title = '';
                let subtitle = '';

                if (pickerModalType === 'vehicle') {
                  isSelected = (item.id === 0 && !selectedVehicleId) || selectedVehicleId === item.id;
                  title = item.lorry_number;
                  if (item.id !== 0 && item.owner_name) {
                    subtitle = `🏢 Owner: ${item.owner_name}`;
                  }
                } else if (pickerModalType === 'party') {
                  isSelected = (item.id === 0 && !selectedPartyId) || selectedPartyId === item.id;
                  title = item.name;
                } else if (pickerModalType === 'unit') {
                  isSelected = (item.id === 0 && !selectedUnitId) || selectedUnitId === item.id;
                  title = item.name;
                } else if (pickerModalType === 'owner') {
                  isSelected = (item.id === 0 && !selectedOwnerId) || selectedOwnerId === item.id;
                  title = item.name;
                  if (item.mobile_number) {
                    subtitle = `📞 ${item.mobile_number}`;
                  }
                } else {
                  isSelected = selectedStatus === item.value;
                  title = item.label;
                }

                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (pickerModalType === 'vehicle') {
                        setSelectedVehicleId(item.id === 0 ? undefined : item.id);
                      } else if (pickerModalType === 'party') {
                        setSelectedPartyId(item.id === 0 ? undefined : item.id);
                      } else if (pickerModalType === 'unit') {
                        setSelectedUnitId(item.id === 0 ? undefined : item.id);
                      } else if (pickerModalType === 'owner') {
                        const newOwnerId = item.id === 0 ? undefined : item.id;
                        setSelectedOwnerId(newOwnerId);
                        // If selected truck does not belong to the newly selected owner, reset it
                        if (newOwnerId && selectedVehicleId) {
                          const curV = vehicles.find((v) => v.id === selectedVehicleId);
                          if (curV && curV.owner_id !== newOwnerId) {
                            setSelectedVehicleId(undefined);
                          }
                        }
                      } else {
                        setSelectedStatus(item.value);
                      }
                      setPickerModalType(null);
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
        </View>
      </Modal>

      {/* Calendar Date Picker Modal */}
      <DatePickerModal
        visible={calendarPickerTarget !== null}
        value={calendarPickerTarget === 'from' ? fromDate : toDate}
        title={calendarPickerTarget === 'from' ? 'Report Filter: From Date' : 'Report Filter: To Date'}
        onConfirm={(isoDate) => {
          if (calendarPickerTarget === 'from') setFromDate(isoDate);
          else if (calendarPickerTarget === 'to') setToDate(isoDate);
          setQuickDateFilter('all');
          setCalendarPickerTarget(null);
        }}
        onClose={() => setCalendarPickerTarget(null)}
      />
    </View>
  );
};

const driverExpenseBalance = (t: any) => {
  const total = parseFloat(String(t.total_expenses || 0)) || 0;
  const toPay = Math.max(0, parseFloat(String(t.need_to_pay || 0)) || 0);
  return { total, toPay, settled: Math.max(0, total - toPay) };
};

const driverExpenseStatus = (t: any) => {
  const amt = parseFloat(String(t.total_expenses || 0)) || 0;
  if (amt <= 0) return 'NO EXPENSE';
  const settle = String(t.settlement_status || '').toUpperCase();
  if (settle === 'SETTLED') return 'SETTLED';
  if (settle === 'VERIFIED') return 'VERIFIED';
  const need = parseFloat(String(t.need_to_pay || 0)) || 0;
  const paid = parseFloat(String(t.driver_cash_paid || 0)) || 0;
  if (paid > 0 && need > 0) return 'PARTIALLY PAID';
  return 'PENDING';
};

const driverExpenseStatusKey = (t: any) => String(driverExpenseStatus(t)).replace(/ /g, '_');

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'SETTLED':
      return { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' };
    case 'PARTIALLY_PAID':
    case 'VERIFIED':
      return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
    case 'PAYMENT_PENDING':
    case 'PENDING':
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
    case 'VERIFIED':
      return { color: '#1d4ed8' };
    case 'PAYMENT_PENDING':
    case 'PENDING':
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  quickDateRow: {
    marginBottom: SPACING.sm,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  quickPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  quickPillTextActive: {
    color: COLORS.white,
  },
  filtersCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickResetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  quickResetText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  filterCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  ownerScopeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  ownerScopeText: {
    fontSize: 11,
    color: '#6d28d9',
  },
  dropdownBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
  },
  dropdownTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginHorizontal: 6,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  dateInputBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  datePickerCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  datePickerCardBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  datePickerCardText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  datePickerCardTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dateInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.text,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  clearBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  summaryBar: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.md,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },
  summaryItem: {
    minWidth: 70,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  fullExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 6,
  },
  exportBtnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  exportPdfBtn: {
    backgroundColor: '#dc2626',
  },
  exportPrintBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  exportCsvBtn: {
    backgroundColor: '#334155',
  },
  exportBtnTextWhite: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  exportBtnTextBlue: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  exportFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginLeft: 8,
  },
  exportFullBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  listContainer: {
    gap: 8,
    paddingBottom: 24,
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  dataCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardBadgeLorry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  cardLorryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardActionIconBtnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cardActionIconTextPdf: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c',
  },
  cardActionIconBtnCsv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cardActionIconTextCsv: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  singleDownloadBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },

  cardPartyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  cardRouteText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
  },
  cardMetric: {
    flex: 1,
    alignItems: 'center',
  },
  advanceStack: {
    gap: 4,
    marginBottom: 8,
  },
  advanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  advanceLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  advanceValue: {
    fontSize: 12,
    fontWeight: '800',
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  cardDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  cardDriver: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  cardRowDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
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
    maxHeight: '70%',
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
  ownerBadgeInCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  ownerBadgeInCardText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6d28d9',
  },
  clearQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginRight: 6,
  },
  clearQuickPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
});
