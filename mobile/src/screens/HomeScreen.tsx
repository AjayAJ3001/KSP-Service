import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { mobileDashboardService, mobileLookupService } from '../services/mobileService';
import { MobileDashboardData, Trip, Vehicle } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { downloadTripPdf, shareTripPdf } from '../utils/pdfGenerator';

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
}
const BottomSheet: React.FC<SheetProps> = ({ visible, onClose, children }) => (
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
      <View style={mStyles.sheet}>
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
                  {selectedTrip.total_received != null && (
                    <Row label="Amount Received" value={formatCurrency(selectedTrip.total_received)} />
                  )}
                  <Row
                    label="Balance Due"
                    value={formatCurrency(
                      selectedTrip.balance_due ??
                        Math.max(0, (selectedTrip.total_freight || 0) - (selectedTrip.total_received || 0))
                    )}
                  />
                  {selectedTrip.advance_paid != null && selectedTrip.advance_paid > 0 && (
                    <Row label="Driver Advance" value={formatCurrency(selectedTrip.advance_paid)} />
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
                            <Text style={mStyles.tripListBalance}>
                              Due: {formatCurrency(
                                trip.balance_due ??
                                  Math.max(0, (trip.total_freight || 0) - (trip.total_received || 0))
                              )}
                            </Text>
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
  const [selectedRecentTrip, setSelectedRecentTrip] = useState<Trip | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await mobileDashboardService.getDashboard();
      setData(res.data);
    } catch (error) {
      console.error('Failed to load mobile dashboard', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }

    try {
      const expRes = await mobileLookupService.getExpiringVehicles(30);
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
    return `\u20B9${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
        {/* ── Header Card ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
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

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Trips Today</Text>
              <Text style={styles.statValue}>{data?.trips_today || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.statLabel}>Balance Due</Text>
              <Text style={[styles.statValue, { color: COLORS.accent }]}>
                {formatCurrency(data?.balance_due || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Expiry Alert ── */}
        {expiringVehicles.length > 0 && (
          <View style={styles.expiryBanner}>
            <View style={styles.expiryBannerTop}>
              <View style={styles.expiryIconCircle}>
                <ShieldAlert size={20} color="#b45309" />
              </View>
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

        {/* ── Owner Advance Credit — tap to open modal ── */}
        {(data?.owner_advance_credit ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.sectionTile}
            activeOpacity={0.82}
            onPress={() => setAdvanceModalVisible(true)}
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
          </TouchableOpacity>
        )}

        {/* ── Give Truck Advance ── */}
        {(data?.manager_available_balance ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.truckAdvanceBtn}
            onPress={() => navigation.navigate('GiveTruckAdvance', {
              availableBalance: data?.manager_available_balance ?? 0,
            })}
          >
            <Truck size={20} color={COLORS.white} />
            <Text style={styles.truckAdvanceBtnText}>Give Advance to Truck</Text>
            <ChevronRight size={18} color={COLORS.white} />
          </TouchableOpacity>
        )}

        {/* ── Start New Trip ── */}
        <TouchableOpacity
          style={styles.newTripBtn}
          onPress={() => navigation.navigate('NewTrip')}
          activeOpacity={0.85}
        >
          <PlusCircle size={22} color={COLORS.white} />
          <Text style={styles.newTripBtnText}>+ START NEW TRIP</Text>
        </TouchableOpacity>

        {/* ── Recent Trips — tap to open modal ── */}
        <TouchableOpacity
          style={[styles.sectionTile, { borderColor: COLORS.border }]}
          activeOpacity={0.82}
          onPress={() => {
            setSelectedRecentTrip(null);
            setTripsModalVisible(true);
          }}
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
        </TouchableOpacity>

        {/* View All link */}
        <TouchableOpacity style={styles.viewAllRow} onPress={() => navigation.navigate('Trips')}>
          <Text style={styles.viewAllText}>View all trips in Trips tab</Text>
          <ChevronRight size={14} color={COLORS.accent} />
        </TouchableOpacity>
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
    backgroundColor: COLORS.primary,
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
  greetingText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
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
});
