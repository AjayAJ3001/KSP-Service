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
import { MapPin, Calendar, Truck, ChevronRight } from 'lucide-react-native';
import { mobileTripService } from '../services/mobileService';
import { Trip } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const TripHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SETTLED' | 'PENDING'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrips();
  }, [filter]);

  const loadTrips = async () => {
    try {
      let statusParam: string | undefined = undefined;
      if (filter === 'SETTLED') statusParam = 'SETTLED';
      else if (filter === 'PENDING') statusParam = 'PAYMENT_PENDING';

      const res = await mobileTripService.getTrips(statusParam);
      setTrips(res.data.items);
    } catch (err) {
      console.error('Failed to load trip history', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
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

  return (
    <View style={styles.container}>
      {/* Top Filter Buttons */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ALL' && styles.filterBtnActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterBtnText, filter === 'ALL' && styles.filterBtnTextActive]}>
            All Trips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'PENDING' && styles.filterBtnActive]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.filterBtnText, filter === 'PENDING' && styles.filterBtnTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'SETTLED' && styles.filterBtnActive]}
          onPress={() => setFilter('SETTLED')}
        >
          <Text style={[styles.filterBtnText, filter === 'SETTLED' && styles.filterBtnTextActive]}>
            Settled
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading History...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.accent]} />}
        >
          {trips.length === 0 ? (
            <View style={styles.emptyCard}>
              <Truck size={36} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No trips found for this filter.</Text>
            </View>
          ) : (
            trips.map((trip) => {
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
                      <Text style={[styles.statusText, { color: st.text }]}>
                        {trip.status.replace(/_/g, ' ')}
                      </Text>
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
                    <Text style={styles.driverText}>Driver: {trip.driver_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.actionText}>Manage Trip</Text>
                      <ChevronRight size={14} color={COLORS.accent} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterBar: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterBtnTextActive: {
    color: COLORS.accent,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
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
  driverText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
});
