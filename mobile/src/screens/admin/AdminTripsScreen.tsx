import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Navigation,
  Search,
  Truck,
  CreditCard,
  FileCheck,
  Building2,
  User,
  Plus,
  X,
  TrendingUp,
  Receipt,
  Trash2,
} from 'lucide-react-native';
import { adminTripService } from '../../services/adminService';
import { Trip } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

type TripStatusFilter = 'ALL' | 'NEW' | 'PAYMENT_PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'CANCELLED';

export const AdminTripsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminTripService.getTrips({
        limit: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setTrips(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load trips', err);
      Alert.alert('Error', err.message || 'Could not fetch trips.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const filteredTrips = trips.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.lorry_number && t.lorry_number.toLowerCase().includes(q)) ||
      (t.party_name && t.party_name.toLowerCase().includes(q)) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(q))
    );
  });

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleDeleteTrip = (trip: Trip) => {
    Alert.alert('Delete Trip', `Permanently delete Trip #${trip.id} (${trip.lorry_number})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminTripService.deleteTrip(trip.id);
            loadTrips();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lorry, party, driver..."
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('NewTrip')}
          >
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>New Trip</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {[
            { id: 'ALL', label: 'All Trips' },
            { id: 'NEW', label: 'New' },
            { id: 'PAYMENT_PENDING', label: 'Payment Pending' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'SETTLED', label: 'Settled' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, statusFilter === s.id && styles.chipActive]}
              onPress={() => setStatusFilter(s.id as TripStatusFilter)}
            >
              <Text style={[styles.chipText, statusFilter === s.id && styles.chipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trips List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Trips Operations...</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <View style={styles.centerBox}>
          <Navigation size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No trips found for selected filter</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredTrips.map((t) => (
            <View key={t.id} style={styles.tripCard}>
              <View style={styles.cardHeader}>
                <View style={styles.lorryTag}>
                  <Truck size={16} color={COLORS.primary} />
                  <Text style={styles.lorryText}>{t.lorry_number}</Text>
                  <Text style={styles.tripIdText}>#{t.id}</Text>
                </View>

                <View style={[styles.statusBadge, getStatusStyle(t.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(t.status)]}>
                    {t.status}
                  </Text>
                </View>
              </View>

              {/* Party & Route */}
              <Text style={styles.partyText}>{t.party_name}</Text>
              <Text style={styles.routeText}>
                {t.to_location || `${t.from_location} → ${t.to_location}`} • {t.goods_weight} {t.unit_name || 'Ton'} @ ₹{t.freight_rate}
              </Text>

              {/* Financial Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Freight</Text>
                  <Text style={styles.metricVal}>{formatCurrency(t.total_freight)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Advance</Text>
                  <Text style={styles.metricVal}>{formatCurrency(t.advance_paid)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Received</Text>
                  <Text style={[styles.metricVal, { color: '#10b981' }]}>
                    {formatCurrency(t.total_received || 0)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Balance Due</Text>
                  <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                    {formatCurrency(t.balance_due || 0)}
                  </Text>
                </View>
              </View>

              {/* Driver & Date footer */}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>📅 {formatDateDMY(t.trip_date)}</Text>
                <Text style={styles.metaText}>👤 {t.driver_name || 'No driver'}</Text>
              </View>

              {/* Action Buttons: Party Payment, Driver Expenses, Settlement Slip */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                  onPress={() => navigation.navigate('PartyPayment', { trip: t })}
                >
                  <CreditCard size={13} color="#1d4ed8" />
                  <Text style={[styles.actionBtnText, { color: '#1d4ed8' }]}>Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]}
                  onPress={() => navigation.navigate('DriverExpenses', { trip: t })}
                >
                  <TrendingUp size={13} color="#b45309" />
                  <Text style={[styles.actionBtnText, { color: '#b45309' }]}>Expenses</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#ecfdf5' }]}
                  onPress={() => navigation.navigate('SettlementReceipt', { trip: t })}
                >
                  <Receipt size={13} color="#047857" />
                  <Text style={[styles.actionBtnText, { color: '#047857' }]}>Settlement</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={() => handleDeleteTrip(t)}
                >
                  <Trash2 size={13} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
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
  headerSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
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
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  listContainer: {
    padding: SPACING.md,
    gap: 10,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tripCard: {
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
    alignItems: 'center',
    marginBottom: 6,
  },
  lorryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lorryText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  tripIdText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  partyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  routeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
