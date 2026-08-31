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
  PlusCircle,
  TrendingUp,
  CreditCard,
  MapPin,
  Calendar,
  ChevronRight,
  User,
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
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

      {/* Action Button: + New Trip Entry */}
      <TouchableOpacity
        style={styles.newTripBtn}
        onPress={() => navigation.navigate('NewTrip')}
      >
        <PlusCircle size={24} color={COLORS.white} />
        <Text style={styles.newTripBtnText}>+ NEW TRIP ENTRY</Text>
      </TouchableOpacity>

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
    marginVertical: SPACING.lg,
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
});
