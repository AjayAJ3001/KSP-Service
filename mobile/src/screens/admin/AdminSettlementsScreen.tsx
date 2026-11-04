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
  RefreshControl,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Scale,
  Search,
  Truck,
  RefreshCw,
  FileText,
  Building2,
  User,
  ChevronDown,
  Check,
  X,
  Calendar,
  RotateCcw,
  Download,
  Share2,
  Printer,
  CheckCircle,
  Trash2,
  Plus,
  Banknote,
  Smartphone,
} from 'lucide-react-native';
import {
  adminSettlementService,
  adminOwnerService,
  adminVehicleService,
  adminPartyService,
  adminDriverService,
  adminTripService,
} from '../../services/adminService';
import { Settlement, Trip, Owner, Vehicle, Party, Driver } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';
import { exportCSV } from '../../utils/exportUtils';
import {
  downloadSettlementPdf,
  shareSettlementPdf,
  printSettlementPdf,
  downloadReportsPdf,
  printReportsPdf,
  shareReportsPdf,
} from '../../utils/pdfGenerator';

type StatusFilter = 'ALL' | 'PENDING' | 'VERIFIED' | 'SETTLED';
type PickerType = 'owner' | 'vehicle' | 'party' | 'driver' | null;

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
};

const getNetBalance = (s: Settlement) => {
  const expenses = Math.round(Number(s.total_expenses || 0));
  const managerGiven = Math.round(Number(s.manager_advance ?? s.initial_trip_advance ?? 0));
  const priorDeficit = Math.round(Number(s.prior_deficit_deduction || 0));
  const manager = (s as any).effective_manager_advance != null
    ? Math.round(Number((s as any).effective_manager_advance))
    : Math.max(0, managerGiven - priorDeficit);
  const ownerGiven = Math.round(Number(s.owner_given || 0));
  const leftoverUsed = Math.round(Number(s.owner_leftover_used || 0));
  const ownerBal = Math.round(Number(s.owner_balance || 0));
  const cashPaid = s.payment_mode !== 'ADJUSTED_ADVANCE' ? Math.round(Number(s.paid_amount || 0)) : 0;
  if (s.owner_applied != null || s.owner_given != null || s.owner_balance != null || (s as any).effective_manager_advance != null) {
    if (ownerBal > 0) return -ownerBal;
    return Math.max(0, expenses - manager - ownerGiven - leftoverUsed - cashPaid);
  }
  if (s.net_balance_to_driver !== undefined && s.net_balance_to_driver !== null) {
    return parseFloat(String(s.net_balance_to_driver)) || 0;
  }
  return parseFloat(String(s.balance_to_driver || 0)) || 0;
};

const getTripAdvancePaid = (s: Settlement) => {
  const manager = Math.round(parseFloat(String(s.manager_advance ?? s.initial_trip_advance ?? 0)) || 0);
  const leftoverUsed = Math.round(parseFloat(String(s.owner_leftover_used ?? 0)) || 0);
  return manager > 0 ? manager : leftoverUsed;
};

function getThisWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(start), to: fmt(end) };
}

