import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ShieldAlert,
  TrendingUp,
  CreditCard,
  FileCheck,
  AlertTriangle,
  Navigation,
  Truck,
  Users,
  Building2,
  FileText,
  History,
  Sliders,
  ChevronRight,
  RefreshCw,
  Crown,
} from 'lucide-react-native';
import { adminDashboardService } from '../../services/adminService';
import { DashboardData, Trip } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await adminDashboardService.getAdminDashboard();
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load admin dashboard', err);
      Alert.alert('Dashboard Error', err.message || 'Could not fetch admin statistics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDaysLeft = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading Admin Control Center...</Text>
      </View>
    );
  }

  const stats = data?.stats;
  const financials = data?.financials;
  const alerts = data?.compliance_alerts || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.accent]} />}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Admin Badge Banner */}
      <View style={styles.adminBanner}>
        <View style={styles.adminBannerLeft}>
          <Crown size={22} color={COLORS.accent} />
          <View>
            <Text style={styles.adminBannerTitle}>KSP Administrator Portal</Text>
            <Text style={styles.adminBannerSubtitle}>Full access to operations, finances & masters</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* 30-Day Compliance Expiry Alerts Banner */}
      {alerts.length > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <AlertTriangle size={20} color="#ea580c" />
            <Text style={styles.alertTitle}>
              COMPLIANCE ALERTS ({alerts.length} Vehicle{alerts.length > 1 ? 's' : ''})
            </Text>
          </View>
          <Text style={styles.alertSubtitle}>Documents expiring within 30 days or overdue</Text>

          <View style={styles.alertList}>
            {alerts.map((v) => {
              const docList = [
                { name: 'FC', date: v.fc_expiry_date },
                { name: 'Insurance', date: v.insurance_expiry_date },
                { name: 'Permit', date: v.permit_expiry_date },
                { name: 'Road Tax', date: v.tax_expiry_date },
              ].filter((d) => {
                const days = getDaysLeft(d.date);
                return days !== null && days <= 30;
              });

              if (docList.length === 0) return null;

              return (
                <TouchableOpacity
                  key={v.id || v.lorry_number}
                  style={styles.alertRow}
                  onPress={() => navigation.navigate('AdminVehicles')}
                  activeOpacity={0.8}
                >
                  <View style={styles.lorryTag}>
                    <Truck size={14} color={COLORS.primary} />
                    <Text style={styles.lorryText}>{v.lorry_number}</Text>
                  </View>
                  <View style={styles.badgesWrapper}>
                    {docList.map((doc, idx) => {
                      const days = getDaysLeft(doc.date)!;
                      const isExpired = days < 0;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.docBadge,
                            { backgroundColor: isExpired ? '#fef2f2' : '#fffbeb', borderColor: isExpired ? '#fca5a5' : '#fcd34d' }
                          ]}
                        >
                          <Text style={[styles.docBadgeText, { color: isExpired ? '#b91c1c' : '#92400e' }]}>
                            {isExpired ? '❌' : '⚠️'} {doc.name}: {formatDateDMY(doc.date)} ({isExpired ? `${Math.abs(days)}d ago` : `${days}d left`})
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* KPI Stats Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Today's Trips</Text>
            <Navigation size={18} color="#f59e0b" />
          </View>
          <Text style={styles.kpiValue}>{stats?.trips_today || 0}</Text>
          <Text style={styles.kpiSub}>Dispatched today</Text>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Pending Payments</Text>
            <CreditCard size={18} color="#3b82f6" />
          </View>
          <Text style={styles.kpiValue}>{stats?.pending_payments || 0}</Text>
          <Text style={styles.kpiSub}>Awaiting settlement</Text>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Settled Trips</Text>
            <FileCheck size={18} color="#10b981" />
          </View>
          <Text style={styles.kpiValue}>{stats?.settled_trips || 0}</Text>
          <Text style={styles.kpiSub}>Fully completed</Text>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: '#ef4444' }]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Pending Settlements</Text>
            <AlertTriangle size={18} color="#ef4444" />
          </View>
          <Text style={styles.kpiValue}>{stats?.pending_settlements || 0}</Text>
          <Text style={styles.kpiSub}>Driver slips pending</Text>
        </View>
      </View>

      {/* Financial Highlights (Dark Card) */}
      <View style={styles.financeCard}>
        <View style={styles.financeHeader}>
          <Text style={styles.financeTitle}>TOTAL FREIGHT BILLED</Text>
          <TrendingUp size={20} color={COLORS.accent} />
        </View>
        <Text style={styles.financeMainAmt}>{formatCurrency(financials?.total_freight || 0)}</Text>

        <View style={styles.financeDivider} />

        <View style={styles.financeRow}>
          <View>
            <Text style={styles.financeSubLabel}>Collected</Text>
            <Text style={styles.financeCollected}>{formatCurrency(financials?.total_received || 0)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.financeSubLabel}>Pending Balance</Text>
            <Text style={styles.financeBalance}>{formatCurrency(financials?.total_balance || 0)}</Text>
          </View>
        </View>
      </View>

      {/* Quick Navigation Menu Grid */}
      <Text style={styles.sectionHeading}>Admin Navigation</Text>
      <View style={styles.navGrid}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminTrips')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#eff6ff' }]}>
            <Navigation size={22} color="#1d4ed8" />
          </View>
          <Text style={styles.navItemTitle}>Trips Operations</Text>
          <Text style={styles.navItemSub}>Status & Dispatches</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminReports')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef3c7' }]}>
            <FileText size={22} color="#b45309" />
          </View>
          <Text style={styles.navItemTitle}>Reports Master</Text>
          <Text style={styles.navItemSub}>Export CSV & PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminAuditLogs')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f3e8ff' }]}>
            <History size={22} color="#7e22ce" />
          </View>
          <Text style={styles.navItemTitle}>Audit Logs</Text>
          <Text style={styles.navItemSub}>Mobile vs Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminUsers')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#ecfdf5' }]}>
            <Users size={22} color="#047857" />
          </View>
          <Text style={styles.navItemTitle}>User Accounts</Text>
          <Text style={styles.navItemSub}>Roles & Passwords</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminVehicles')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#ffedd5' }]}>
            <Truck size={22} color="#c2410c" />
          </View>
          <Text style={styles.navItemTitle}>Fleet Lorries</Text>
          <Text style={styles.navItemSub}>{stats?.total_vehicles || 0} Registered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminDrivers')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#e0e7ff' }]}>
            <Users size={22} color="#4338ca" />
          </View>
          <Text style={styles.navItemTitle}>Drivers Master</Text>
          <Text style={styles.navItemSub}>{stats?.total_drivers || 0} Registered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminParties')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f1f5f9' }]}>
            <Building2 size={22} color="#334155" />
          </View>
          <Text style={styles.navItemTitle}>Parties Master</Text>
          <Text style={styles.navItemSub}>{stats?.total_parties || 0} Active</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef2f2' }]}>
            <Sliders size={22} color="#b91c1c" />
          </View>
          <Text style={styles.navItemTitle}>Rates & Hub</Text>
          <Text style={styles.navItemSub}>Rates, Limits, Units</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Trips Section */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Trips Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AdminTrips')}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {(!data?.recent_trips || data.recent_trips.length === 0) ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent trips found</Text>
          </View>
        ) : (
          data.recent_trips.slice(0, 5).map((trip: Trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripRow}>
                <View style={styles.tripLorryBadge}>
                  <Truck size={14} color={COLORS.primary} />
                  <Text style={styles.tripLorryText}>{trip.lorry_number}</Text>
                </View>
                <View style={[styles.statusBadge, getStatusStyle(trip.status)]}>
                  <Text style={[styles.statusBadgeText, getStatusTextStyle(trip.status)]}>
                    {trip.status}
                  </Text>
                </View>
              </View>

              <View style={styles.tripDetails}>
                <Text style={styles.tripParty}>{trip.party_name}</Text>
                <Text style={styles.tripRoute}>
                  {trip.from_location || 'Goods'} → {trip.to_location || 'Dest'} ({trip.goods_weight} {trip.unit_name || 'Ton'})
                </Text>
              </View>

              <View style={styles.tripFooter}>
                <Text style={styles.tripDate}>{formatDateDMY(trip.trip_date)}</Text>
                <Text style={styles.tripFreight}>Freight: {formatCurrency(trip.total_freight)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  contentContainer: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  adminBanner: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  adminBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  adminBannerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  adminBannerSubtitle: {
    color: COLORS.textLight,
    fontSize: 11,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  alertCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#f97316',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#c2410c',
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  alertList: {
    gap: 8,
  },
  alertRow: {
    backgroundColor: COLORS.white,
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  lorryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  lorryText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  badgesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  kpiSub: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  financeCard: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  financeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  financeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  financeMainAmt: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.accent,
  },
  financeDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financeSubLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  financeCollected: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10b981',
  },
  financeBalance: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ef4444',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.md,
  },
  navItem: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  navIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  navItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  navItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recentSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accentDark,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tripCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripLorryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripLorryText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tripDetails: {
    marginVertical: 2,
  },
  tripParty: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  tripRoute: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tripDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  tripFreight: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
});
