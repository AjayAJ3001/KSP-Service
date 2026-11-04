import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BookOpen, Wallet, TrendingDown, TrendingUp } from 'lucide-react-native';
import { adminTruckAdvanceService } from '../../services/adminService';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const AdminManagerLedgerScreen: React.FC = () => {
  const [managers, setManagers] = useState<any[]>([]);
  const [totals, setTotals] = useState({ total_received: 0, total_given: 0, total_available: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminTruckAdvanceService.getManagerSummary();
      setManagers(res.data?.managers || []);
      setTotals(res.data?.grand_totals || { total_received: 0, total_given: 0, total_available: 0 });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load manager advances.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} />}
    >
      <View style={styles.totalsCard}>
        <View style={styles.totalCol}>
          <TrendingUp size={16} color="#047857" />
          <Text style={styles.totalLabel}>Received</Text>
          <Text style={[styles.totalVal, { color: '#047857' }]}>{formatCurrency(totals.total_received)}</Text>
        </View>
        <View style={styles.totalCol}>
          <TrendingDown size={16} color="#b45309" />
          <Text style={styles.totalLabel}>Given</Text>
          <Text style={[styles.totalVal, { color: '#b45309' }]}>{formatCurrency(totals.total_given)}</Text>
        </View>
        <View style={styles.totalCol}>
          <Wallet size={16} color="#1d4ed8" />
          <Text style={styles.totalLabel}>In Hand</Text>
          <Text style={[styles.totalVal, { color: '#1d4ed8' }]}>{formatCurrency(totals.total_available)}</Text>
        </View>
      </View>

      {managers.length === 0 ? (
        <View style={styles.empty}>
          <BookOpen size={36} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No manager advance records for your fleet</Text>
        </View>
      ) : (
        managers.map((m) => (
          <View key={m.manager_id} style={styles.card}>
            <Text style={styles.name}>{m.manager_name}</Text>
            <Text style={styles.sub}>{m.manager_mobile || m.manager_email || m.role}</Text>
            <View style={styles.row}>
              <Text style={styles.cell}>In {formatCurrency(m.total_received)}</Text>
              <Text style={styles.cell}>Out {formatCurrency(m.total_given)}</Text>
              <Text style={[styles.cell, { fontWeight: '800' }]}>Bal {formatCurrency(m.available_balance)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalsCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 8, ...SHADOWS.sm },
  totalCol: { flex: 1, alignItems: 'center', gap: 4 },
  totalLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  totalVal: { fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 8, color: COLORS.textMuted, fontSize: 13 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
});