export const AdminSettlementsScreen: React.FC<{ navigation: any }> = () => {
  const [items, setItems] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | 'pay' | null>(null);
  const [pickerModalType, setPickerModalType] = useState<PickerType>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [payTarget, setPayTarget] = useState<Settlement | null>(null);
  const [payMode, setPayMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [unsettledTrips, setUnsettledTrips] = useState<Trip[]>([]);
  const [selectedTripToSettle, setSelectedTripToSettle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tripSearch, setTripSearch] = useState('');

  const [owners, setOwners] = useState<Owner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const thisWeek = getThisWeekRange();
  const isThisWeekActive = fromDate === thisWeek.from && toDate === thisWeek.to;

  const availableVehicles = useMemo(() => {
    if (!ownerFilter) return vehicles;
    return vehicles.filter((v) => String(v.owner_id) === String(ownerFilter));
  }, [vehicles, ownerFilter]);

  const selectedOwner = owners.find((o) => String(o.id) === ownerFilter);
  const selectedVehicle = vehicles.find((v) => String(v.id) === vehicleFilter);
  const selectedParty = parties.find((p) => String(p.id) === partyFilter);
  const selectedDriver = drivers.find((d) => String(d.id) === driverFilter);

  const hasActiveFilters = Boolean(
    search ||
      statusFilter !== 'ALL' ||
      ownerFilter ||
      vehicleFilter ||
      partyFilter ||
      driverFilter ||
      fromDate ||
      toDate
  );

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setOwnerFilter('');
    setVehicleFilter('');
    setPartyFilter('');
    setDriverFilter('');
    setFromDate('');
    setToDate('');
  };

  const loadLookups = useCallback(async () => {
    try {
      const [oRes, vRes, pRes, dRes] = await Promise.all([
        adminOwnerService.getOwners({ limit: 200 }),
        adminVehicleService.getVehicles({ limit: 200 }),
        adminPartyService.getParties({ limit: 200 }),
        adminDriverService.getDrivers({ limit: 200 }),
      ]);
      setOwners(oRes.data.items || []);
      setVehicles(vRes.data.items || []);
      setParties(pRes.data.items || []);
      setDrivers(dRes.data.items || []);
    } catch (err) {
      console.warn('Failed to load settlement lookups', err);
    }
  }, []);

  const loadSettlements = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminSettlementService.getSettlements({
        limit: 500,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        owner_id: ownerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        party_id: partyFilter || undefined,
        driver_id: driverFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load settlements', err);
      Alert.alert('Error', err.message || 'Could not fetch settlements.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, ownerFilter, vehicleFilter, partyFilter, driverFilter, fromDate, toDate]);

  const loadUnsettledTrips = useCallback(async () => {
    try {
      const res = await adminTripService.getTrips({ limit: 100 });
      const eligible = (res.data.items || []).filter((t) => t.status !== 'SETTLED' && t.status !== 'CANCELLED');
      setUnsettledTrips(eligible);
    } catch (err) {
      console.warn('Failed to load unsettled trips', err);
    }
  }, []);

  useEffect(() => {
    loadLookups();
    loadUnsettledTrips();
  }, [loadLookups, loadUnsettledTrips]);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const filtered = items.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(s.lorry_number || '').toLowerCase().includes(q) ||
      String(s.driver_name || '').toLowerCase().includes(q) ||
      String(s.party_name || '').toLowerCase().includes(q) ||
      String(s.owner_name || '').toLowerCase().includes(q) ||
      String(s.id).includes(q) ||
      String(s.trip_id).includes(q)
    );
  });

  const getFilterSummary = () => {
    const parts: string[] = [];
    if (statusFilter !== 'ALL') parts.push(`Status: ${statusFilter}`);
    if (selectedOwner) parts.push(`Owner: ${selectedOwner.name}`);
    if (selectedVehicle) parts.push(`Truck: ${selectedVehicle.lorry_number}`);
    if (selectedParty) parts.push(`Party: ${selectedParty.name}`);
    if (selectedDriver) parts.push(`Driver: ${selectedDriver.name}`);
    if (fromDate || toDate) {
      parts.push(`Dates: ${toDisplayDate(fromDate) || 'Start'} to ${toDisplayDate(toDate) || 'Present'}`);
    }
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Settlements';
  };

  const getReportPayload = () => ({
    type: 'SETTLEMENTS' as const,
    title: 'Settlements Master Report',
    dateRange: fromDate || toDate ? `${toDisplayDate(fromDate) || 'Start'} to ${toDisplayDate(toDate) || 'Present'}` : 'All Dates',
    filtersText: getFilterSummary(),
    items: filtered,
  });

  const handleDownloadPdf = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No settlement records match the current filters.');
      return;
    }
    try {
      setPdfLoading('master_pdf');
      const res = await downloadReportsPdf(getReportPayload());
      if (res.savedDirectly) {
        Alert.alert('PDF Saved', `Settlements PDF saved as:\n${res.filename}`);
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not download settlements PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleSharePdf = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No settlement records match the current filters.');
      return;
    }
    try {
      setPdfLoading('master_share');
      await shareReportsPdf(getReportPayload());
    } catch (e: any) {
      Alert.alert('Share Error', e.message || 'Could not share settlements PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePrintPdf = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No settlement records match the current filters.');
      return;
    }
    try {
      setPdfLoading('master_print');
      await printReportsPdf(getReportPayload());
    } catch (e: any) {
      Alert.alert('Print Error', e.message || 'Could not print settlements PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadCsv = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No settlement records match the current filters.');
      return;
    }
    try {
      setIsExporting(true);
      const headers = [
        'Settlement ID',
        'Trip ID',
        'Date',
        'Lorry No',
        'Owner',
        'Driver',
        'Party',
        'From',
        'To',
        'Freight',
        'Expenses',
        'Advance',
        'Owner Advance',
        'Advance Balance in Hand',
        'Need to Pay',
        'Balance in Hand',
        'Status',
      ];
      const rows = filtered.map((s) => {
        const manager = Math.round(parseFloat(String(s.manager_advance ?? s.initial_trip_advance ?? 0)) || 0);
        const leftoverUsed = Math.round(parseFloat(String(s.owner_leftover_used ?? 0)) || 0);
        const ownerAdvance = Math.round(Number(s.owner_given || 0) || leftoverUsed);
        const ownerAdvanceBal = Math.round(parseFloat(String(s.owner_balance ?? 0)) || 0);
        return [
          `SET-${s.id}`,
          s.trip_id,
          formatDateDMY(s.trip_date || s.created_at),
          s.lorry_number || '',
          s.owner_name || '',
          s.driver_name || '',
          s.party_name || '',
          s.from_location || '',
          s.to_location || '',
          s.total_freight,
          s.total_expenses,
          manager,
          ownerAdvance,
          ownerAdvanceBal > 0 ? ownerAdvanceBal : leftoverUsed,
          (() => { const n = getNetBalance(s); return n > 0 ? n : 0; })(),
          (() => { const n = getNetBalance(s); return n < 0 ? Math.abs(n) : ownerAdvanceBal; })(),
          s.settlement_status,
        ];
      });
      await exportCSV(`KSP_Settlements_${Date.now()}`, headers, rows);
    } catch (e: any) {
      Alert.alert('Download Error', e.message || 'Could not download CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderAdvancePaid = (s: Settlement) => {
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

  const openPayModal = (settlement: Settlement) => {
    const netBal = getNetBalance(settlement);
    setPayTarget(settlement);
    setPayAmount(netBal.toFixed(2));
    setPayMode('CASH');
    setPayNotes('');
    setPayRef('');
    setPayDate(new Date().toISOString().split('T')[0]);
  };

  const handleSettleFromAdvance = (settlement: Settlement) => {
    const netBal = getNetBalance(settlement);
    const surplus = Math.abs(netBal);
    const driverCurrentBal = parseFloat(String(settlement.driver_current_balance ?? 0));
    const isCoveredByAdvance = netBal > 0 && driverCurrentBal >= 0;
    const msg = isCoveredByAdvance
      ? `Settle Trip #${settlement.trip_id} by adjusting ₹${netBal.toLocaleString('en-IN')} pending dues from driver advance balance?\n\nDriver currently holds ₹${driverCurrentBal.toLocaleString('en-IN')} advance.\nNo cash payout required.`
      : surplus > 0
      ? `Settle Trip #${settlement.trip_id} by deducting expenses from driver advance?\nDriver holds ₹${surplus.toLocaleString('en-IN')} remaining in hand.\nNo cash payout.`
      : `Settle Trip #${settlement.trip_id} from driver advance?\nNo cash payout required.`;

    Alert.alert('Settle from Advance', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle',
        onPress: async () => {
          try {
            setIsPaying(true);
            await adminSettlementService.settlePayment(settlement.id, {
              payment_mode: 'ADJUSTED_ADVANCE',
              payment_date: new Date().toISOString().split('T')[0],
              paid_amount: isCoveredByAdvance ? netBal : 0,
              notes: isCoveredByAdvance
                ? `Pending dues of ₹${netBal.toFixed(2)} adjusted from driver advance.`
                : `Trip expenses deducted from driver advance. Remaining: ₹${surplus.toFixed(2)}.`,
            });
            loadSettlements();
            loadUnsettledTrips();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to settle from advance.');
          } finally {
            setIsPaying(false);
          }
        },
      },
    ]);
  };

  const handlePayDriver = async () => {
    if (!payTarget) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Amount Required', 'Please enter a valid amount to pay.');
      return;
    }
    try {
      setIsPaying(true);
      await adminSettlementService.settlePayment(payTarget.id, {
        payment_mode: payMode,
        payment_date: payDate,
        paid_amount: amount,
        reference_no: payRef || undefined,
        notes: payNotes || undefined,
      });
      setPayTarget(null);
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message || 'Could not record driver payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDeleteSettlement = (settlement: Settlement) => {
    Alert.alert(
      'Delete Settlement',
      `Delete Settlement SET-${settlement.id} for Trip #${settlement.trip_id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminSettlementService.deleteSettlement(settlement.id);
              loadSettlements();
              loadUnsettledTrips();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete settlement.');
            }
          },
        },
      ]
    );
  };

  const handleGenerateSettlement = async () => {
    if (!selectedTripToSettle) return;
    try {
      setIsSubmitting(true);
      await adminSettlementService.generateSettlement(parseInt(selectedTripToSettle, 10));
      setIsGenerateOpen(false);
      setSelectedTripToSettle('');
      loadSettlements();
      loadUnsettledTrips();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPayable = (s: Settlement) => {
    const netBal = getNetBalance(s);
    const prevInHand = parseFloat(String(s.previous_driver_balance || 0));
    const tripExp = parseFloat(String(s.total_expenses || 0));
    const tripAdv = getTripAdvancePaid(s);
    const isSettled = s.settlement_status === 'SETTLED';
    const paidAmt = parseFloat(String(s.paid_amount || 0));
    const takenFromHand = prevInHand > 0 ? Math.min(prevInHand, Math.max(0, tripExp - tripAdv)) : 0;
    const driverCurrentBalance = parseFloat(String(s.driver_current_balance ?? 0));
    const isCoveredByAdvance = !isSettled && netBal > 0 && driverCurrentBalance >= 0;

    if (isSettled) {
      if (s.payment_mode === 'ADJUSTED_ADVANCE' && paidAmt > 0) {
        return (
          <View style={[styles.payableBox, { backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.payableAmount, { color: '#059669' }]}>Adjusted: {formatCurrency(paidAmt)}</Text>
            <Text style={[styles.payableHint, { color: '#059669' }]}>✓ Settled (Advance Adjusted)</Text>
          </View>
        );
      }
      if (paidAmt > 0) {
        return (
          <View style={[styles.payableBox, { backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.payableAmount, { color: '#15803d' }]}>Paid: {formatCurrency(paidAmt)}</Text>
            <Text style={[styles.payableHint, { color: '#15803d' }]}>✓ Settled (Paid to Driver)</Text>
            {s.payment_mode ? <Text style={styles.payableHint}>{s.payment_mode}{s.payment_date ? ` · ${formatDateDMY(s.payment_date)}` : ''}</Text> : null}
          </View>
        );
      }
      if (netBal < 0) {
        return (
          <View style={[styles.payableBox, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.payableAmount, { color: '#1d4ed8' }]}>{formatCurrency(Math.abs(netBal))}</Text>
            <Text style={[styles.payableHint, { color: '#1d4ed8' }]}>in Driver Hand (Settled)</Text>
          </View>
        );
      }
      return (
        <View style={[styles.payableBox, { backgroundColor: '#ecfdf5' }]}>
          <Text style={[styles.payableAmount, { color: '#059669' }]}>{formatCurrency(0)}</Text>
          <Text style={[styles.payableHint, { color: '#059669' }]}>✓ Settled (Nil Balance)</Text>
        </View>
      );
    }

    if (isCoveredByAdvance) {
      return (
        <View style={[styles.payableBox, { backgroundColor: '#ecfdf5' }]}>
          <Text style={[styles.payableAmount, { color: '#059669' }]}>Covered: {formatCurrency(netBal)}</Text>
          <Text style={[styles.payableHint, { color: '#059669' }]}>✓ Covered by Advance (₹0 Due)</Text>
        </View>
      );
    }

    if (netBal > 0) {
      return (
        <View style={[styles.payableBox, { backgroundColor: '#fef2f2' }]}>
          {prevInHand > 0 ? (
            <Text style={styles.payableHint}>Already in hand taken: {formatCurrency(prevInHand)}</Text>
          ) : null}
          <Text style={[styles.payableAmount, { color: '#b91c1c' }]}>Need to Pay {formatCurrency(netBal)}</Text>
          <Text style={[styles.payableHint, { color: '#b91c1c' }]}>Payable to Driver</Text>
        </View>
      );
    }

    const inHand = Math.abs(netBal);
    return (
      <View style={[styles.payableBox, { backgroundColor: '#eff6ff' }]}>
        {takenFromHand > 0 ? (
          <Text style={styles.payableHint}>Already in hand taken: {formatCurrency(takenFromHand)}</Text>
        ) : null}
        <Text style={[styles.payableAmount, { color: '#1d4ed8' }]}>{formatCurrency(inHand)}</Text>
        <Text style={[styles.payableHint, { color: '#1d4ed8' }]}>in Driver Hand</Text>
      </View>
    );
  };

  const toTrip = (s: Settlement) =>
    ({
      id: s.trip_id,
      trip_date: s.trip_date,
      lorry_number: s.lorry_number,
      driver_name: s.driver_name,
      party_name: s.party_name,
      owner_name: s.owner_name,
      from_location: s.from_location,
      to_location: s.to_location,
      status: s.settlement_status,
    }) as Trip;

  const handleDownloadSlip = async (s: Settlement) => {
    try {
      setPdfLoading(`dl_${s.id}`);
      const res = await downloadSettlementPdf(toTrip(s), s);
      if (res.savedDirectly) {
        Alert.alert('Saved', `Settlement slip saved as:\n${res.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not download settlement PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleShareSlip = async (s: Settlement) => {
    try {
      setPdfLoading(`sh_${s.id}`);
      await shareSettlementPdf(toTrip(s), s);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share settlement PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePrintSlip = async (s: Settlement) => {
    try {
      setPdfLoading(`pr_${s.id}`);
      await printSettlementPdf(toTrip(s), s);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not print settlement PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const statusColor = (status?: string) => {
    if (status === 'SETTLED') return { bg: '#ecfdf5', text: '#047857' };
    if (status === 'VERIFIED') return { bg: '#eff6ff', text: '#1d4ed8' };
    return { bg: '#fff7ed', text: '#c2410c' };
  };

  const modalItems = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    if (pickerModalType === 'owner') {
      const list = owners.map((o) => ({
        id: String(o.id),
        title: o.name,
        subtitle: (o as any).mobile_number || '',
      }));
      const all = { id: '', title: 'All Owners', subtitle: '' };
      const filteredList = q ? list.filter((o) => o.title.toLowerCase().includes(q) || o.subtitle.includes(q)) : list;
      return [all, ...filteredList];
    }
    if (pickerModalType === 'vehicle') {
      const list = availableVehicles.map((v) => ({
        id: String(v.id),
        title: v.lorry_number,
        subtitle: v.owner_name || '',
      }));
      const all = {
        id: '',
        title: ownerFilter ? `All Trucks for Owner (${availableVehicles.length})` : 'All Trucks',
        subtitle: '',
      };
      const filteredList = q
        ? list.filter((v) => v.title.toLowerCase().includes(q) || v.subtitle.toLowerCase().includes(q))
        : list;
      return [all, ...filteredList];
    }
    if (pickerModalType === 'party') {
      const list = parties.map((p) => ({
        id: String(p.id),
        title: p.name,
        subtitle: p.mobile_number || p.contact_person || '',
      }));
      const all = { id: '', title: 'All Parties', subtitle: '' };
      const filteredList = q
        ? list.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
        : list;
      return [all, ...filteredList];
    }
    if (pickerModalType === 'driver') {
      const list = drivers.map((d) => ({
        id: String(d.id),
        title: d.name,
        subtitle: d.mobile_number || '',
      }));
      const all = { id: '', title: 'All Drivers', subtitle: '' };
      const filteredList = q
        ? list.filter((d) => d.title.toLowerCase().includes(q) || d.subtitle.includes(q))
        : list;
      return [all, ...filteredList];
    }
    return [];
  }, [pickerModalType, owners, availableVehicles, parties, drivers, ownerFilter, modalSearch]);

  const applyPicker = (id: string) => {
    if (pickerModalType === 'owner') {
      setOwnerFilter(id);
      if (id && vehicleFilter) {
        const curV = vehicles.find((v) => String(v.id) === vehicleFilter);
        if (curV && String(curV.owner_id) !== id) setVehicleFilter('');
      }
    } else if (pickerModalType === 'vehicle') {
      setVehicleFilter(id);
    } else if (pickerModalType === 'party') {
      setPartyFilter(id);
    } else if (pickerModalType === 'driver') {
      setDriverFilter(id);
    }
    setPickerModalType(null);
    setModalSearch('');
  };

  const isSelected = (id: string) => {
    if (pickerModalType === 'owner') return (id === '' && !ownerFilter) || ownerFilter === id;
    if (pickerModalType === 'vehicle') return (id === '' && !vehicleFilter) || vehicleFilter === id;
    if (pickerModalType === 'party') return (id === '' && !partyFilter) || partyFilter === id;
    if (pickerModalType === 'driver') return (id === '' && !driverFilter) || driverFilter === id;
    return false;
  };

  const pickerTitle =
    pickerModalType === 'owner'
      ? 'Select Truck Owner'
      : pickerModalType === 'vehicle'
      ? 'Select Truck / Lorry'
      : pickerModalType === 'party'
      ? 'Select Party'
      : 'Select Driver';

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Settlements Master</Text>
            <Text style={styles.headerSub}>
              {filtered.length} of {total} records
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.settleTripBtn}
              onPress={() => {
                setTripSearch('');
                setSelectedTripToSettle('');
                setIsGenerateOpen(true);
                loadUnsettledTrips();
              }}
            >
              <Plus size={14} color="#fff" />
              <Text style={styles.settleTripBtnText}>Settle Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadSettlements}>
              <RefreshCw size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lorry, driver, party..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['ALL', 'PENDING', 'VERIFIED', 'SETTLED'] as StatusFilter[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.chip, statusFilter === tab && styles.chipActive]}
              onPress={() => setStatusFilter(tab)}
            >
              <Text style={[styles.chipText, statusFilter === tab && styles.chipTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, isThisWeekActive && styles.chipActive]}
            onPress={() => {
              if (isThisWeekActive) {
                setFromDate('');
                setToDate('');
              } else {
                setFromDate(thisWeek.from);
                setToDate(thisWeek.to);
              }
            }}
          >
            <Text style={[styles.chipText, isThisWeekActive && styles.chipTextActive]}>This Week</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.dropdownBtn, partyFilter ? styles.dropdownBtnActive : null]}
            onPress={() => {
              setModalSearch('');
              setPickerModalType('party');
            }}
          >
            <Building2 size={14} color={partyFilter ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.dropdownText, partyFilter ? styles.dropdownTextActive : null]} numberOfLines={1}>
              {selectedParty ? selectedParty.name : 'All Parties'}
            </Text>
            <ChevronDown size={14} color={partyFilter ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownBtn, driverFilter ? styles.dropdownBtnActive : null]}
            onPress={() => {
              setModalSearch('');
              setPickerModalType('driver');
            }}
          >
            <User size={14} color={driverFilter ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.dropdownText, driverFilter ? styles.dropdownTextActive : null]} numberOfLines={1}>
              {selectedDriver ? selectedDriver.name : 'All Drivers'}
            </Text>
            <ChevronDown size={14} color={driverFilter ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.dropdownBtn, ownerFilter ? styles.dropdownBtnOwner : null]}
            onPress={() => {
              setModalSearch('');
              setPickerModalType('owner');
            }}
          >
            <Text style={{ fontSize: 12 }}>🏢</Text>
            <Text style={[styles.dropdownText, ownerFilter ? styles.dropdownTextOwner : null]} numberOfLines={1}>
              {selectedOwner ? selectedOwner.name : 'All Owners'}
            </Text>
            <ChevronDown size={14} color={ownerFilter ? '#7c3aed' : COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownBtn, vehicleFilter ? styles.dropdownBtnActive : null]}
            onPress={() => {
              setModalSearch('');
              setPickerModalType('vehicle');
            }}
          >
            <Truck size={14} color={vehicleFilter ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.dropdownText, vehicleFilter ? styles.dropdownTextActive : null]} numberOfLines={1}>
              {selectedVehicle
                ? selectedVehicle.lorry_number
                : ownerFilter
                ? `Trucks (${availableVehicles.length})`
                : 'All Trucks'}
            </Text>
            <ChevronDown size={14} color={vehicleFilter ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRangeRow}>
          <TouchableOpacity
            style={[styles.datePickerBtn, fromDate ? styles.datePickerBtnActive : null]}
            onPress={() => setDatePickerTarget('from')}
          >
            <Calendar size={12} color={fromDate ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.datePickerBtnText, fromDate ? styles.datePickerBtnTextActive : null]}>
              {fromDate ? toDisplayDate(fromDate) : 'From Date'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.dateDash}>–</Text>
          <TouchableOpacity
            style={[styles.datePickerBtn, toDate ? styles.datePickerBtnActive : null]}
            onPress={() => setDatePickerTarget('to')}
          >
            <Calendar size={12} color={toDate ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.datePickerBtnText, toDate ? styles.datePickerBtnTextActive : null]}>
              {toDate ? toDisplayDate(toDate) : 'To Date'}
            </Text>
          </TouchableOpacity>
          {(fromDate || toDate) && (
            <TouchableOpacity
              onPress={() => {
                setFromDate('');
                setToDate('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={12} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={handleClearAllFilters}>
              <RotateCcw size={11} color="#dc2626" />
              <Text style={styles.clearFiltersBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportPdf]}
            onPress={handleDownloadPdf}
            disabled={pdfLoading === 'master_pdf'}
          >
            {pdfLoading === 'master_pdf' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FileText size={13} color="#fff" />
                <Text style={styles.exportBtnWhite}>PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportShare]}
            onPress={handleSharePdf}
            disabled={pdfLoading === 'master_share'}
          >
            {pdfLoading === 'master_share' ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <>
                <Share2 size={13} color="#047857" />
                <Text style={styles.exportBtnGreen}>Share</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportPrint]}
            onPress={handlePrintPdf}
            disabled={pdfLoading === 'master_print'}
          >
            {pdfLoading === 'master_print' ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <>
                <Printer size={13} color="#1d4ed8" />
                <Text style={styles.exportBtnBlue}>Print</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportCsv]}
            onPress={handleDownloadCsv}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Download size={13} color="#fff" />
                <Text style={styles.exportBtnWhite}>Download</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading settlements...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerBox}>
          <Scale size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No settlements found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadSettlements} />}
        >
          {filtered.map((s) => {
            const netBal = getNetBalance(s);
            const driverCurrentBal = parseFloat(String(s.driver_current_balance ?? 0));
            const isCoveredByAdvance =
              s.settlement_status !== 'SETTLED' && netBal > 0 && driverCurrentBal >= 0;
            const st = isCoveredByAdvance
              ? { bg: '#ecfdf5', text: '#059669', label: 'COVERED BY ADVANCE' }
              : { ...statusColor(s.settlement_status), label: s.settlement_status };
            const canAct = s.settlement_status === 'PENDING' || s.settlement_status === 'VERIFIED';
            return (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.lorryTag}>
                    <Truck size={14} color={COLORS.primary} />
                    <Text style={styles.lorryText}>{s.lorry_number}</Text>
                    <Text style={styles.idText}>SET-{s.id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>

                <Text style={styles.partyText}>Party: {s.party_name || '—'}</Text>
                <Text style={styles.metaLine}>
                  {[s.owner_name ? `Owner: ${s.owner_name}` : '', [s.from_location, s.to_location].filter(Boolean).join(' to ')]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
                <Text style={styles.metaLine}>
                  Driver: {s.driver_name || '—'}  ·  Trip #{s.trip_id}
                </Text>
                <Text style={styles.metaLine}>Date: {formatDateDMY(s.trip_date || s.created_at)}</Text>

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Freight</Text>
                    <Text style={styles.metricVal}>{formatCurrency(s.total_freight)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Expenses</Text>
                    <Text style={styles.metricVal}>{formatCurrency(s.total_expenses)}</Text>
                  </View>
                </View>

                {renderAdvancePaid(s)}
                {renderPayable(s)}

                <View style={styles.slipActionRow}>
                  <TouchableOpacity
                    style={styles.slipDownloadBtn}
                    onPress={() => handleDownloadSlip(s)}
                    disabled={!!pdfLoading}
                  >
                    {pdfLoading === `dl_${s.id}` ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Download size={13} color="#fff" />
                        <Text style={styles.slipDownloadText}>Download</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.slipShareBtn}
                    onPress={() => handleShareSlip(s)}
                    disabled={!!pdfLoading}
                  >
                    {pdfLoading === `sh_${s.id}` ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : (
                      <>
                        <Share2 size={13} color="#047857" />
                        <Text style={styles.slipShareText}>Share</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pdfBtn}
                    onPress={() => handlePrintSlip(s)}
                    disabled={!!pdfLoading}
                  >
                    {pdfLoading === `pr_${s.id}` ? (
                      <ActivityIndicator size="small" color="#b91c1c" />
                    ) : (
                      <>
                        <Printer size={13} color="#b91c1c" />
                        <Text style={styles.pdfBtnText}>PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  {canAct && netBal > 0 && !isCoveredByAdvance ? (
                    <TouchableOpacity style={styles.payBtn} onPress={() => openPayModal(s)} disabled={isPaying}>
                      <Banknote size={14} color="#fff" />
                      <Text style={styles.payBtnText}>Pay {formatCurrency(netBal)}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canAct && (netBal <= 0 || isCoveredByAdvance) ? (
                    <TouchableOpacity
                      style={[styles.payBtn, { backgroundColor: isCoveredByAdvance ? '#059669' : '#2563eb' }]}
                      onPress={() => handleSettleFromAdvance(s)}
                      disabled={isPaying}
                    >
                      <CheckCircle size={14} color="#fff" />
                      <Text style={styles.payBtnText}>
                        {isCoveredByAdvance ? 'Settle (Advance Covers)' : 'Settle (Advance)'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteSettlement(s)}>
                    <Trash2 size={14} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={pickerModalType !== null}
        animationType="slide"
        transparent
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
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity
                onPress={() => {
                  setPickerModalType(null);
                  setModalSearch('');
                }}
              >
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Search size={14} color={COLORS.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search..."
                placeholderTextColor={COLORS.textMuted}
                value={modalSearch}
                onChangeText={setModalSearch}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={modalItems}
              keyExtractor={(item) => String(item.id) + item.title}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, isSelected(item.id) && styles.modalItemSelected]}
                  onPress={() => applyPicker(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, isSelected(item.id) && styles.modalItemTextSelected]}>
                      {item.title}
                    </Text>
                    {item.subtitle ? <Text style={styles.modalSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  {isSelected(item.id) ? <Check size={18} color={COLORS.accentDark} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={payTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPayTarget(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.paySheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay Driver Settlement</Text>
              <TouchableOpacity onPress={() => setPayTarget(null)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {payTarget ? (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
                <View style={[styles.payableBox, { backgroundColor: '#fef2f2', marginBottom: 14 }]}>
                  <Text style={styles.payMeta}>
                    SET-{payTarget.id} · Trip #{payTarget.trip_id}
                  </Text>
                  <Text style={styles.payMeta}>
                    {payTarget.driver_name} · {payTarget.lorry_number}
                  </Text>
                  <Text style={[styles.payableAmount, { color: '#b91c1c', marginTop: 6 }]}>
                    Payable {formatCurrency(getNetBalance(payTarget))}
                  </Text>
                </View>

                <Text style={styles.formLabel}>Payment Mode *</Text>
                <View style={styles.modeRow}>
                  {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeBtn, payMode === mode && styles.modeBtnActive]}
                      onPress={() => setPayMode(mode)}
                    >
                      {mode === 'CASH' ? (
                        <Banknote size={16} color={payMode === 'CASH' ? '#15803d' : COLORS.textMuted} />
                      ) : (
                        <Smartphone size={16} color={payMode === mode ? '#7c3aed' : COLORS.textMuted} />
                      )}
                      <Text style={[styles.modeBtnText, payMode === mode && styles.modeBtnTextActive]}>
                        {mode === 'BANK_TRANSFER' ? 'Bank' : mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Amount to Pay (₹) *</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="Enter amount"
                />

                <Text style={styles.formLabel}>Settlement Date *</Text>
                <TouchableOpacity style={styles.formInput} onPress={() => setDatePickerTarget('pay')}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{toDisplayDate(payDate) || payDate}</Text>
                </TouchableOpacity>

                {(payMode === 'UPI' || payMode === 'BANK_TRANSFER') && (
                  <>
                    <Text style={styles.formLabel}>
                      {payMode === 'UPI' ? 'UPI Reference (optional)' : 'Bank Reference (optional)'}
                    </Text>
                    <TextInput style={styles.formInput} value={payRef} onChangeText={setPayRef} placeholder="Reference no" />
                  </>
                )}

                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={payNotes}
                  onChangeText={setPayNotes}
                  placeholder="Final settlement for trip"
                />

                <TouchableOpacity style={styles.confirmPayBtn} onPress={handlePayDriver} disabled={isPaying}>
                  {isPaying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmPayText}>Record Payment & Settle</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isGenerateOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsGenerateOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paySheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Trip Settlement</Text>
              <TouchableOpacity onPress={() => setIsGenerateOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Search size={14} color={COLORS.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search trip, lorry, driver..."
                value={tripSearch}
                onChangeText={setTripSearch}
              />
            </View>
            <FlatList
              data={unsettledTrips.filter((t) => {
                if (!tripSearch.trim()) return true;
                const q = tripSearch.toLowerCase();
                return (
                  String(t.id).includes(q) ||
                  String(t.lorry_number || '').toLowerCase().includes(q) ||
                  String(t.driver_name || '').toLowerCase().includes(q) ||
                  String(t.party_name || '').toLowerCase().includes(q)
                );
              })}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedTripToSettle === String(item.id) && styles.modalItemSelected]}
                  onPress={() => setSelectedTripToSettle(String(item.id))}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>
                      Trip #{item.id} — {item.lorry_number}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {item.driver_name} · {item.party_name} · {formatCurrency(item.total_freight)}
                    </Text>
                  </View>
                  {selectedTripToSettle === String(item.id) ? <Check size={18} color={COLORS.accentDark} /> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.centerText, { padding: 24 }]}>No unsettled trips found</Text>}
            />
            <TouchableOpacity
              style={[styles.confirmPayBtn, { margin: 16, opacity: selectedTripToSettle ? 1 : 0.5 }]}
              disabled={!selectedTripToSettle || isSubmitting}
              onPress={handleGenerateSettlement}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmPayText}>Generate Settlement</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'from' ? fromDate : datePickerTarget === 'to' ? toDate : payDate}
        title={
          datePickerTarget === 'from'
            ? 'Filter: From Date'
            : datePickerTarget === 'to'
            ? 'Filter: To Date'
            : 'Settlement Date'
        }
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          else if (datePickerTarget === 'pay') setPayDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, height: 40, fontSize: 13, color: COLORS.text },
  chips: { paddingBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.white },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  dropdownBtnActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  dropdownBtnOwner: { borderColor: '#c4b5fd', backgroundColor: '#faf5ff' },
  dropdownText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  dropdownTextActive: { color: COLORS.primary },
  dropdownTextOwner: { color: '#7c3aed', fontWeight: '800' },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  datePickerBtnActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  datePickerBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  datePickerBtnTextActive: { color: COLORS.primary },
  dateDash: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2',
  },
  clearFiltersBtnText: { fontSize: 11, fontWeight: '800', color: '#dc2626' },
  exportRow: { flexDirection: 'row', gap: 6 },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  exportPdf: { backgroundColor: '#dc2626' },
  exportShare: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac' },
  exportPrint: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd' },
  exportCsv: { backgroundColor: '#047857' },
  exportBtnWhite: { color: '#fff', fontSize: 11, fontWeight: '800' },
  exportBtnGreen: { color: '#047857', fontSize: 11, fontWeight: '800' },
  exportBtnBlue: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  centerText: { marginTop: 10, fontSize: 13, color: COLORS.textMuted },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 28 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lorryTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lorryText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  idText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  partyText: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  metaLine: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  metrics: { flexDirection: 'row', marginTop: 8, marginBottom: 8, gap: 8 },
  metric: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 8 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  metricVal: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  advanceStack: { gap: 4, marginBottom: 10 },
  advanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  advanceLabel: { fontSize: 11, fontWeight: '700' },
  advanceValue: { fontSize: 12, fontWeight: '800' },
  settleTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  settleTripBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  payableBox: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  payableAmount: { fontSize: 14, fontWeight: '800' },
  payableHint: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  slipActionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  slipDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#047857',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
  },
  slipDownloadText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  slipShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
  },
  slipShareText: { color: '#047857', fontSize: 12, fontWeight: '800' },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pdfBtnText: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  payBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#15803d',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  payBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  paySheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
  },
  payMeta: { fontSize: 12, fontWeight: '700', color: '#991b1b' },
  formLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
  },
  modeBtnActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  modeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.primary },
  confirmPayBtn: {
    marginTop: 16,
    backgroundColor: '#15803d',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmPayText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalSearchBox: {
    margin: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
  },
  modalSearchInput: { flex: 1, height: 40, fontSize: 13, color: COLORS.text },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: { backgroundColor: '#eff6ff' },
  modalItemText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  modalItemTextSelected: { color: COLORS.primary },
  modalSubtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
