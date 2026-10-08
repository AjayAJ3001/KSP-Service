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
  Modal,
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
  Scale,
  X,
  MapPin,
  Calendar,
  Receipt,
  UserCheck,
  Briefcase,
  Droplets,
  ArrowDownCircle,
  Percent,
  HandCoins,
} from 'lucide-react-native';
import { adminDashboardService } from '../../services/adminService';
import { DashboardData, Trip } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

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
    <>
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

      {/* Operations Section */}
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Operations</Text>
      </View>
      <View style={styles.navGrid}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminTrips')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#eff6ff' }]}>
            <Navigation size={20} color="#1d4ed8" />
          </View>
          <Text style={styles.navItemTitle}>Trips Operations</Text>
          <Text style={styles.navItemSub}>Status & Dispatches</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminOwnerAdvances')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef3c7' }]}>
            <HandCoins size={20} color="#b45309" />
          </View>
          <Text style={styles.navItemTitle}>Advance to Manager</Text>
          <Text style={styles.navItemSub}>Owner Advances</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef2f2' }]}>
            <Sliders size={20} color="#b91c1c" />
          </View>
          <Text style={styles.navItemTitle}>Rates & Hub</Text>
          <Text style={styles.navItemSub}>Full Master Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Master Data Section - Matching Admin Panel */}
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Master Data</Text>
        <Text style={styles.sectionHeadingBadge}>Web Admin Parity</Text>
      </View>
      <View style={styles.navGrid}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminUsers')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#ecfdf5' }]}>
            <Users size={20} color="#047857" />
          </View>
          <Text style={styles.navItemTitle}>User Management</Text>
          <Text style={styles.navItemSub}>{stats?.total_users || 0} Accounts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminDrivers')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#e0e7ff' }]}>
            <UserCheck size={20} color="#4338ca" />
          </View>
          <Text style={styles.navItemTitle}>Drivers</Text>
          <Text style={styles.navItemSub}>{stats?.total_drivers || 0} Registered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'OWNERS' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef3c7' }]}>
            <Briefcase size={20} color="#d97706" />
          </View>
          <Text style={styles.navItemTitle}>Owners</Text>
          <Text style={styles.navItemSub}>Vehicle Owners</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminOwnerAdvances')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fffbeb' }]}>
            <HandCoins size={20} color="#d97706" />
          </View>
          <Text style={styles.navItemTitle}>Advance to Manager</Text>
          <Text style={styles.navItemSub}>Owner Advances</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminVehicles')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#ffedd5' }]}>
            <Truck size={20} color="#c2410c" />
          </View>
          <Text style={styles.navItemTitle}>Vehicles / Lorries</Text>
          <Text style={styles.navItemSub}>{stats?.total_vehicles || 0} Registered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminParties')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f0fdfa' }]}>
            <Building2 size={20} color="#0f766e" />
          </View>
          <Text style={styles.navItemTitle}>Parties and Units</Text>
          <Text style={styles.navItemSub}>{stats?.total_parties || 0} Active</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'CLEANING' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f0f9ff' }]}>
            <Droplets size={20} color="#0284c7" />
          </View>
          <Text style={styles.navItemTitle}>Cleaning Expenses</Text>
          <Text style={styles.navItemSub}>Commodity Rates</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'UNLOADING' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f5f3ff' }]}>
            <ArrowDownCircle size={20} color="#7c3aed" />
          </View>
          <Text style={styles.navItemTitle}>Unloading Rates</Text>
          <Text style={styles.navItemSub}>Per Ton / Unit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'BATA' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fff1f2' }]}>
            <Percent size={20} color="#e11d48" />
          </View>
          <Text style={styles.navItemTitle}>Driver Bata</Text>
          <Text style={styles.navItemSub}>Bata % & Multiplier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'LIMITS' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
            <ShieldAlert size={20} color="#ea580c" />
          </View>
          <Text style={styles.navItemTitle}>Other Expense Limit</Text>
          <Text style={styles.navItemSub}>Approval Limits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'UNITS' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#eef2ff' }]}>
            <Scale size={20} color="#4f46e5" />
          </View>
          <Text style={styles.navItemTitle}>Units Master</Text>
          <Text style={styles.navItemSub}>Tons, Bags, etc.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminMasters', { initialTab: 'ROUTES' })}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f0fdf4' }]}>
            <MapPin size={20} color="#16a34a" />
          </View>
          <Text style={styles.navItemTitle}>Routes & Rates</Text>
          <Text style={styles.navItemSub}>Route Freight</Text>
        </TouchableOpacity>
      </View>

      {/* Analytics & Security Section */}
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Analytics & Security</Text>
      </View>
      <View style={styles.navGrid}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminReports')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#fef3c7' }]}>
            <FileText size={20} color="#b45309" />
          </View>
          <Text style={styles.navItemTitle}>Reports</Text>
          <Text style={styles.navItemSub}>CSV & PDF Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminAuditLogs')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconBox, { backgroundColor: '#f3e8ff' }]}>
            <History size={20} color="#7e22ce" />
          </View>
          <Text style={styles.navItemTitle}>Audit Logs</Text>
          <Text style={styles.navItemSub}>Security Activity</Text>
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
            <TouchableOpacity
              key={trip.id}
              style={styles.tripCard}
              activeOpacity={0.75}
              onPress={() => setSelectedTrip(trip)}
            >
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
                  {trip.from_location || 'Start'} → {trip.to_location || 'Dest'}
                </Text>
              </View>

              {/* Goods Weight Badge */}
              <View style={styles.tripWeightBadgeRow}>
                <View style={styles.tripWeightPill}>
                  <Scale size={12} color={COLORS.primary} />
                  <Text style={styles.tripWeightLabel}>Weight: </Text>
                  <Text style={styles.tripWeightVal}>
                    {trip.goods_weight ? `${trip.goods_weight} ${trip.unit_abbreviation || trip.unit_name || 'Ton'}` : '—'}
                  </Text>
                </View>
                {trip.freight_rate ? (
                  <Text style={styles.tripFreightRateText}>
                    @ ₹{parseFloat(String(trip.freight_rate)).toLocaleString('en-IN')}/{trip.unit_abbreviation || 'Ton'}
                  </Text>
                ) : null}
              </View>

              <View style={styles.tripFooter}>
                <Text style={styles.tripDate}>{formatDateDMY(trip.trip_date)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.tripFreight}>Freight: {formatCurrency(trip.total_freight)}</Text>
                  <ChevronRight size={13} color={COLORS.accent} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>

      {/* ── Admin Trip Details Modal ── */}
      <Modal
        visible={!!selectedTrip}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedTrip(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedTrip(null)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {selectedTrip && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Trip Details #{selectedTrip.id}</Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedTrip(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Route banner */}
                <View style={styles.detailRouteBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MapPin size={16} color={COLORS.accent} />
                    <Text style={styles.detailRouteText} numberOfLines={1}>
                      {selectedTrip.from_location} → {selectedTrip.to_location}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusStyle(selectedTrip.status)]}>
                    <Text style={[styles.statusBadgeText, getStatusTextStyle(selectedTrip.status)]}>
                      {selectedTrip.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                  {/* Trip Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>TRIP INFO</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Party</Text>
                      <Text style={styles.detailVal}>{selectedTrip.party_name || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Lorry Number</Text>
                      <Text style={styles.detailVal}>{selectedTrip.lorry_number || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Trip Date</Text>
                      <Text style={styles.detailVal}>{formatDateDMY(selectedTrip.trip_date)}</Text>
                    </View>
                    {selectedTrip.driver_name ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Driver</Text>
                        <Text style={styles.detailVal}>{selectedTrip.driver_name}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Goods Weight</Text>
                      <Text style={[styles.detailVal, { color: COLORS.accent, fontWeight: '800' }]}>
                        {selectedTrip.goods_weight
                          ? `${selectedTrip.goods_weight} ${selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}`
                          : '—'}
                      </Text>
                    </View>
                    {selectedTrip.freight_rate ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Freight Rate</Text>
                        <Text style={styles.detailVal}>
                          ₹{parseFloat(String(selectedTrip.freight_rate)).toLocaleString('en-IN')}/{selectedTrip.unit_abbreviation || selectedTrip.unit_name || 'Ton'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Financials */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>FINANCIALS</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Total Freight</Text>
                      <Text style={[styles.detailVal, { color: COLORS.primaryDark, fontWeight: '800' }]}>
                        {formatCurrency(selectedTrip.total_freight)}
                      </Text>
                    </View>
                    {selectedTrip.advance_paid != null && selectedTrip.advance_paid > 0 && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Driver Advance</Text>
                        <Text style={styles.detailVal}>{formatCurrency(selectedTrip.advance_paid)}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Amount Received</Text>
                      <Text style={[styles.detailVal, { color: '#059669', fontWeight: '700' }]}>
                        {formatCurrency(selectedTrip.total_received || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Balance Due</Text>
                      <Text style={[styles.detailVal, { color: '#dc2626', fontWeight: '800' }]}>
                        {formatCurrency(
                          selectedTrip.balance_due ??
                            Math.max(0, (selectedTrip.total_freight || 0) - (selectedTrip.total_received || 0))
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Quick Action Navigation */}
                  <View style={styles.detailActionsRow}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#eff6ff' }]}
                      onPress={() => {
                        const trip = selectedTrip;
                        setSelectedTrip(null);
                        navigation.navigate('PartyPayment', { trip });
                      }}
                    >
                      <CreditCard size={14} color="#1d4ed8" />
                      <Text style={[styles.modalActionBtnText, { color: '#1d4ed8' }]}>Payment</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#fef3c7' }]}
                      onPress={() => {
                        const trip = selectedTrip;
                        setSelectedTrip(null);
                        navigation.navigate('DriverExpenses', { trip });
                      }}
                    >
                      <TrendingUp size={14} color="#b45309" />
                      <Text style={[styles.modalActionBtnText, { color: '#b45309' }]}>Expenses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#ecfdf5' }]}
                      onPress={() => {
                        const trip = selectedTrip;
                        setSelectedTrip(null);
                        navigation.navigate('SettlementReceipt', { trip });
                      }}
                    >
                      <Receipt size={14} color="#047857" />
                      <Text style={[styles.modalActionBtnText, { color: '#047857' }]}>Settlement</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
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
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs + 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionHeadingBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryDark,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#bfdbfe',
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
  tripWeightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 4,
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
  tripFreightRateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    maxHeight: '82%',
    ...SHADOWS.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderDark || '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailRouteText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    flexShrink: 1,
  },
  detailSection: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailKey: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  modalActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
