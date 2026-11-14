import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { formatDateDMY } from '../utils/dateUtils';
import { expenseLinesFromItems } from '../utils/expenseBreakdown';
import { buildDriverTripStories } from '../utils/driverTripStories';
import { Settlement, Trip } from '../types';

const money = (val: number | string) => {
  const num = Math.round(parseFloat(String(val)) || 0);
  return `₹${num.toLocaleString('en-IN')}`;
};

const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, color ? { color } : null]}>{value}</Text>
  </View>
);

const Info = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.infoCell}>
    <Text style={styles.infoLbl}>{label}</Text>
    <Text style={styles.infoVal}>{value || '—'}</Text>
  </View>
);

function SettlementChallan({ trip, settlement }: { trip: Trip; settlement: Settlement }) {
  const expenses = Array.isArray(settlement.expense_items) ? settlement.expense_items : [];
  const lines = expenseLinesFromItems(expenses);
  const totalExpenses = Math.round(parseFloat(String(settlement.total_expenses || 0)) || 0);
  const freight = Math.round(parseFloat(String(settlement.total_freight || 0)) || 0);
  const advance = Math.round(parseFloat(String(
    settlement.manager_advance ?? settlement.initial_trip_advance ?? settlement.advance_paid ?? 0
  )) || 0);
  const paid = Math.round(parseFloat(String(settlement.paid_amount || 0)) || 0);
  const net = Math.round(parseFloat(String(settlement.net_balance_to_driver ?? 0)) || 0);
  const need = net > 0 ? net : 0;
  const inHand = net < 0 ? Math.abs(net) : Math.round(parseFloat(String(settlement.owner_balance || 0)) || 0);
  const settled = settlement.settlement_status === 'SETTLED';

  return (
    <ScrollView contentContainerStyle={styles.paper} showsVerticalScrollIndicator>
      <View style={styles.challan}>
        <Text style={styles.docBrand}>KSP TRANSPORT</Text>
        <Text style={styles.docTitle}>TRIP SETTLEMENT CHALLAN</Text>
        <Text style={styles.docSub}>
          Voucher SETTLE-{settlement.id} · Trip #{trip.id || settlement.trip_id}
        </Text>
        <Text style={[styles.badge, { backgroundColor: settled ? '#dcfce7' : '#fef3c7', color: settled ? '#15803d' : '#b45309' }]}>
          {settled ? 'SETTLED' : 'PENDING'}
        </Text>

        <View style={styles.infoGrid}>
          <Info label="Lorry Number" value={trip.lorry_number || settlement.lorry_number} />
          <Info label="Driver Name" value={trip.driver_name || settlement.driver_name} />
          <Info label="Destination / Unit" value={trip.to_location || settlement.to_location || settlement.from_location} />
          <Info label="Trip Dispatch Date" value={formatDateDMY(trip.trip_date || settlement.trip_date)} />
          <Info label="Truck Owner" value={trip.owner_name || settlement.owner_name} />
          <Info label="Settlement Mode" value={settlement.payment_mode || (settled ? 'CASH' : 'PENDING')} />
        </View>

        <Text style={styles.sec}>1. Driver trip expenses</Text>
        {lines.length > 0 ? lines.map((l) => (
          <Row key={l.label} label={l.label} value={money(l.amount)} color="#b45309" />
        )) : (
          <Row label="Consolidated trip expenses" value={money(totalExpenses)} color="#b45309" />
        )}
        <Row label="Total expenses" value={money(totalExpenses)} color="#9a3412" />

        <Text style={styles.sec}>2. Settlement calculation</Text>
        <Row label="Total freight" value={money(freight)} />
        <Row label="Advance given" value={money(advance)} color="#1d4ed8" />
        <Row label="Trip expenses" value={money(totalExpenses)} color="#b45309" />
        {paid > 0 ? <Row label="Paid to driver" value={money(paid)} color="#15803d" /> : null}
        {need > 0 ? <Row label="Need to pay" value={money(need)} color="#dc2626" /> : (
          <Row label="Balance in hand" value={money(inHand)} color="#16a34a" />
        )}
      </View>
    </ScrollView>
  );
}

