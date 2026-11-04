import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { formatDateDMY } from '../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  FlatList,
  Animated,
  Easing,
  TextInput,
} from 'react-native';
import {
  Truck,
  MapPin,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  User,
  HandCoins,
  ShieldAlert,
  PlusCircle,
  X,
  FileText,
  Clock,
  List,
  Download,
  Share2,
  Scale,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Search,
  Printer,
  Check,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  mobileDashboardService,
  mobileLookupService,
  mobileDriverAdvanceService,
  mobileSettlementService,
} from '../services/mobileService';
import { MobileDashboardData, Trip, Vehicle } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  downloadTripPdf,
  shareTripPdf,
  printDriverStatementPdf,
  downloadDriverStatementPdf,
  shareDriverStatementPdf,
} from '../utils/pdfGenerator';
import { buildDriverTripStories, getSettlementBreakdown } from '../utils/driverTripStories';

/* ─── helpers ──────────────────────────────────────────────── */
const getDaysDifference = (expiryDateStr?: string) => {
  if (!expiryDateStr) return null;
  try {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const getVehicleDocAlerts = (v: Vehicle) => {
  const docs: { name: string; date?: string }[] = [
    { name: 'Insurance', date: v.insurance_expiry_date },
    { name: 'Permit', date: v.permit_expiry_date },
    { name: 'Yearly Tax', date: v.tax_expiry_date },
    { name: 'RC', date: v.rc_expiry_date },
  ];
  return docs
    .map((d) => {
      const days = getDaysDifference(d.date);
      if (days === null || days > 30 || !d.date) return null;
      return { name: d.name, date: formatDateDMY(d.date), days, isExpired: days < 0 };
    })
    .filter((x): x is { name: string; date: string; days: number; isExpired: boolean } => x !== null);
};

/* ─────────────────────────────────────────────────────────────
   Shared: Bottom Sheet wrapper
───────────────────────────────────────────────────────────── */
interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: any;
}
const BottomSheet: React.FC<SheetProps> = ({ visible, onClose, children, sheetStyle }) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View style={mStyles.modalOverlay}>
      {/* Backdrop tap to dismiss (covers area above sheet) */}
      <TouchableOpacity
        style={mStyles.backdropTouch}
        activeOpacity={1}
        onPress={onClose}
      />
      {/* Sheet content container */}
      <View style={[mStyles.sheet, sheetStyle]}>
        <View style={mStyles.handle} />
        {children}
      </View>
    </View>
  </Modal>
);

