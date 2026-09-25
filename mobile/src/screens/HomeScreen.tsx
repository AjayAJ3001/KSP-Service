import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Truck,
  TrendingUp,
  CreditCard,
  MapPin,
  Calendar,
  ChevronRight,
  User,
  HandCoins,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { mobileDashboardService } from '../services/mobileService';
import { MobileDashboardData, Trip } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [data, setData] = useState<MobileDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

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
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.accent]} />}
    >
      {/* Top Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.userNameText}>{user?.name || 'Operator'}</Text>
            {user?.username ? (
              <Text style={styles.userHandleText}>@{user.username}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => navigation.navigate('Profile')}
          >
            <User size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Dashboard Stats Row */}
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

      {/* Owner Advance Credit — per-owner breakdown */}
      {(data?.owner_advance_credit ?? 0) > 0 && (
        <View style={styles.creditBanner}>
          <View style={styles.creditBannerTop}>
            <View style={styles.creditBannerLeft}>
              <View style={styles.creditIconCircle}>
                <HandCoins size={22} color="#15803d" />
              </View>
              <View style={styles.creditTextCol}>
                <Text style={styles.creditBannerLabel}>Owner Advance Credit</Text>
                <Text style={styles.creditBannerSub}>
                  Available Balance: ₹{(data?.manager_available_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.creditTotalLabel}>TOTAL ADVANCE</Text>
              <Text style={styles.creditBannerAmount}>{formatCurrency(data?.owner_advance_credit ?? 0)}</Text>
            </View>
          </View>

          {/* Per-owner breakdown rows */}
          {(data?.owner_advance_breakdown ?? []).length > 0 && (
            <View style={styles.ownerBreakdownList}>
              <Text style={styles.breakdownHeading}>Received From Owner</Text>
              {data!.owner_advance_breakdown.map((entry, i) => (
                <View key={i} style={styles.ownerBreakdownRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={styles.ownerNameRow}>
                      <User size={14} color="#15803d" />
                      <Text style={styles.ownerNameText}>{entry.owner_name}</Text>
                    </View>
                    <View style={styles.ownerMetaRow}>
                      <Calendar size={12} color="#166534" />
                      <Text style={styles.ownerDateText}>
                        {formatDate(entry.advance_date)}
                      </Text>
                      {entry.payment_mode ? (
                        <View style={styles.paymentModeBadge}>
                          <Text style={styles.paymentModeText}>{entry.payment_mode}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.ownerAmountText}>{formatCurrency(entry.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Give Truck Advance Button — only when balance > 0 */}
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


      {/* Recent Trips Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Trips</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Trips')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Trips List */}
      {(!data?.recent_trips || data.recent_trips.length === 0) ? (
        <View style={styles.emptyCard}>
          <Truck size={36} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No recent trips found.</Text>
          <Text style={styles.emptySubText}>Tap "+ New Trip Entry" to start dispatching</Text>
        </View>
      ) : (
        data.recent_trips.map((trip: Trip) => {
          const st = getStatusStyle(trip.status);
          return (
            <TouchableOpacity
              key={trip.id}
              style={styles.tripCard}
              onPress={() => navigation.navigate('PartyPayment', { trip })}
            >
              <View style={styles.tripCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} color={COLORS.accent} />
                  <Text style={styles.routeText}>
                    {trip.from_location} → {trip.to_location}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusText, { color: st.text }]}>{trip.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>

              <View style={styles.tripBody}>
                <View>
                  <Text style={styles.partyText}>{trip.party_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Calendar size={13} color={COLORS.textLight} />
                    <Text style={styles.dateText}>
                      {new Date(trip.trip_date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.freightText}>{formatCurrency(trip.total_freight)}</Text>
                  <Text style={styles.lorryText}>{trip.lorry_number}</Text>
                </View>
              </View>

              <View style={styles.tripCardFooter}>
                <Text style={styles.balanceNote}>
                  Balance Due: {formatCurrency(trip.balance_due ?? trip.total_freight)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.manageText}>Payment & Settlement</Text>
                  <ChevronRight size={14} color={COLORS.accent} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
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
  greetingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  userNameText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
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
  statBox: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  newTripBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  newTripBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  emptySubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tripCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
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
  tripBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  partyText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  freightText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  lorryText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  balanceNote: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
  },
  manageText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  creditBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  creditBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  creditIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  creditTextCol: {
    flex: 1,
  },
  creditBannerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  creditBannerSub: {
    fontSize: 11,
    color: '#16a34a',
    marginTop: 2,
    fontWeight: '500',
  },
  creditBannerAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803d',
  },
  creditTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ownerBreakdownList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
    gap: 8,
  },
  breakdownHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ownerBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dcfce7',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14532d',
  },
  ownerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  ownerDateText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
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
  ownerAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d',
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
});
