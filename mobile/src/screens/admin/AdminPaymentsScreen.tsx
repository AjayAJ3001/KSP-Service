import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import {
  CreditCard,
  Search,
  Truck,
  Building2,
  X,
  ChevronDown,
  Check,
  RotateCcw,
  Calendar,
  Share2,
  Download,
  Printer,
} from 'lucide-react-native';
import { adminTripService, adminOwnerService, adminVehicleService } from '../../services/adminService';
import { Trip, Owner, Vehicle } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';
import { printTripPdf, shareTripPdf, downloadTripPdf } from '../../utils/pdfGenerator';

type StatusFilter = 'ALL' | 'PAYMENT_PENDING' | 'PARTIALLY_PAID' | 'SETTLED';

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
};

export const AdminPaymentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [pickerModalType, setPickerModalType] = useState<'owner' | 'vehicle' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const availableVehicles = useMemo(() => {
    if (!ownerFilter) return vehicles;
    return vehicles.filter((v) => String(v.owner_id) === String(ownerFilter));
  }, [vehicles, ownerFilter]);

  const loadLookups = useCallback(async () => {
    try {
      const [oRes, vRes] = await Promise.all([
        adminOwnerService.getOwners({ limit: 200 }),
        adminVehicleService.getVehicles({ limit: 500 }),
      ]);
      setOwners(oRes.data.items || []);
      setVehicles(vRes.data.items || []);
    } catch {
      // lookups are optional
    }
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminTripService.getTrips({
        limit: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        owner_id: ownerFilter || undefined,
        vehicle_id: vehicleFilter || undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
      });
      setTrips(res.data.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not fetch party payments.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, ownerFilter, vehicleFilter, fromDate, toDate]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const filteredTrips = trips.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.lorry_number?.toLowerCase().includes(q) ||
      t.party_name?.toLowerCase().includes(q) ||
      t.driver_name?.toLowerCase().includes(q)
    );
  });

  const hasActiveFilters = Boolean(search || statusFilter !== 'ALL' || ownerFilter || vehicleFilter || fromDate || toDate);

  const handlePrintTrip = async (t: Trip) => {
    try {
      setPdfLoading(`print_${t.id}`);
      await printTripPdf(t);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not print trip PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleShareTrip = async (t: Trip) => {
    try {
      setPdfLoading(`share_${t.id}`);
      await shareTripPdf(t);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share trip PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadTrip = async (t: Trip) => {
    try {
      setPdfLoading(`download_${t.id}`);
      const result = await downloadTripPdf(t);
      if (result.savedDirectly) {
        Alert.alert('Download Successful', `Trip PDF saved as:\n${result.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not download trip PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.searchBar}>
          <Search size={14} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search party, truck, driver..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {hasActiveFilters ? (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setStatusFilter('ALL');
                setOwnerFilter('');
                setVehicleFilter('');
                setFromDate('');
                setToDate('');
              }}
            >
              <RotateCcw size={14} color="#dc2626" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {(['ALL', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'SETTLED'] as StatusFilter[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s === 'ALL' ? 'All' : s.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setPickerModalType('owner')}>
            <Building2 size={14} color="#7c3aed" />
            <Text style={styles.dropdownText} numberOfLines={1}>
              {owners.find((o) => String(o.id) === ownerFilter)?.name || 'My Owners'}
            </Text>
            <ChevronDown size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setPickerModalType('vehicle')}>
            <Truck size={14} color={COLORS.primary} />
            <Text style={styles.dropdownText} numberOfLines={1}>
              {vehicles.find((v) => String(v.id) === vehicleFilter)?.lorry_number || 'My Trucks'}
            </Text>
            <ChevronDown size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRangeRow}>
          <Calendar size={12} color={COLORS.textMuted} />
          <TouchableOpacity onPress={() => setDatePickerTarget('from')}>
            <Text style={styles.datePickerBtnText}>{fromDate ? toDisplayDate(fromDate) : 'From'}</Text>
          </TouchableOpacity>
          <Text style={styles.datePickerBtnText}>–</Text>
          <TouchableOpacity onPress={() => setDatePickerTarget('to')}>
            <Text style={styles.datePickerBtnText}>{toDate ? toDisplayDate(toDate) : 'To'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : filteredTrips.length === 0 ? (
        <View style={styles.centerBox}>
          <CreditCard size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No party payments found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredTrips.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.lorryText}>{t.lorry_number}</Text>
                <Text style={styles.statusText}>{t.status}</Text>
              </View>
              <Text style={styles.partyText}>{t.party_name}</Text>
              <Text style={styles.metaText}>
                {formatDateDMY(t.trip_date)} • {t.driver_name || 'No driver'}
              </Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Freight</Text>
                  <Text style={styles.metricVal}>{formatCurrency(t.total_freight)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Received</Text>
                  <Text style={[styles.metricVal, { color: '#10b981' }]}>{formatCurrency(t.total_received || 0)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Balance</Text>
                  <Text style={[styles.metricVal, { color: '#ef4444' }]}>{formatCurrency(t.balance_due || 0)}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}
                  onPress={() => handlePrintTrip(t)}
                  disabled={pdfLoading !== null}
                >
                  {pdfLoading === `print_${t.id}` ? (
                    <ActivityIndicator size="small" color="#1d4ed8" />
                  ) : (
                    <Printer size={13} color="#1d4ed8" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#1d4ed8' }]}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#ecfdf5', borderColor: '#86efac' }]}
                  onPress={() => handleShareTrip(t)}
                  disabled={pdfLoading !== null}
                >
                  {pdfLoading === `share_${t.id}` ? (
                    <ActivityIndicator size="small" color="#047857" />
                  ) : (
                    <Share2 size={13} color="#047857" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#047857' }]}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#0f172a', borderColor: '#0f172a' }]}
                  onPress={() => handleDownloadTrip(t)}
                  disabled={pdfLoading !== null}
                >
                  {pdfLoading === `download_${t.id}` ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Download size={13} color="#fff" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'from' ? fromDate : toDate}
        title={datePickerTarget === 'from' ? 'From Date' : 'To Date'}
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />

      <Modal visible={pickerModalType !== null} animationType="slide" transparent onRequestClose={() => setPickerModalType(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerModalType(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerModalType === 'owner' ? 'Select Owner' : 'Select Truck'}</Text>
              <TouchableOpacity onPress={() => setPickerModalType(null)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {((pickerModalType === 'owner' && owners.length > 4) || (pickerModalType === 'vehicle' && availableVehicles.length > 4)) && (
              <View style={styles.searchBar}>
                <Search size={14} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={modalSearch}
                  onChangeText={setModalSearch}
                />
              </View>
            )}
            <FlatList
              data={
                pickerModalType === 'owner'
                  ? [{ id: '', name: 'All Owners' }, ...owners.filter((o) => o.name.toLowerCase().includes(modalSearch.toLowerCase()))]
                  : [
                      { id: '', lorry_number: 'All Trucks' },
                      ...availableVehicles.filter((v) => v.lorry_number.toLowerCase().includes(modalSearch.toLowerCase())),
                    ]
              }
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (pickerModalType === 'owner') {
                      setOwnerFilter(String(item.id || ''));
                      setVehicleFilter('');
                    } else {
                      setVehicleFilter(String(item.id || ''));
                    }
                    setPickerModalType(null);
                    setModalSearch('');
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name || item.lorry_number}</Text>
                  <Check size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerSection: { backgroundColor: COLORS.white, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 7 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  chipRow: { flexDirection: 'row' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: '#f1f5f9', marginRight: 6 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.white },
  filterRow: { flexDirection: 'row', gap: 8 },
  dropdownBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#fff' },
  dropdownText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datePickerBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  centerText: { marginTop: 10, fontSize: 13, color: COLORS.textMuted },
  listContainer: { padding: SPACING.md, gap: 8, paddingBottom: 28 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  lorryText: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  statusText: { fontSize: 11, fontWeight: '800', color: '#b45309' },
  partyText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  metaText: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  metricsGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: RADIUS.md, padding: 8, marginBottom: 8 },
  metricItem: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },
  metricVal: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1d4ed8', paddingVertical: 8, borderRadius: RADIUS.md },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.md, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});