export const PdfPreviewSheet: React.FC<{
  visible: boolean;
  title: string;
  loading?: boolean;
  html?: string | null;
  data?: any;
  trip?: Trip | null;
  settlement?: Settlement | null;
  onClose: () => void;
}> = ({ visible, title, loading, data, trip, settlement, onClose }) => {
  const stories = useMemo(() => {
    try {
      return data ? buildDriverTripStories(Array.isArray(data.timeline) ? data.timeline : []) : [];
    } catch {
      return [];
    }
  }, [data]);
  const expenseByTrip = useMemo(() => {
    const map = new Map<number, any[]>();
    (data?.trips_and_expenses || []).forEach((t: any) => {
      map.set(Number(t.trip_id || t.id), Array.isArray(t.expense_items) ? t.expense_items : []);
    });
    return map;
  }, [data]);

  const needToPay = Math.round(parseFloat(String(data?.summary?.deficit_amount || 0)) || 0);
  const inHand = Math.round(parseFloat(String(data?.summary?.surplus_amount || 0)) || 0);
  const showChallan = !!(trip && settlement);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.hint}>Loading challan...</Text>
          </View>
        ) : showChallan ? (
          <SettlementChallan trip={trip!} settlement={settlement!} />
        ) : !data ? (
          <View style={styles.center}>
            <Text style={styles.hint}>No challan to display</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.paper} showsVerticalScrollIndicator>
            <Text style={styles.docBrand}>KSP TRANSPORT</Text>
            <Text style={styles.docTitle}>Driver Statement</Text>
            <Text style={styles.docSub}>
              {data.driver?.name || 'Driver'}
              {data.driver?.mobile_number ? ` · ${data.driver.mobile_number}` : ''}
            </Text>

            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: '#f5f3ff' }]}>
                <Text style={styles.kpiLbl}>Advance</Text>
                <Text style={[styles.kpiVal, { color: '#6d28d9' }]}>{money(data.summary?.total_advance_given)}</Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: '#fff7ed' }]}>
                <Text style={styles.kpiLbl}>Expenses</Text>
                <Text style={[styles.kpiVal, { color: '#c2410c' }]}>{money(data.summary?.total_expenses)}</Text>
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.kpiLbl}>Need to pay</Text>
                <Text style={[styles.kpiVal, { color: '#dc2626' }]}>{money(needToPay)}</Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: '#f0fdf4' }]}>
                <Text style={styles.kpiLbl}>In hand</Text>
                <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{money(inHand)}</Text>
              </View>
            </View>

            {stories.map((story, idx) => {
              const lines = expenseLinesFromItems(story.tripId ? expenseByTrip.get(Number(story.tripId)) : []);
              const calcNeed = Math.round(story.needToPay || 0);
              const calcHand = calcNeed > 0.5 ? 0 : Math.max(0, Math.round(story.balanceInHand || 0));
              return (
                <View key={story.key || idx} style={styles.tripCard}>
                  <Text style={styles.tripHead}>
                    Trip {idx + 1}{story.tripId ? ` #${story.tripId}` : ''}{story.date ? ` · ${formatDateDMY(story.date)}` : ''}
                  </Text>
                  {!!story.lorry && <Text style={styles.meta}>Truck: {story.lorry}</Text>}
                  {!!story.route && <Text style={styles.meta}>Route: {String(story.route)}</Text>}

                  <Text style={styles.sec}>1. Advance given</Text>
                  {(story.advances || []).length === 0 ? (
                    <Text style={styles.muted}>No advance recorded</Text>
                  ) : (
                    (story.advances || []).map((adv: any, i: number) => (
                      <Row
                        key={i}
                        label={`${adv.given_by_role === 'Owner' ? 'Owner' : 'Manager'}: ${adv.given_by_name || '—'}`}
                        value={money(adv.amount)}
                        color="#1d4ed8"
                      />
                    ))
                  )}

                  <Text style={styles.sec}>2. Trip expenses</Text>
                  {lines.map((l) => (
                    <Row key={l.label} label={l.label} value={money(l.amount)} color="#b45309" />
                  ))}
                  <Row label="Total expenses" value={money(story.totalExpenses)} color="#9a3412" />

                  <Text style={styles.sec}>3. Result</Text>
                  {calcNeed > 0.5 ? (
                    <Row label="Need to pay" value={money(calcNeed)} color="#dc2626" />
                  ) : (
                    <Row label="Balance in hand" value={money(calcHand)} color="#16a34a" />
                  )}
                </View>
              );
            })}
            {stories.length === 0 ? (
              <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>No trips on this statement.</Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#e2e8f0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0f172a', paddingRight: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  paper: { padding: 16, paddingBottom: 40 },
  challan: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0f172a',
    borderRadius: 4,
    padding: 16,
  },
  docBrand: { textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1.2 },
  docTitle: { textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  docSub: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  badge: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  infoGrid: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, marginBottom: 8 },
  infoCell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoLbl: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', width: 130 },
  infoVal: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpi: { flex: 1, borderRadius: 10, padding: 10 },
  kpiLbl: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  kpiVal: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    marginTop: 12,
  },
  tripHead: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '600', color: '#475569' },
  sec: { marginTop: 10, marginBottom: 4, fontSize: 11, fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase' },
  muted: { fontSize: 12, color: '#94a3b8' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  rowLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#64748b' },
  rowValue: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
});