/* ─────────────────────────────────────────────────────────────
   Advance Detail Modal
───────────────────────────────────────────────────────────── */
interface AdvanceModalProps {
  visible: boolean;
  onClose: () => void;
  data: MobileDashboardData | null;
  formatCurrency: (v: number | string) => string;
  formatDate: (d?: string) => string;
}
const AdvanceDetailModal: React.FC<AdvanceModalProps> = ({
  visible, onClose, data, formatCurrency, formatDate,
}) => (
  <BottomSheet visible={visible} onClose={onClose}>
    {/* Header */}
    <View style={mStyles.sheetHeader}>
      <View style={mStyles.advHeaderLeft}>
        <View style={mStyles.advIconCircle}>
          <HandCoins size={20} color="#15803d" />
        </View>
        <View>
          <Text style={mStyles.advTitle}>Owner Advance Credit</Text>
          <Text style={mStyles.advSubtitle}>Received advance breakdown</Text>
        </View>
      </View>
      <TouchableOpacity
        style={mStyles.closeBtn}
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <X size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>

    {/* Totals */}
    <View style={mStyles.advTotalBox}>
      <Text style={mStyles.advTotalLabel}>TOTAL ADVANCE</Text>
      <Text style={mStyles.advTotalAmount}>{formatCurrency(data?.owner_advance_credit ?? 0)}</Text>
      <Text style={mStyles.advBalanceLabel}>
        Available Balance: {formatCurrency(data?.manager_available_balance ?? 0)}
      </Text>
    </View>

    {/* Breakdown */}
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {(data?.owner_advance_breakdown ?? []).length === 0 ? (
        <View style={mStyles.emptyBox}>
          <HandCoins size={28} color={COLORS.textMuted} />
          <Text style={mStyles.emptyText}>No advance entries recorded</Text>
        </View>
      ) : (
        <>
          <Text style={mStyles.sectionLabel}>
            RECEIVED FROM OWNER ({data!.owner_advance_breakdown.length})
          </Text>
          {data!.owner_advance_breakdown.map((entry, i) => (
            <View key={i} style={mStyles.advRow}>
              <View style={mStyles.advRowLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <User size={14} color="#15803d" />
                  <Text style={mStyles.advOwnerName}>{entry.owner_name}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Calendar size={12} color="#166534" />
                  <Text style={mStyles.advDate}>{formatDate(entry.advance_date)}</Text>
                  {entry.payment_mode ? (
                    <View style={mStyles.paymentModeBadge}>
                      <Text style={mStyles.paymentModeText}>{entry.payment_mode}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={mStyles.advAmount}>{formatCurrency(entry.amount)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  </BottomSheet>
);

/* ─────────────────────────────────────────────────────────────
   Driver Advance & Balance Modal
───────────────────────────────────────────────────────────── */
interface DriverAdvanceModalProps {
  visible: boolean;
  onClose: () => void;
  balances: {
    driver_id: number;
    driver_name: string;
    driver_mobile?: string;
    total_advance_given: number;
    total_expenses: number;
    balance_in_manager_hand: number;
  }[];
  formatCurrency: (v: number | string) => string;
  selectedDriverId: number | null;
  onSelectDriver: (driverId: number) => void;
  onRefreshDashboard?: () => void;
}

const DriverAdvanceModal: React.FC<DriverAdvanceModalProps> = ({
  visible,
  onClose,
  balances,
  formatCurrency,
  selectedDriverId,
  onSelectDriver,
  onRefreshDashboard,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEFICIT' | 'SURPLUS' | 'SETTLED'>('ALL');
  const [activityTab, setActivityTab] = useState<'ALL' | 'TRIPS' | 'ADVANCES' | 'SETTLEMENTS'>('ALL');

  // Statement data for selected driver
  const [statement, setStatement] = useState<any | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'share' | 'print' | null>(null);

  // Settlement payment modal state
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [advanceSourceOpen, setAdvanceSourceOpen] = useState<'MANAGER' | 'OWNER' | null>(null);

  const activeDefault = balances.find((b) => b.total_advance_given > 0 || b.total_expenses > 0) ?? balances[0];
  const currentDriver = (selectedDriverId ? balances.find((b) => b.driver_id === selectedDriverId) : null) ?? activeDefault;

  // Load statement whenever currentDriver or visible changes
  const loadStatement = useCallback(async (driverId: number) => {
    try {
      setLoadingStatement(true);
      const res = await mobileDriverAdvanceService.getDriverStatement(driverId);
      if (res.data) {
        setStatement(res.data);
      }
    } catch (err) {
      console.error('Error fetching driver statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  }, []);

  useEffect(() => {
    if (visible && currentDriver?.driver_id) {
      setAdvanceSourceOpen(null);
      loadStatement(currentDriver.driver_id);
    }
  }, [visible, currentDriver?.driver_id, loadStatement]);

  // Derived financials (prefer statement data if loaded, fallback to balances item)
  const isDeficit = statement ? statement.summary.is_deficit : (currentDriver && currentDriver.balance_in_manager_hand < 0);
  const isSurplus = statement ? statement.summary.is_surplus : (currentDriver && currentDriver.balance_in_manager_hand > 0);
  const isSettled = statement ? statement.summary.is_settled : (currentDriver && Math.abs(currentDriver.balance_in_manager_hand) < 1);

  const deficitAmount = statement
    ? statement.summary.deficit_amount
    : (currentDriver && currentDriver.balance_in_manager_hand < 0 ? Math.abs(currentDriver.balance_in_manager_hand) : 0);

  const surplusAmount = statement
    ? statement.summary.surplus_amount
    : (currentDriver && currentDriver.balance_in_manager_hand > 0 ? currentDriver.balance_in_manager_hand : 0);

  const totalAdv = statement ? statement.summary.total_advance_given : (currentDriver?.total_advance_given || 0);
  const totalExp = statement ? statement.summary.total_expenses : (currentDriver?.total_expenses || 0);
  const totalSettledPaid = statement ? statement.summary.total_settled_cash_paid : 0;
  const managerAdvTotal = statement?.summary?.manager_advance_total ?? null;
  const ownerAdvTotal = statement?.summary?.owner_advance_total ?? null;
  const advancesGroupedByGiver = (isOwner: boolean) => {
    const groups = new Map<string, { name: string; total: number; items: any[] }>();
    for (const item of statement?.timeline || []) {
      if (item.type !== 'ADVANCE') continue;
      if ((item.given_by_role === 'Owner') !== isOwner) continue;
      const name = String(item.given_by_name || (isOwner ? 'Owner' : 'Manager')).trim() || (isOwner ? 'Owner' : 'Manager');
      const existing = groups.get(name) || { name, total: 0, items: [] };
      existing.total += parseFloat(String(item.amount)) || 0;
      existing.items.push(item);
      groups.set(name, existing);
    }
    return Array.from(groups.values());
  };

  // Filter drivers for selector list
  const filteredDrivers = balances.filter((b) => {
    const matchesSearch =
      b.driver_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.driver_mobile ?? '').includes(search);
    if (!matchesSearch) return false;

    if (statusFilter === 'DEFICIT') return b.balance_in_manager_hand < 0;
    if (statusFilter === 'SURPLUS') return b.balance_in_manager_hand > 0;
    if (statusFilter === 'SETTLED') return Math.abs(b.balance_in_manager_hand) < 1;
    return true;
  });

  const tripStories = buildDriverTripStories(statement?.timeline || []).filter((story) => {
    if (activityTab === 'TRIPS') return story.kind === 'TRIP';
    if (activityTab === 'ADVANCES') return story.advances.length > 0;
    if (activityTab === 'SETTLEMENTS') return story.settlements.length > 0;
    return true;
  });

  // Export handlers: PDF, Print, Share
  const handlePrint = async () => {
    if (!currentDriver) return;
    try {
      setExportLoading('print');
      const docData = {
        driver: statement?.driver || { id: currentDriver.driver_id, name: currentDriver.driver_name, mobile_number: currentDriver.driver_mobile },
        summary: statement?.summary || {
          total_advance_given: totalAdv,
          total_expenses: totalExp,
          total_settled_cash_paid: totalSettledPaid,
          balance_in_manager_hand: currentDriver.balance_in_manager_hand,
          is_deficit: isDeficit,
          is_surplus: isSurplus,
          is_settled: isSettled,
          deficit_amount: deficitAmount,
          surplus_amount: surplusAmount,
        },
        timeline: statement?.timeline || [],
        dateRangeText: 'Complete Statement',
      };
      await printDriverStatementPdf(docData);
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print driver statement.');
    } finally {
      setExportLoading(null);
    }
  };

  const handlePdf = async () => {
    if (!currentDriver) return;
    try {
      setExportLoading('pdf');
      const docData = {
        driver: statement?.driver || { id: currentDriver.driver_id, name: currentDriver.driver_name, mobile_number: currentDriver.driver_mobile },
        summary: statement?.summary || {
          total_advance_given: totalAdv,
          total_expenses: totalExp,
          total_settled_cash_paid: totalSettledPaid,
          balance_in_manager_hand: currentDriver.balance_in_manager_hand,
          is_deficit: isDeficit,
          is_surplus: isSurplus,
          is_settled: isSettled,
          deficit_amount: deficitAmount,
          surplus_amount: surplusAmount,
        },
        timeline: statement?.timeline || [],
        dateRangeText: 'Complete Statement',
      };
      const res = await downloadDriverStatementPdf(docData);
      if (res.savedDirectly) {
        Alert.alert('Saved', `Driver statement PDF saved as ${res.filename}`);
      }
    } catch (err: any) {
      Alert.alert('PDF Export Error', err?.message || 'Could not export driver statement PDF.');
    } finally {
      setExportLoading(null);
    }
  };

  const handleShare = async () => {
    if (!currentDriver) return;
    try {
      setExportLoading('share');
      const docData = {
        driver: statement?.driver || { id: currentDriver.driver_id, name: currentDriver.driver_name, mobile_number: currentDriver.driver_mobile },
        summary: statement?.summary || {
          total_advance_given: totalAdv,
          total_expenses: totalExp,
          total_settled_cash_paid: totalSettledPaid,
          balance_in_manager_hand: currentDriver.balance_in_manager_hand,
          is_deficit: isDeficit,
          is_surplus: isSurplus,
          is_settled: isSettled,
          deficit_amount: deficitAmount,
          surplus_amount: surplusAmount,
        },
        timeline: statement?.timeline || [],
        dateRangeText: 'Complete Statement',
      };
      await shareDriverStatementPdf(docData);
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Could not share driver statement.');
    } finally {
      setExportLoading(null);
    }
  };
  const handleExcel = handleShare;

  // Settle driver balance (Admin only)
  const handleConfirmSettle = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators have authority to settle driver balance payments.');
      return;
    }
    if (!currentDriver) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid settlement amount.');
      return;
    }

    try {
      setIsSubmittingPay(true);
      await mobileSettlementService.settleDriverBalance(currentDriver.driver_id, {
        paid_amount: amt,
        payment_mode: paymentMode,
        notes: payNotes || 'Balance settled by admin via mobile app',
        payment_date: new Date().toISOString(),
      });

      Alert.alert(
        'Payment Settled ✓',
        `₹${amt.toLocaleString('en-IN')} successfully settled with driver ${currentDriver.driver_name}.`
      );
      setPayModalVisible(false);
      setPayNotes('');

      // Reload statement and home dashboard
      await loadStatement(currentDriver.driver_id);
      if (onRefreshDashboard) onRefreshDashboard();
    } catch (err: any) {
      Alert.alert('Settlement Failed', err?.response?.data?.message || err?.message || 'Could not record settlement.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={{ height: '92%' }}>
      {/* Header */}
      <View style={mStyles.sheetHeader}>
        <View style={mStyles.advHeaderLeft}>
          <View style={[mStyles.advIconCircle, { backgroundColor: '#f3e8ff' }]}>
            <Wallet size={20} color="#7c3aed" />
          </View>
          <View>
            <Text style={mStyles.advTitle}>Driver Advance & Balance</Text>
            <Text style={mStyles.advSubtitle}>Advances, expenses & settlement history</Text>
          </View>
        </View>
        <TouchableOpacity
          style={mStyles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick Driver Selector Chips (Horizontal Scroll) */}
        <View style={{ marginBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {balances.map((b) => {
              const isSelected = currentDriver?.driver_id === b.driver_id;
              const hasDeficit = b.balance_in_manager_hand < 0;
              const hasSurplus = b.balance_in_manager_hand > 0;

              return (
                <TouchableOpacity
                  key={b.driver_id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: isSelected ? '#7c3aed' : '#f1f5f9',
                    borderWidth: 1.5,
                    borderColor: isSelected ? '#7c3aed' : hasDeficit ? '#fca5a5' : '#e2e8f0',
                  }}
                  onPress={() => onSelectDriver(b.driver_id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isSelected
                        ? '#ffffff'
                        : hasDeficit
                        ? '#dc2626'
                        : hasSurplus
                        ? '#16a34a'
                        : '#94a3b8',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isSelected ? '#ffffff' : COLORS.primary,
                    }}
                  >
                    {b.driver_name}
                  </Text>
                  {hasDeficit && !isSelected && (
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#dc2626' }}>
                      ({isAdmin ? 'Pay ' : 'Due '}₹{Math.abs(Math.round(b.balance_in_manager_hand)).toLocaleString('en-IN')})
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Driver Detailed Breakdown Card */}
        {currentDriver && (
          <View style={[
            mStyles.driverCardContainer,
            isDeficit && { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
          ]}>
            {/* Top row: Avatar + Name + Status Tag */}
            <View style={mStyles.driverCardTop}>
              <View style={[mStyles.driverAvatar, isDeficit && { backgroundColor: '#fee2e2' }]}>
                <User size={18} color={isDeficit ? '#dc2626' : '#7c3aed'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[mStyles.driverCardName, isDeficit && { color: '#991b1b' }]}>
                  {currentDriver.driver_name}
                </Text>
                {currentDriver.driver_mobile ? (
                  <Text style={mStyles.driverCardMobile}>{currentDriver.driver_mobile}</Text>
                ) : null}
              </View>
              {loadingStatement ? (
                <ActivityIndicator size="small" color="#7c3aed" />
              ) : isDeficit ? (
                <View style={mStyles.statusTagDeficit}>
                  <Text style={mStyles.statusTagDeficitText}>Need to Pay</Text>
                </View>
              ) : isSurplus ? (
                <View style={mStyles.statusTagSurplus}>
                  <Text style={mStyles.statusTagSurplusText}>In Hand</Text>
                </View>
              ) : (
                <View style={mStyles.statusTagNeutral}>
                  <Text style={mStyles.statusTagNeutralText}>Settled</Text>
                </View>
              )}
            </View>

            <View style={mStyles.driverStatsGrid}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ede9fe', paddingBottom: 8 }}>
                <View style={[mStyles.driverStatCol, { flex: 1 }]}>
                  <Text style={mStyles.driverStatLabel}>ADVANCE GIVEN</Text>
                  <Text style={[mStyles.driverStatValueAdvance, { color: '#6d28d9' }]}>
                    {formatCurrency(totalAdv)}
                  </Text>
                </View>
                <View style={[mStyles.driverStatCol, { flex: 1, borderLeftWidth: 1, borderLeftColor: '#ede9fe' }]}>
                  <Text style={mStyles.driverStatLabel}>TRIP EXPENSES</Text>
                  <Text style={mStyles.driverStatValueExpense}>
                    {formatCurrency(totalExp)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', paddingTop: 8 }}>
                <View style={[mStyles.driverStatCol, { flex: 1 }]}>
                  <Text style={mStyles.driverStatLabel}>NEED TO PAY</Text>
                  <Text style={[mStyles.driverStatValueExpense, { color: '#dc2626' }]}>
                    {formatCurrency(deficitAmount || 0)}
                  </Text>
                </View>
                <View style={[mStyles.driverStatCol, { flex: 1, borderLeftWidth: 1, borderLeftColor: '#ede9fe' }]}>
                  <Text style={mStyles.driverStatLabel}>BALANCE IN HAND</Text>
                  <Text style={[mStyles.driverStatValueAdvance, { color: '#16a34a' }]}>
                    {formatCurrency(surplusAmount || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {(managerAdvTotal != null || ownerAdvTotal != null) && (
              <>
              <View style={{
                flexDirection: 'row',
                gap: 8,
                marginTop: 10,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#eff6ff',
                    borderWidth: advanceSourceOpen === 'MANAGER' ? 2 : 1,
                    borderColor: advanceSourceOpen === 'MANAGER' ? '#2563eb' : '#bfdbfe',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                  }}
                  onPress={() => setAdvanceSourceOpen((prev) => (prev === 'MANAGER' ? null : 'MANAGER'))}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#1d4ed8', letterSpacing: 0.3 }}>FROM MANAGER</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e40af', marginTop: 4 }}>
                    {formatCurrency(managerAdvTotal || 0)}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#3b82f6', marginTop: 4 }}>
                    {advanceSourceOpen === 'MANAGER' ? 'Tap to hide names' : 'Tap to see manager name'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#f5f3ff',
                    borderWidth: advanceSourceOpen === 'OWNER' ? 2 : 1,
                    borderColor: advanceSourceOpen === 'OWNER' ? '#7c3aed' : '#ddd6fe',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                  }}
                  onPress={() => setAdvanceSourceOpen((prev) => (prev === 'OWNER' ? null : 'OWNER'))}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#6d28d9', letterSpacing: 0.3 }}>FROM OWNER</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#5b21b6', marginTop: 4 }}>
                    {formatCurrency(ownerAdvTotal || 0)}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#8b5cf6', marginTop: 4 }}>
                    {advanceSourceOpen === 'OWNER' ? 'Tap to hide names' : 'Tap to see owner name'}
                  </Text>
                </TouchableOpacity>
              </View>

              {advanceSourceOpen && (
                <View style={{
                  marginTop: 8,
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: advanceSourceOpen === 'OWNER' ? '#ddd6fe' : '#bfdbfe',
                  borderRadius: 10,
                  padding: 10,
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: advanceSourceOpen === 'OWNER' ? '#6d28d9' : '#1d4ed8',
                    marginBottom: 8,
                    letterSpacing: 0.3,
                  }}>
                    {advanceSourceOpen === 'OWNER' ? 'OWNER ADVANCE DETAILS' : 'MANAGER ADVANCE DETAILS'}
                  </Text>
                  {advancesGroupedByGiver(advanceSourceOpen === 'OWNER').length === 0 ? (
                    <Text style={{ fontSize: 12, color: '#64748b' }}>No advances from this source.</Text>
                  ) : (
                    advancesGroupedByGiver(advanceSourceOpen === 'OWNER').map((group) => (
                      <View key={group.name} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary, flex: 1, marginRight: 8 }}>
                            {group.name}
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: advanceSourceOpen === 'OWNER' ? '#6d28d9' : '#1d4ed8' }}>
                            {formatCurrency(group.total)}
                          </Text>
                        </View>
                        {group.items.map((item: any, idx: number) => (
                          <View
                            key={`${item.id}-${idx}`}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              paddingVertical: 5,
                              paddingLeft: 8,
                              borderLeftWidth: 2,
                              borderLeftColor: advanceSourceOpen === 'OWNER' ? '#c4b5fd' : '#93c5fd',
                              marginBottom: 2,
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 11, color: '#334155', fontWeight: '600' }}>
                                {item.date ? formatDateDMY(item.date) : '—'}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                {item.subtitle || item.given_for || item.title}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>
                              {formatCurrency(item.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              )}
              </>
            )}

            {/* Net Balance Result Banner with distinct RED / GREEN color modules */}
            {isDeficit ? (
              <View style={mStyles.balanceResultBoxDeficit}>
                <View style={mStyles.balanceResultTitleRow}>
                  <AlertCircle size={22} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.balanceResultTitleDeficit}>
                      BALANCE NEED TO PAY TO DRIVER
                    </Text>
                    <Text style={mStyles.balanceResultAmountDeficit}>
                      {formatCurrency(deficitAmount)}
                    </Text>
                  </View>
                </View>
                <Text style={mStyles.balanceResultNoteDeficit}>
                  Trip expenses ({formatCurrency(totalExp)}) exceeded advances ({formatCurrency(totalAdv)}). {isAdmin ? `You can settle ${formatCurrency(deficitAmount)} with ${currentDriver.driver_name}.` : `Admin / Head Office will settle ${formatCurrency(deficitAmount)} with ${currentDriver.driver_name}.`}
                </Text>

                {/* Direct Pay Balance Action Button (ADMIN ONLY) */}
                {isAdmin ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#dc2626',
                      borderRadius: RADIUS.md,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 10,
                      ...SHADOWS.sm,
                    }}
                    onPress={() => {
                      setPayAmount(String(Math.round(deficitAmount)));
                      setPayModalVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <HandCoins size={18} color="#ffffff" />
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 }}>
                      PAY {formatCurrency(deficitAmount)} TO DRIVER
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{
                    backgroundColor: '#fee2e2',
                    borderColor: '#fca5a5',
                    borderWidth: 1,
                    borderRadius: RADIUS.md,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                  }}>
                    <AlertCircle size={16} color="#dc2626" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#991b1b', flex: 1 }}>
                      Payment authorized for Admin only. Office will settle this balance.
                    </Text>
                  </View>
                )}
              </View>
            ) : isSurplus ? (
              <View style={mStyles.balanceResultBoxSurplus}>
                <View style={mStyles.balanceResultTitleRow}>
                  <CheckCircle2 size={22} color="#16a34a" />
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.balanceResultTitleSurplus}>
                      REMAINING ADVANCE IN DRIVER HAND
                    </Text>
                    <Text style={mStyles.balanceResultAmountSurplus}>
                      {formatCurrency(surplusAmount)}
                    </Text>
                  </View>
                </View>
                <Text style={mStyles.balanceResultNoteSurplus}>
                  Advance given ({formatCurrency(totalAdv)}) was more than trip expenses ({formatCurrency(totalExp)}). {formatCurrency(surplusAmount)} balance remains in driver's hand for subsequent trips.
                </Text>
              </View>
            ) : (
              <View style={mStyles.balanceResultBoxNeutral}>
                <View style={mStyles.balanceResultTitleRow}>
                  <CheckCircle2 size={22} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.balanceResultTitleNeutral}>✓ ALL BALANCES FULLY SETTLED</Text>
                    <Text style={mStyles.balanceResultAmountNeutral}>₹0</Text>
                  </View>
                </View>
                <Text style={mStyles.balanceResultNoteNeutral}>
                  Advances received, trip expenses, and settlement payments are completely balanced.
                </Text>
              </View>
            )}

            {/* Export Toolbar: PDF, Share, Print */}
            <View style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#e2e8f0',
            }}>
              {/* PDF Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#dc2626',
                  borderRadius: RADIUS.md,
                  paddingVertical: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: exportLoading === 'pdf' ? 0.7 : 1,
                }}
                onPress={handlePdf}
                disabled={exportLoading !== null}
                activeOpacity={0.8}
              >
                {exportLoading === 'pdf' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FileText size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Share Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#16a34a',
                  borderRadius: RADIUS.md,
                  paddingVertical: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: exportLoading === 'share' ? 0.7 : 1,
                }}
                onPress={handleShare}
                disabled={exportLoading !== null}
                activeOpacity={0.8}
              >
                {exportLoading === 'share' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Share2 size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>SHARE</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Print Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: COLORS.primary,
                  borderRadius: RADIUS.md,
                  paddingVertical: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: exportLoading === 'print' ? 0.7 : 1,
                }}
                onPress={handlePrint}
                disabled={exportLoading !== null}
                activeOpacity={0.8}
              >
                {exportLoading === 'print' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Printer size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>PRINT</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Activity & Breakdown Section Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
          <Text style={mStyles.sectionLabel}>
            TRIP STORY HISTORY ({tripStories.length})
          </Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            onPress={() => currentDriver && loadStatement(currentDriver.driver_id)}
          >
            <RefreshCw size={12} color="#7c3aed" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#7c3aed' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Category Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {(['ALL', 'TRIPS', 'ADVANCES', 'SETTLEMENTS'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: activityTab === tab ? '#7c3aed' : '#f1f5f9',
              }}
              onPress={() => setActivityTab(tab)}
            >
              <Text style={{
                fontSize: 10,
                fontWeight: '800',
                color: activityTab === tab ? '#ffffff' : '#64748b',
                textTransform: 'uppercase',
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Timeline Items List */}
        {loadingStatement ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#7c3aed" />
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Loading driver ledger...</Text>
          </View>
        ) : tripStories.length === 0 ? (
          <View style={mStyles.emptyBox}>
            <FileText size={24} color={COLORS.textMuted} />
            <Text style={mStyles.emptyText}>No activity recorded in this category</Text>
          </View>
        ) : (
          tripStories.map((story, storyIdx) => {
            const workingCash = (story.totalAdvance || 0) + (story.broughtForward || 0);
            const calcNeed = Math.max(0, (story.totalExpenses || 0) - workingCash);
            const calcHand = Math.max(0, workingCash - (story.totalExpenses || 0));
            const resultColor = calcNeed > 0 ? '#dc2626' : calcHand > 0 ? '#16a34a' : '#64748b';
            const resultLabel = calcNeed > 0 ? 'NEED TO PAY' : calcHand > 0 ? 'BALANCE IN HAND' : 'BALANCED';
            const resultAmt = calcNeed > 0 ? calcNeed : calcHand;
            return (
              <View
                key={story.key}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: RADIUS.md,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: story.kind === 'DIRECT_ADVANCE' ? '#ddd6fe' : '#cbd5e1',
                  borderLeftWidth: 4,
                  borderLeftColor: story.needToPay > 0 ? '#dc2626' : story.settlements.length ? '#16a34a' : '#2563eb',
                  ...SHADOWS.sm,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>
                  {story.kind === 'DIRECT_ADVANCE'
                    ? `Direct Advance · ${story.date ? formatDateDMY(story.date) : ''}`
                    : `Trip ${tripStories.slice(0, storyIdx + 1).filter((s) => s.kind === 'TRIP').length}${story.tripId ? `  ·  #${story.tripId}` : ''}${story.date ? `  ·  ${formatDateDMY(story.date)}` : ''}`}
                </Text>
                {story.kind === 'TRIP' ? (
                  <View style={{ marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6 }}>
                    {[
                      ['Party', story.partyName],
                      ['Truck No', story.lorry],
                      ['Owner', story.ownerName],
                      ['Route', story.route ? story.route.replace(/→/g, 'to') : ''],
                    ].filter(([, val]) => !!val).map(([label, val]) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 }}>
                        <Text style={{ width: 72, fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{label}</Text>
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{val}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ marginTop: 10, gap: 8 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#1d4ed8' }}>1. ADVANCE GIVEN</Text>
                    {story.advances.length === 0 ? (
                      <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>No advance recorded</Text>
                    ) : (
                      story.advances.map((adv: any, i: number) => (
                        <View key={`${adv.id}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                          <Text style={{ fontSize: 12, color: '#334155', flex: 1, marginRight: 8 }}>
                            {adv.given_by_role === 'Owner' ? 'Owner' : 'Manager'}: {adv.given_by_name || (adv.given_by_role === 'Owner' ? 'Owner' : 'Manager')}
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e40af' }}>{formatCurrency(adv.amount)}</Text>
                        </View>
                      ))
                    )}
                    {story.advances.length > 1 ? (
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e3a8a', marginTop: 4, textAlign: 'right' }}>
                        Total advance {formatCurrency(story.totalAdvance)}
                      </Text>
                    ) : null}
                  </View>

                  {story.kind === 'TRIP' ? (
                    <>
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#c2410c' }}>2. TRIP EXPENSES</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#9a3412', marginTop: 2 }}>
                          {formatCurrency(story.totalExpenses)}
                        </Text>
                      </View>

                      <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>3. CALCULATION</Text>
                        {story.broughtForward > 0 ? (
                          <Text style={{ fontSize: 11, color: '#047857', marginTop: 3, fontWeight: '700' }}>
                            Balance in hand brought {formatCurrency(story.broughtForward)}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                          {story.broughtForward > 0 ? 'In hand + ' : ''}Advance {formatCurrency(story.totalAdvance)}  −  Expenses {formatCurrency(story.totalExpenses)}
                        </Text>
                        {story.inHandUsed > 0 ? (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309', marginTop: 3 }}>
                            Balance in hand used {formatCurrency(story.inHandUsed)}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: resultColor }}>{resultLabel}</Text>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: resultColor }}>{formatCurrency(resultAmt)}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}

                  {(() => {
                    const br = getSettlementBreakdown(story);
                    const cm = br.cashMovement;
                    const laterPays = br.laterPays || [];
                    if (!br.happened && br.stillToPay <= 0 && br.remainingInHand <= 0) return null;
                    return (
                      <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803d' }}>4. SETTLEMENT / ADJUSTMENT</Text>
                        {laterPays.map((pay, pi) => (
                          <View key={`later-${pi}`} style={{ marginTop: 6 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#6d28d9', flex: 1, marginRight: 8 }}>{pay.sourceLabel}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#6d28d9' }}>{formatCurrency(pay.totalGiven)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                              <Text style={{ fontSize: 12, color: '#166534' }}>Pay to driver (this trip due)</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>{formatCurrency(pay.thisTripPaid)}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                              {formatCurrency(pay.totalGiven)} − {formatCurrency(pay.thisTripPaid)}
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>Balance in hand</Text>
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857' }}>{formatCurrency(pay.leftoverInHand)}</Text>
                            </View>
                          </View>
                        ))}
                        {cm ? (
                          <View style={{ marginTop: 6 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#6d28d9', flex: 1, marginRight: 8 }}>{cm.sourceLabel} total</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#6d28d9' }}>{formatCurrency(cm.totalGiven)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                              <Text style={{ fontSize: 12, color: '#166534' }}>Reduced previous trip due</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>{formatCurrency(cm.reducedDue)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                              <Text style={{ fontSize: 12, color: '#047857' }}>Balance in hand after this</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#047857' }}>{formatCurrency(cm.leftInHand)}</Text>
                            </View>
                          </View>
                        ) : null}
                        {laterPays.length === 0 && !cm ? br.sources.map((src, si) => (
                          <View key={`${src.tripId || 'src'}-${si}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ fontSize: 12, color: '#166534', flex: 1, marginRight: 8 }}>Adjusted leftover from {src.label}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>{formatCurrency(src.amount)}</Text>
                          </View>
                        )) : null}
                        {laterPays.length === 0 && !cm && br.sources.length === 0 && br.adjusted > 0 ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ fontSize: 12, color: '#166534' }}>Adjusted leftover</Text>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>{formatCurrency(br.adjusted)}</Text>
                          </View>
                        ) : null}
                        {br.appliedTo.map((row, ri) => (
                          <Text key={`${row.tripId || 'to'}-${ri}`} style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                            {ri + 1}. Adjusted {row.label}: {formatCurrency(row.amount)}
                            {row.remainingOnThatTrip > 0 ? ` · still ${formatCurrency(row.remainingOnThatTrip)}` : ' · fully settled'}
                          </Text>
                        ))}
                        {br.stillToPay > 0 ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#b91c1c' }}>Still to pay</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#b91c1c' }}>{formatCurrency(br.stillToPay)}</Text>
                          </View>
                        ) : laterPays.length === 0 ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>Balance in hand</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857' }}>{formatCurrency(br.remainingInHand)}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })()}
                </View>
              </View>
            );
          })
        )}

        {/* Driver Selection & Filters */}
        <View style={{ marginTop: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={mStyles.sectionLabel}>
            ALL DRIVERS ({filteredDrivers.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {(['ALL', 'DEFICIT', 'SURPLUS', 'SETTLED'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: statusFilter === filter ? '#7c3aed' : '#f1f5f9',
                }}
                onPress={() => setStatusFilter(filter)}
              >
                <Text style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: statusFilter === filter ? '#ffffff' : '#64748b',
                }}>
                  {filter === 'DEFICIT' ? 'Need to Pay' : filter === 'SURPLUS' ? 'In Hand' : filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search Bar */}
        <View style={mStyles.driverSearchBox}>
          <Search size={16} color={COLORS.textMuted} />
          <TextInput
            style={mStyles.driverSearchInput}
            placeholder="Search driver by name or mobile..."
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

        {/* Driver List for quick selection */}
        {filteredDrivers.length === 0 ? (
          <View style={mStyles.emptyBox}>
            <User size={28} color={COLORS.textMuted} />
            <Text style={mStyles.emptyText}>No matching drivers found</Text>
          </View>
        ) : (
          filteredDrivers.map((b) => {
            const isSelected = currentDriver?.driver_id === b.driver_id;
            const bDeficit = b.balance_in_manager_hand < 0;
            const bSurplus = b.balance_in_manager_hand > 0;
            return (
              <TouchableOpacity
                key={b.driver_id}
                style={[
                  mStyles.driverListItem,
                  isSelected && mStyles.driverListItemActive,
                  bDeficit && !isSelected && { borderColor: '#fecdd3' },
                ]}
                onPress={() => onSelectDriver(b.driver_id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[mStyles.driverItemName, isSelected && { color: '#7c3aed' }]}>
                      {b.driver_name}
                    </Text>
                    {isSelected && (
                      <View style={mStyles.selectedBadge}>
                        <Text style={mStyles.selectedBadgeText}>Selected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={mStyles.driverItemSub}>
                    Adv: {formatCurrency(b.total_advance_given)}  ·  Exp: {formatCurrency(b.total_expenses)}
                  </Text>
                </View>

                {bDeficit ? (
                  <View style={mStyles.badgeDeficit}>
                    <Text style={mStyles.badgeDeficitText}>
                      {isAdmin ? 'Pay ' : 'Due '} {formatCurrency(Math.abs(b.balance_in_manager_hand))}
                    </Text>
                  </View>
                ) : bSurplus ? (
                  <View style={mStyles.badgeSurplus}>
                    <Text style={mStyles.badgeSurplusText}>
                      {formatCurrency(b.balance_in_manager_hand)} in hand
                    </Text>
                  </View>
                ) : (
                  <View style={mStyles.badgeNeutral}>
                    <Text style={mStyles.badgeNeutralText}>₹0</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Settle Driver Balance Modal (Admin Only) ── */}
      {isAdmin && (
        <Modal
          visible={payModalVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setPayModalVisible(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={() => !isSubmittingPay && setPayModalVisible(false)}
          >
            <Pressable
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 24,
                paddingBottom: 36,
              }}
              onPress={() => {}}
            >
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 8 }}>
                    <HandCoins size={20} color="#dc2626" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b' }}>Settle Driver Balance</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{currentDriver?.driver_name}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setPayModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Amount Banner */}
              <View style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc2626', marginBottom: 4 }}>DEFICIT BALANCE DUE</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#dc2626' }}>{formatCurrency(deficitAmount)}</Text>
                <Text style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
                  Trip expenses exceeded advances given by manager
                </Text>
              </View>

              {/* Amount Input */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>PAYMENT AMOUNT (₹)</Text>
              <TextInput
                style={{
                  borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 18,
                  fontWeight: '700', color: '#1e293b', marginBottom: 14,
                  backgroundColor: '#f8fafc',
                }}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
              />

              {/* Payment Mode */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 }}>PAYMENT MODE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                      backgroundColor: paymentMode === mode ? '#dc2626' : '#f1f5f9',
                      borderWidth: 1.5, borderColor: paymentMode === mode ? '#dc2626' : '#e2e8f0',
                    }}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: paymentMode === mode ? '#fff' : '#64748b' }}>
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>NOTES (optional)</Text>
              <TextInput
                style={{
                  borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 8, fontSize: 13,
                  color: '#1e293b', marginBottom: 20, backgroundColor: '#f8fafc', minHeight: 60,
                  textAlignVertical: 'top',
                }}
                value={payNotes}
                onChangeText={setPayNotes}
                placeholder="e.g. Paid in cash after trips settlement"
                multiline
              />

              {/* Confirm Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: isSubmittingPay ? '#9ca3af' : '#dc2626',
                  borderRadius: 12, height: 52, alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'row', gap: 8,
                }}
                onPress={handleConfirmSettle}
                disabled={isSubmittingPay}
                activeOpacity={0.85}
              >
                {isSubmittingPay ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                      CONFIRM PAYMENT — {formatCurrency(parseFloat(payAmount) || deficitAmount)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </BottomSheet>
  );
};


/* ─────────────────────────────────────────────────────────────
   Recent Trips Modal (List + Read-Only Trip Details)
───────────────────────────────────────────────────────────── */
interface RecentTripsModalProps {
  visible: boolean;
  onClose: () => void;
  trips: Trip[];
  formatCurrency: (v: number | string) => string;
  getStatusStyle: (s: string) => { bg: string; text: string };
  initialTrip?: Trip | null;
}
const RecentTripsModal: React.FC<RecentTripsModalProps> = ({
  visible, onClose, trips, formatCurrency, getStatusStyle, initialTrip,
}) => {
  const { user } = useAuth();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [actionLoading, setActionLoading] = useState<'download' | 'share' | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialTrip) {
        setSelectedTrip(initialTrip);
      }
    } else {
      setSelectedTrip(null);
    }
  }, [visible, initialTrip]);

  const handleClose = () => {
    setSelectedTrip(null);
    onClose();
  };

  const handleRequestClose = () => {
    if (selectedTrip) {
      setSelectedTrip(null);
    } else {
      handleClose();
    }
  };

  const handleShareTrip = async (trip: Trip) => {
    try {
      setActionLoading('share');
      await shareTripPdf(trip);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share trip details PDF.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadTrip = async (trip: Trip) => {
    try {
      setActionLoading('download');
      const result = await downloadTripPdf(trip);
      if (result.savedDirectly) {
        Alert.alert(
          'Download Successful! 📥',
          `Trip Challan PDF has been downloaded directly to your device storage:\n\n${result.filename}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'File Ready! 📥',
          `Trip Challan PDF is ready on your device:\n${result.filename}`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Unable to download trip details PDF.');
    } finally {
      setActionLoading(null);
    }
  };

  const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <View style={mStyles.detailRow}>
      <Text style={mStyles.detailLabel}>{label}</Text>
      <Text style={[mStyles.detailValue, accent ? { color: COLORS.accent, fontWeight: '800' } : {}]}>
        {value}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={mStyles.modalOverlay}>
        {/* Backdrop tap to dismiss */}
        <TouchableOpacity
          style={mStyles.backdropTouch}
          activeOpacity={1}
          onPress={handleClose}
        />
        {/* Sheet container */}
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />

          {selectedTrip ? (
            /* ── VIEW 2: Trip Detail (Read-Only) ── */
            <>
              {/* Header with Back, Share, and Close */}
              <View style={mStyles.sheetHeader}>
                <TouchableOpacity
                  style={mStyles.backBtn}
                  onPress={() => setSelectedTrip(null)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ChevronLeft size={20} color={COLORS.primary} />
                  <Text style={mStyles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <Text style={mStyles.sheetTitleCenter}>Trip Details</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={mStyles.headerActionBtn}
                    onPress={() => handleShareTrip(selectedTrip)}
                    disabled={actionLoading !== null}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {actionLoading === 'share' ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : (
                      <Share2 size={17} color={COLORS.accent} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={mStyles.closeBtn}
                    onPress={handleClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unit Banner */}
              <View style={mStyles.detailRouteBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <MapPin size={16} color={COLORS.accent} />
                  <Text style={mStyles.detailRouteText} numberOfLines={1}>
                    {selectedTrip.to_location || `${selectedTrip.from_location} → ${selectedTrip.to_location}`}
                  </Text>
                </View>
                <View style={[mStyles.statusPill, { backgroundColor: getStatusStyle(selectedTrip.status).bg }]}>
                  <Text style={[mStyles.statusText, { color: getStatusStyle(selectedTrip.status).text }]}>
                    {selectedTrip.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>

              {/* Content */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View style={mStyles.section}>
                  <Text style={mStyles.sectionLabel}>TRIP INFO</Text>
                  <Row label="Party" value={selectedTrip.party_name || '—'} />
                  <Row label="Unit" value={selectedTrip.to_location || selectedTrip.from_location || '—'} />
                  <Row label="Lorry Number" value={selectedTrip.lorry_number || '—'} />
                  <Row label="Trip Date" value={formatDateDMY(selectedTrip.trip_date)} />
                  {selectedTrip.driver_name ? (
                    <Row label="Driver" value={selectedTrip.driver_name} />
                  ) : null}
                  <Row
                    label="Goods Weight"
                    value={
                      selectedTrip.goods_weight
                        ? `${selectedTrip.goods_weight} ${selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}`
                        : '—'
                    }
                    accent
                  />
                  {selectedTrip.freight_rate ? (
                    <Row
                      label="Freight Rate"
                      value={`₹${parseFloat(String(selectedTrip.freight_rate)).toLocaleString('en-IN')}/${selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}`}
                    />
                  ) : null}
                </View>

                <View style={mStyles.section}>
                  <Text style={mStyles.sectionLabel}>FINANCIALS</Text>
                  <Row label="Total Freight" value={formatCurrency(selectedTrip.total_freight)} accent />
                  {selectedTrip.advance_paid != null && selectedTrip.advance_paid > 0 && (
                    <Row label="Driver Advance" value={formatCurrency(selectedTrip.advance_paid)} />
                  )}
                  {user?.role === 'ADMIN' && (
                    <>
                      {selectedTrip.total_received != null && (
                        <Row label="Amount Received" value={formatCurrency(selectedTrip.total_received)} />
                      )}
                      <Row
                        label="Balance Due"
                        value={formatCurrency(
                          selectedTrip.balance_due ??
                            Math.max(0, (selectedTrip.total_freight || 0) - (selectedTrip.total_received || 0))
                        )}
                        accent
                      />
                    </>
                  )}
                </View>

                {/* ── Document Actions: Download & Share ── */}
                <View style={mStyles.actionRow}>
                  <TouchableOpacity
                    style={mStyles.downloadSlipBtn}
                    onPress={() => handleDownloadTrip(selectedTrip)}
                    disabled={actionLoading !== null}
                    activeOpacity={0.8}
                  >
                    {actionLoading === 'download' ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Download size={16} color="#ffffff" />
                        <Text style={mStyles.downloadSlipText}>Download Slip</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={mStyles.shareSlipBtn}
                    onPress={() => handleShareTrip(selectedTrip)}
                    disabled={actionLoading !== null}
                    activeOpacity={0.8}
                  >
                    {actionLoading === 'share' ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <>
                        <Share2 size={16} color={COLORS.primary} />
                        <Text style={mStyles.shareSlipText}>Share Slip</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={mStyles.readonlyNotice}>
                  <FileText size={14} color={COLORS.textMuted} />
                  <Text style={mStyles.readonlyText}>View only — contact admin to make changes</Text>
                </View>

                {/* Bottom Back and Close buttons */}
                <View style={mStyles.detailBottomRow}>
                  <TouchableOpacity
                    style={mStyles.backToListBtn}
                    onPress={() => setSelectedTrip(null)}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={16} color={COLORS.primary} />
                    <Text style={mStyles.backToListBtnText}>Back to Trips</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={mStyles.closeDetailBtn}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <X size={16} color="#ffffff" />
                    <Text style={mStyles.closeDetailBtnText}>Close Modal</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          ) : (
            /* ── VIEW 1: Recent Trips List ── */
            <>
              {/* Header */}
              <View style={mStyles.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Clock size={18} color={COLORS.accent} />
                  <Text style={mStyles.sheetTitle}>Recent Trips</Text>
                  {trips.length > 0 && (
                    <View style={mStyles.countBadge}>
                      <Text style={mStyles.countBadgeText}>{trips.length}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={mStyles.closeBtn}
                  onPress={handleClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {trips.length === 0 ? (
                <View style={mStyles.emptyBox}>
                  <Truck size={32} color={COLORS.textMuted} />
                  <Text style={mStyles.emptyText}>No recent trips found</Text>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  {trips.map((trip) => {
                    const st = getStatusStyle(trip.status);
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        style={mStyles.tripListItem}
                        onPress={() => setSelectedTrip(trip)}
                        activeOpacity={0.7}
                      >
                        {/* Route + status */}
                        <View style={mStyles.tripListTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <MapPin size={14} color={COLORS.accent} />
                            <Text style={mStyles.tripListRoute} numberOfLines={1}>
                              {trip.to_location || `${trip.from_location} → ${trip.to_location}`}
                            </Text>
                          </View>
                          <View style={[mStyles.statusPill, { backgroundColor: st.bg }]}>
                            <Text style={[mStyles.statusText, { color: st.text }]}>
                              {trip.status.replace(/_/g, ' ')}
                            </Text>
                          </View>
                        </View>

                        {/* Body */}
                        <View style={mStyles.tripListBody}>
                          <View>
                            <Text style={mStyles.tripListParty}>{trip.party_name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Calendar size={12} color={COLORS.textLight} />
                              <Text style={mStyles.tripListDate}>{formatDateDMY(trip.trip_date)}</Text>
                              <Text style={mStyles.tripListLorry}> · {trip.lorry_number}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={mStyles.tripListFreight}>{formatCurrency(trip.total_freight)}</Text>
                            {user?.role === 'ADMIN' ? (
                              <Text style={mStyles.tripListBalance}>
                                Due: {formatCurrency(
                                  trip.balance_due ??
                                    Math.max(0, (trip.total_freight || 0) - (trip.total_received || 0))
                                )}
                              </Text>
                            ) : trip.advance_paid != null && Number(trip.advance_paid) > 0 ? (
                              <Text style={[mStyles.tripListBalance, { color: '#b45309' }]}>
                                Adv: {formatCurrency(trip.advance_paid)}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Goods Weight Badge Row */}
                        <View style={mStyles.tripWeightBadgeRow}>
                          <View style={mStyles.tripWeightPill}>
                            <Scale size={13} color={COLORS.primary} />
                            <Text style={mStyles.tripWeightLabel}>Weight: </Text>
                            <Text style={mStyles.tripWeightVal}>
                              {trip.goods_weight ? `${trip.goods_weight} ${trip.unit_abbreviation || trip.unit_name || 'Ton'}` : '—'}
                            </Text>
                          </View>
                          {trip.freight_rate ? (
                            <Text style={mStyles.tripFreightRateHint}>
                              Rate: ₹{parseFloat(String(trip.freight_rate)).toLocaleString('en-IN')}/{trip.unit_abbreviation || 'Ton'}
                            </Text>
                          ) : null}
                        </View>

                        {/* Tap hint */}
                        <View style={mStyles.tripListFooter}>
                          <Text style={mStyles.tapToViewText}>Tap to view trip details</Text>
                          <ChevronRight size={13} color={COLORS.accent} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Close modal button at bottom of list */}
                  <TouchableOpacity
                    style={mStyles.modalFooterCloseBtn}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <X size={16} color={COLORS.textMuted} />
                    <Text style={mStyles.modalFooterCloseText}>Close Modal</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main HomeScreen
───────────────────────────────────────────────────────────── */
export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [data, setData] = useState<MobileDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expiringVehicles, setExpiringVehicles] = useState<Vehicle[]>([]);
  const expiryAlertShown = useRef(false);

  // Modal states
  const [advanceModalVisible, setAdvanceModalVisible] = useState(false);
  const [tripsModalVisible, setTripsModalVisible] = useState(false);
  const [driverAdvanceModalVisible, setDriverAdvanceModalVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedRecentTrip, setSelectedRecentTrip] = useState<Trip | null>(null);

  // ── Animation Values ──────────────────────────────────────────────────────
  const headerAnim = useRef(new Animated.Value(-16)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const statsScale = useRef(new Animated.Value(0.92)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const alertPulse = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Spring scales for buttons on touch
  const newTripScale = useRef(new Animated.Value(1)).current;
  const truckAdvScale = useRef(new Animated.Value(1)).current;
  const advanceTileScale = useRef(new Animated.Value(1)).current;
  const driverAdvTileScale = useRef(new Animated.Value(1)).current;
  const recentTripsTileScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      loadDashboard();

      // Trigger smooth entry animation on screen focus
      headerAnim.setValue(-16);
      headerOpacity.setValue(0);
      statsScale.setValue(0.92);
      contentTranslateY.setValue(24);
      contentOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerAnim, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
        Animated.spring(statsScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 450, delay: 80, useNativeDriver: true }),
        Animated.spring(contentTranslateY, { toValue: 0, friction: 7, tension: 40, delay: 80, useNativeDriver: true }),
      ]).start();
    }, [])
  );

  useEffect(() => {
    // Pulse animation for live status beacon
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1.35, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1.0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // Pulse animation for alert shield
    const alertLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(alertPulse, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(alertPulse, { toValue: 1.0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    alertLoop.start();

    return () => {
      pulseLoop.stop();
      alertLoop.stop();
    };
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashResult, expResult] = await Promise.allSettled([
        mobileDashboardService.getDashboard(),
        mobileLookupService.getExpiringVehicles(30),
      ]);
      if (dashResult.status === 'fulfilled') {
        setData(dashResult.value.data);
      } else {
        console.error('Failed to load mobile dashboard', dashResult.reason);
      }
      const expRes = expResult.status === 'fulfilled' ? expResult.value : { data: [] };
      const items = (expRes.data || []).filter((v) => getVehicleDocAlerts(v).length > 0);
      setExpiringVehicles(items);
      if (items.length > 0 && !expiryAlertShown.current) {
        expiryAlertShown.current = true;
        const summary = items
          .slice(0, 5)
          .map((v) => {
            const alerts = getVehicleDocAlerts(v);
            return `• ${v.lorry_number}: ${alerts.map((a) => a.name).join(', ')}`;
          })
          .join('\n');
        Alert.alert(
          '⚠️ Truck Documents — Within 30 Days',
          `${items.length} truck(s) have documents expiring soon or expired.\n\n${summary}${
            items.length > 5 ? '\n• …' : ''
          }\n\nPlease inform admin and renew before dispatch.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to load expiring vehicles', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `\u20B9${Math.round(num).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr?: string) => formatDateDMY(dateStr);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'SETTLED':
        return { bg: COLORS.successLight, text: COLORS.successDark };
      case 'PARTIALLY_PAID':
      case 'PAYMENT_PENDING':
        return { bg: COLORS.warningLight, text: COLORS.warningDark };
      case 'CANCELLED':
        return { bg: COLORS.dangerLight, text: COLORS.dangerDark };
      default:
        return { bg: COLORS.infoLight, text: COLORS.info };
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Dashboard...</Text>
      </View>
    );
  }

  const recentTrips: Trip[] = data?.recent_trips ?? [];

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.accent]} />}
      >
        {/* ── Animated Header Card ── */}
        <Animated.View
          style={[
            styles.headerCard,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerAnim }],
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View>
              <View style={styles.liveBeaconBadge}>
                <Animated.View style={[styles.liveBeaconRing, { transform: [{ scale: livePulse }] }]} />
                <View style={styles.liveBeaconDot} />
                <Text style={styles.liveBeaconText}>Operator Online</Text>
              </View>
              <Text style={styles.greetingText}>{getGreeting()},</Text>
              <Text style={styles.userNameText}>{user?.name || 'Operator'}</Text>
              {user?.username ? (
                <Text style={styles.userHandleText}>@{user.username}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.profileBadge} onPress={() => navigation.navigate('Profile')}>
              <User size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.statsRow,
              { transform: [{ scale: statsScale }] },
            ]}
          >
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Trips Today</Text>
              <Text style={styles.statValue}>{data?.trips_today || 0}</Text>
            </View>
            {user?.role === 'ADMIN' ? (
              <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.statLabel}>Balance Due</Text>
                <Text style={[styles.statValue, { color: COLORS.accent }]}>
                  {formatCurrency(data?.balance_due || 0)}
                </Text>
              </View>
            ) : (
              <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.statLabel}>My Recent Trips</Text>
                <Text style={[styles.statValue, { color: COLORS.accent }]}>
                  {recentTrips.length}
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* ── Animated Actions & Details Container ── */}
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          }}
        >
          {/* ── Expiry Alert ── */}
          {expiringVehicles.length > 0 && (
            <View style={styles.expiryBanner}>
              <View style={styles.expiryBannerTop}>
                <Animated.View style={[styles.expiryIconCircle, { transform: [{ scale: alertPulse }] }]}>
                  <ShieldAlert size={20} color="#b45309" />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expiryBannerTitle}>Fleet document alerts (≤ 30 days)</Text>
                  <Text style={styles.expiryBannerSub}>
                    {expiringVehicles.length} truck{expiringVehicles.length === 1 ? '' : 's'} — insurance, permit, yearly tax or RC
                  </Text>
                </View>
              </View>
              {expiringVehicles.slice(0, 4).map((v) => {
                const alerts = getVehicleDocAlerts(v);
                const urgent = alerts[0];
                if (!urgent) return null;
                return (
                  <View key={v.id} style={styles.expiryRow}>
                    <Truck size={14} color="#92400e" />
                    <Text style={styles.expiryLorry}>{v.lorry_number}</Text>
                    <Text style={styles.expiryDoc}>
                      {urgent.isExpired ? `${urgent.name} expired` : `${urgent.name} in ${urgent.days}d`}
                      {alerts.length > 1 ? ` +${alerts.length - 1}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Owner Advance Credit — with touch spring ── */}
          {(data?.owner_advance_credit ?? 0) > 0 && (
            <Animated.View style={{ transform: [{ scale: advanceTileScale }] }}>
              <Pressable
                style={styles.sectionTile}
                onPress={() => setAdvanceModalVisible(true)}
                onPressIn={() => Animated.spring(advanceTileScale, { toValue: 0.97, speed: 50, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(advanceTileScale, { toValue: 1.0, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
              >
                <View style={styles.tileLead}>
                  <View style={styles.tileIconBox}>
                    <HandCoins size={22} color="#15803d" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tileTitle}>Owner Advance Credit</Text>
                    <Text style={styles.tileSub}>
                      Total: {formatCurrency(data?.owner_advance_credit ?? 0)}{'  ·  '}
                      Available: ₹{(data?.manager_available_balance ?? 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                <View style={styles.tileCta}>
                  <Text style={styles.tileCtaText}>View Details</Text>
                  <ChevronRight size={16} color="#16a34a" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Driver Advance & Balance — heading only; details open on tap ── */}
          {(data?.driver_advance_balances ?? []).length > 0 && (
            <Animated.View style={{ transform: [{ scale: driverAdvTileScale }] }}>
              <Pressable
                style={[styles.sectionTile, { borderColor: '#ddd6fe' }]}
                onPress={() => setDriverAdvanceModalVisible(true)}
                onPressIn={() => Animated.spring(driverAdvTileScale, { toValue: 0.97, speed: 50, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(driverAdvTileScale, { toValue: 1.0, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
              >
                <View style={styles.tileLead}>
                  <View style={[styles.tileIconBox, { backgroundColor: '#f3e8ff' }]}>
                    <Wallet size={22} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tileTitle, { color: COLORS.primary }]}>Driver Advance & Balance</Text>
                  </View>
                </View>
                <View style={styles.tileCta}>
                  <ChevronRight size={16} color="#7c3aed" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Give Truck Advance — with touch spring ── */}
          {(data?.manager_available_balance ?? 0) > 0 && (
            <Animated.View style={{ transform: [{ scale: truckAdvScale }] }}>
              <Pressable
                style={styles.truckAdvanceBtn}
                onPress={() => navigation.navigate('GiveTruckAdvance', {
                  availableBalance: data?.manager_available_balance ?? 0,
                })}
                onPressIn={() => Animated.spring(truckAdvScale, { toValue: 0.96, speed: 50, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(truckAdvScale, { toValue: 1.0, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
              >
                <Truck size={20} color={COLORS.white} />
                <Text style={styles.truckAdvanceBtnText}>Give Advance to Truck</Text>
                <ChevronRight size={18} color={COLORS.white} />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Start New Trip — with touch spring ── */}
          <Animated.View style={{ transform: [{ scale: newTripScale }] }}>
            <Pressable
              style={styles.newTripBtn}
              onPress={() => navigation.navigate('NewTrip')}
              onPressIn={() => Animated.spring(newTripScale, { toValue: 0.96, speed: 50, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(newTripScale, { toValue: 1.0, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
            >
              <PlusCircle size={22} color={COLORS.white} />
              <Text style={styles.newTripBtnText}>+ START NEW TRIP</Text>
            </Pressable>
          </Animated.View>

          {/* ── Recent Trips — with touch spring ── */}
          <Animated.View style={{ transform: [{ scale: recentTripsTileScale }] }}>
            <Pressable
              style={[styles.sectionTile, { borderColor: COLORS.border }]}
              onPress={() => {
                setSelectedRecentTrip(null);
                setTripsModalVisible(true);
              }}
              onPressIn={() => Animated.spring(recentTripsTileScale, { toValue: 0.97, speed: 50, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(recentTripsTileScale, { toValue: 1.0, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
            >
              <View style={styles.tileLead}>
                <View style={[styles.tileIconBox, { backgroundColor: COLORS.infoLight }]}>
                  <List size={22} color={COLORS.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tileTitle, { color: COLORS.primary }]}>Recent Trips</Text>
                  <Text style={styles.tileSub}>
                    {recentTrips.length > 0
                      ? `${recentTrips.length} trip${recentTrips.length === 1 ? '' : 's'} — tap to open modal`
                      : 'No trips yet'}
                  </Text>
                </View>
              </View>
              <View style={styles.tileCta}>
                <Text style={[styles.tileCtaText, { color: COLORS.accent }]}>Open Modal</Text>
                <ChevronRight size={16} color={COLORS.accent} />
              </View>
            </Pressable>
          </Animated.View>

          {/* View All link */}
          <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Trips')}>
            <Text style={styles.viewAllText}>View all trips in Trips tab</Text>
            <ChevronRight size={14} color={COLORS.accent} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Advance Modal ── */}
      <AdvanceDetailModal
        visible={advanceModalVisible}
        onClose={() => setAdvanceModalVisible(false)}
        data={data}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />

      {/* ── Recent Trips Modal (List + Read-Only Details) ── */}
      <RecentTripsModal
        visible={tripsModalVisible}
        onClose={() => {
          setTripsModalVisible(false);
          setSelectedRecentTrip(null);
        }}
        trips={recentTrips}
        formatCurrency={formatCurrency}
        getStatusStyle={getStatusStyle}
        initialTrip={selectedRecentTrip}
      />

      {/* ── Driver Advance & Balance Modal ── */}
      <DriverAdvanceModal
        visible={driverAdvanceModalVisible}
        onClose={() => setDriverAdvanceModalVisible(false)}
        balances={data?.driver_advance_balances ?? []}
        formatCurrency={formatCurrency}
        selectedDriverId={selectedDriverId}
        onSelectDriver={(id) => setSelectedDriverId(id)}
        onRefreshDashboard={loadDashboard}
      />
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   Modal Styles
───────────────────────────────────────────────────────────── */
const mStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    ...SHADOWS.lg,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sheetTitleCenter: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  countBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accentDark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRouteText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    flexShrink: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '60%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  downloadSlipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#15803d',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    ...SHADOWS.sm,
  },
  downloadSlipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  shareSlipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  shareSlipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  readonlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: 4,
  },
  readonlyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  // Advance modal
  advHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  advIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532d',
  },
  advSubtitle: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 2,
  },
  advTotalBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  advTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  advTotalAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#15803d',
  },
  advBalanceLabel: {
    fontSize: 12,
    color: '#166534',
    marginTop: 4,
    fontWeight: '500',
  },
  advRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dcfce7',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
  },
  advRowLeft: { flex: 1, marginRight: 10 },
  advOwnerName: { fontSize: 14, fontWeight: '700', color: '#14532d' },
  advDate: { fontSize: 12, color: '#166534', fontWeight: '600' },
  advAmount: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  advNotesText: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noDataText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    fontSize: 14,
  },
  paymentModeBadge: {
    backgroundColor: '#bbf7d0',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  paymentModeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  // Trips list modal
  tripListItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tripListTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tripListRoute: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    flexShrink: 1,
  },
  tripListBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripListParty: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  tripListDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  tripListLorry: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tripListFreight: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tripListBalance: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  tripListFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  tapToViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  tripWeightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripWeightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripWeightLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tripWeightVal: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  tripFreightRateHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modalFooterCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalFooterCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  detailBottomRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
  },
  backToListBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backToListBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  closeDetailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  closeDetailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  // Driver Advance Modal Styles
  driverSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    padding: 0,
  },
  driverCardContainer: {
    backgroundColor: '#faf5ff',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  driverCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4c1d95',
  },
  driverCardMobile: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusTagDeficit: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusTagDeficitText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
    textTransform: 'uppercase',
  },
  statusTagSurplus: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusTagSurplusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
    textTransform: 'uppercase',
  },
  statusTagNeutral: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusTagNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  driverStatsGrid: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#ede9fe',
    paddingVertical: 10,
    marginBottom: SPACING.sm,
  },
  driverStatCol: {
    alignItems: 'center',
  },
  driverStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  driverStatValueAdvance: {
    fontSize: 17,
    fontWeight: '900',
    color: '#059669',
  },
  driverStatValueExpense: {
    fontSize: 17,
    fontWeight: '900',
    color: '#dc2626',
  },
  driverStatSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  balanceResultBoxDeficit: {
    backgroundColor: '#fff1f2',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 12,
  },
  balanceResultBoxSurplus: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
  },
  balanceResultBoxNeutral: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  balanceResultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  balanceResultTitleDeficit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b',
  },
  balanceResultAmountDeficit: {
    fontSize: 20,
    fontWeight: '900',
    color: '#dc2626',
  },
  balanceResultNoteDeficit: {
    fontSize: 11,
    color: '#b91c1c',
    lineHeight: 15,
    marginTop: 2,
  },
  balanceResultTitleSurplus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  balanceResultAmountSurplus: {
    fontSize: 20,
    fontWeight: '900',
    color: '#16a34a',
  },
  balanceResultNoteSurplus: {
    fontSize: 11,
    color: '#15803d',
    lineHeight: 15,
    marginTop: 2,
  },
  balanceResultTitleNeutral: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  balanceResultAmountNeutral: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  balanceResultNoteNeutral: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  driverListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverListItemActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#7c3aed',
  },
  driverItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  driverItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
  },
  badgeDeficit: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeDeficitText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  badgeSurplus: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeSurplusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  badgeNeutral: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});

/* ─────────────────────────────────────────────────────────────
   Screen Styles
───────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  headerCard: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: { color: '#fde68a', fontSize: 13, fontWeight: '700' },
  userNameText: { color: COLORS.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  userHandleText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  profileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statBox: { flex: 1, paddingHorizontal: SPACING.sm },
  statLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginTop: 4 },
  // Tile (Advance + Recent Trips)
  sectionTile: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  tileLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14532d',
  },
  tileSub: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 2,
    fontWeight: '500',
  },
  tileCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  tileCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  newTripBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  newTripBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  truckAdvanceBtn: {
    backgroundColor: '#15803d',
    borderRadius: RADIUS.lg,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  truckAdvanceBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  expiryBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  expiryBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  expiryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryBannerTitle: { fontSize: 14, fontWeight: '800', color: '#92400e' },
  expiryBannerSub: { fontSize: 12, color: '#b45309', marginTop: 2 },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  expiryLorry: { fontWeight: '800', fontSize: 13, color: '#0f172a', flex: 1 },
  expiryDoc: { fontSize: 12, fontWeight: '700', color: '#b45309' },
  // HomeScreen Recent Trips styles
  recentSection: {
    marginBottom: SPACING.md,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tileIconBoxSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  countBadgeSmall: {
    backgroundColor: COLORS.infoLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countBadgeTextSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.info,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  homeTripCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  homeTripTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  homeLorryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  homeLorryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusTextSmall: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  homeTripBody: {
    marginVertical: 4,
  },
  homeTripParty: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  homeTripRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  homeTripRouteText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
    flexShrink: 1,
  },
  homeTripWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  homeWeightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  homeWeightText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  homeWeightBold: {
    fontWeight: '800',
    color: '#14532d',
  },
  homeFreightText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  homeTripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  homeTripDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  homeTapDetails: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  emptyRecentBox: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  emptyRecentText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  liveBeaconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveBeaconRing: {
    position: 'absolute',
    left: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ade80',
    opacity: 0.4,
  },
  liveBeaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveBeaconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86efac',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  /* ─── Driver Advance Balance Card ─────────────────────────── */
  driverBalanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#ede9fe',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  driverBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  driverBalanceIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverBalanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  driverBalanceSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  driverPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: SPACING.sm,
    backgroundColor: '#faf5ff',
  },
  driverPickerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4c1d95',
  },
  driverBalanceBox: {
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    gap: SPACING.xs,
  },
  driverBalanceBoxSurplus: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  driverBalanceBoxDeficit: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  driverBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverBalanceRowLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  driverBalanceRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  driverBalanceDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  driverBalanceResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  driverBalanceResultTextSurplus: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
  },
  driverBalanceResultTextDeficit: {
    fontSize: 14,
    fontWeight: '800',
    color: '#dc2626',
    flexShrink: 1,
  },
  driverBalancePlaceholder: {
    borderRadius: RADIUS.sm,
    backgroundColor: '#f5f3ff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  driverBalancePlaceholderText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
  /* ─── Driver Picker Modal ──────────────────────────────────── */
  driverPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  driverPickerSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '65%',
    ...SHADOWS.lg,
  },
  driverPickerHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: SPACING.md,
  },
  driverPickerSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  driverPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    gap: SPACING.sm,
  },
  driverPickerItemActive: {
    backgroundColor: '#f5f3ff',
  },
  driverPickerItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  driverPickerItemMobile: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  driverPickerBadgeSurplus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  driverPickerBadgeDeficit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  driverPickerBadgeNeutral: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  driverBalanceBoxNeutral: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  driverBalanceNoteTextDeficit: {
    fontSize: 11,
    color: '#b91c1c',
    marginTop: 4,
    lineHeight: 15,
  },
  driverBalanceNoteTextSurplus: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 4,
    lineHeight: 15,
  },
  driverBalanceResultTextNeutral: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  driverPickerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  driverSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: SPACING.md,
  },
  driverSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    padding: 0,
  },
});

