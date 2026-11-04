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
  Modal,
  FlatList,
} from 'react-native';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  UserCheck,
  Trash2,
  X,
  RefreshCw,
  FileText,
  Printer,
  Download,
  Building,
  ChevronDown,
  Check,
  RotateCcw,
  Navigation,
} from 'lucide-react-native';
import {
  adminTruckAdvanceService,
  adminVehicleService,
  adminDriverService,
  adminUserService,
  adminOwnerService,
} from '../../services/adminService';
import { TruckAdvance, Vehicle, Driver, User, Owner } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { printMastersPdf, downloadMastersPdf } from '../../utils/pdfGenerator';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';

const getTripStatusStyle = (status?: string) => {
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
      return { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' };
  }
};

const getTripStatusTextStyle = (status?: string) => {
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

export const AdminTruckAdvancesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [advances, setAdvances] = useState<TruckAdvance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | 'form' | null>(null);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<'print' | 'download' | null>(null);

  // Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [notes, setNotes] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [vRes, dRes, uRes, oRes] = await Promise.all([
        adminVehicleService.getVehicles({ limit: 100, status: 'ACTIVE' }),
        adminDriverService.getDrivers({ limit: 100, status: 'ACTIVE' }),
        adminUserService.getUsers({ limit: 100, status: 'ACTIVE' }),
        adminOwnerService.getOwners({ limit: 200 }),
      ]);
      setVehicles(vRes.data.items || []);
      setDrivers(dRes.data.items || []);
      setManagers((uRes.data.items || []).filter(u => u.role === 'MANAGER' || u.role === 'ADMIN'));
      setOwners(oRes.data.items || []);
    } catch (e) {
      console.warn('Failed to load lookups', e);
    }
  }, []);

  const loadAdvances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminTruckAdvanceService.getTruckAdvances({
        search: search.trim() || undefined,
        owner_id: ownerFilter || undefined,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
        limit: 100,
      });
      setAdvances(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (err: any) {
      console.error('Failed to load truck advances', err);
      Alert.alert('Error', err.message || 'Could not fetch truck advances.');
    } finally {
      setIsLoading(false);
    }
  }, [search, ownerFilter, fromDate, toDate]);

  const filteredOwnersList = React.useMemo(() => {
    const allOption = { id: '', name: 'All Owners', mobile_number: '' };
    const list = owners.map(o => ({ id: String(o.id), name: o.name, mobile_number: (o as any).mobile_number || '' }));
    if (!ownerSearch.trim()) return [allOption, ...list];
    const q = ownerSearch.toLowerCase();
    return [allOption, ...list.filter(o => o.name.toLowerCase().includes(q) || (o.mobile_number && o.mobile_number.includes(q)))];
  }, [owners, ownerSearch]);

  const hasActiveFilters = Boolean(search || ownerFilter || fromDate || toDate);

  const handleClearAllFilters = () => {
    setSearch('');
    setOwnerFilter('');
    setFromDate('');
    setToDate('');
  };

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const openAddModal = () => {
    setSelectedVehicleId(vehicles.length > 0 ? vehicles[0].id : null);
    setSelectedDriverId(null);
    setSelectedManagerId(managers.length > 0 ? managers[0].id : null);
    setAmount('');
    setAdvanceDate(getTodayISO());
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSaveAdvance = async () => {
    if (!selectedVehicleId) return Alert.alert('Required', 'Please select a vehicle/lorry');
    if (!selectedManagerId) return Alert.alert('Required', 'Please select a manager');
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return Alert.alert('Required', 'Enter a valid advance amount');

    try {
      setIsSubmitting(true);
      await adminTruckAdvanceService.createTruckAdvance({
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId || undefined,
        manager_id: selectedManagerId,
        amount: amt,
        advance_date: advanceDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Truck advance recorded successfully.');
      setIsModalOpen(false);
      loadAdvances();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not save truck advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdvance = (adv: TruckAdvance) => {
    Alert.alert(
      'Delete Truck Advance',
      `Delete advance entry #${adv.id} of ${formatCurrency(adv.amount)} for vehicle ${adv.lorry_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminTruckAdvanceService.deleteTruckAdvance(adv.id);
              Alert.alert('Deleted', 'Truck advance entry removed.');
              loadAdvances();
            } catch (e: any) {
              Alert.alert('Delete Failed', e.message);
            }
          },
        },
      ]
    );
  };

  const handlePrintPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading('print');
      await printMastersPdf({
        tab: 'TRUCK_ADVANCES',
        tabLabel: 'Truck Advance Directory',
        truckAdvances: advances,
      });
    } catch (err: any) {
      console.error('Print truck advances PDF failed', err);
      Alert.alert('Print Error', err.message || 'Failed to print truck advances.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading('download');
      const result = await downloadMastersPdf({
        tab: 'TRUCK_ADVANCES',
        tabLabel: 'Truck Advance Directory',
        truckAdvances: advances,
      });
      if (result.success && result.savedDirectly) {
        Alert.alert('PDF Saved', `Truck advances directory saved:\n${result.filename}`);
      }
    } catch (err: any) {
      console.error('Download truck advances PDF failed', err);
      Alert.alert('Download Error', err.message || 'Failed to download PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search & Actions Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search truck number, driver, notes..."
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
            style={[styles.pdfBtn, styles.printBtn, pdfLoading === 'print' && { opacity: 0.7 }]}
            onPress={handlePrintPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'print' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Printer size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>Print</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pdfBtn, styles.downloadBtn, pdfLoading === 'download' && { opacity: 0.7 }]}
            onPress={handleDownloadPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'download' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Download size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Owner Filter Pill + Date Filters + Clear Filter */}
        <View style={{ paddingHorizontal: SPACING.sm, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={[
              {
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: ownerFilter ? '#faf5ff' : '#f1f5f9',
                borderWidth: ownerFilter ? 1 : 0,
                borderColor: ownerFilter ? '#c4b5fd' : 'transparent',
                flexDirection: 'row',
                gap: 5,
                alignItems: 'center',
                alignSelf: 'flex-start',
              },
            ]}
            onPress={() => {
              setOwnerSearch('');
              setIsOwnerPickerOpen(true);
            }}
          >
            <Building size={11} color={ownerFilter ? '#7c3aed' : COLORS.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: ownerFilter ? '#7c3aed' : COLORS.textMuted }}>
              {ownerFilter ? owners.find(o => String(o.id) === ownerFilter)?.name || 'Owner' : 'All Owners'}
            </Text>
            {ownerFilter ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setOwnerFilter('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={11} color="#7c3aed" />
              </TouchableOpacity>
            ) : (
              <ChevronDown size={11} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>

          {/* Date Range Inputs */}
          <View style={styles.dateRangeRow}>
            <TouchableOpacity
              style={[styles.datePickerBtn, fromDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('from')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={fromDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, fromDate ? styles.datePickerBtnTextActive : null]}>
                {fromDate ? toDisplayDate(fromDate) : 'From (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '700' }}>–</Text>
            <TouchableOpacity
              style={[styles.datePickerBtn, toDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('to')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={toDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, toDate ? styles.datePickerBtnTextActive : null]}>
                {toDate ? toDisplayDate(toDate) : 'To (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            {(fromDate || toDate) && (
              <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={handleClearAllFilters}
              activeOpacity={0.7}
            >
              <RotateCcw size={11} color="#dc2626" />
              <Text style={styles.clearFiltersBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Total Summary Banner */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL TRUCK ADVANCES GIVEN</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summarySub}>{total} Entries</Text>
            <TouchableOpacity onPress={loadAdvances} style={styles.reloadBtn}>
              <RefreshCw size={14} color="#b45309" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Advance Records List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Truck Advances...</Text>
        </View>
      ) : advances.length === 0 ? (
        <View style={styles.centerBox}>
          <Truck size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No truck advances found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {advances.map((adv) => (
            <View key={adv.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.truckTag}>
                  <Truck size={16} color="#d97706" />
                  <View>
                    <Text style={styles.lorryNumber}>{adv.lorry_number || `Vehicle #${adv.vehicle_id}`}</Text>
                    {adv.vehicle_type ? (
                      <Text style={styles.vehicleType}>{adv.vehicle_type}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>{formatCurrency(adv.amount)}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Manager:</Text>
                  <Text style={styles.detailValue}>{adv.manager_name || `Manager #${adv.manager_id}`}</Text>
                </View>
                {adv.driver_name ? (
                  <View style={styles.detailItem}>
                    <UserCheck size={12} color={COLORS.textMuted} />
                    <Text style={styles.detailValue}>{adv.driver_name}</Text>
                  </View>
                ) : null}
              </View>

              {/* Owner badge */}
              {adv.owner_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3f0ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 }}>
                  <Building size={10} color="#7c3aed" />
                  <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '700' }}>Owner: {adv.owner_name}</Text>
                </View>
              ) : null}

              {/* Linked Trip Details */}
              {(adv.trip_id || adv.party_name || adv.from_location) ? (
                <View style={styles.tripDetailsBox}>
                  <View style={styles.tripHeaderRow}>
                    <View style={styles.tripIdTag}>
                      <Navigation size={12} color={COLORS.primary} />
                      <Text style={styles.tripIdText}>
                        {adv.trip_id ? `TRIP #${adv.trip_id}` : 'TRIP DETAILS'}
                      </Text>
                    </View>
                    {adv.trip_status ? (
                      <View style={[styles.tripStatusBadge, getTripStatusStyle(adv.trip_status)]}>
                        <Text style={[styles.tripStatusText, getTripStatusTextStyle(adv.trip_status)]}>
                          {adv.trip_status}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {adv.party_name ? (
                    <Text style={styles.tripPartyText} numberOfLines={1}>
                      🏢 Party: <Text style={{ fontWeight: '800' }}>{adv.party_name}</Text>
                    </Text>
                  ) : null}

                  {(adv.from_location || adv.to_location) ? (
                    <Text style={styles.tripRouteText} numberOfLines={1}>
                      📍 Route: {adv.from_location || '—'} → {adv.to_location || '—'}
                    </Text>
                  ) : null}

                  <View style={styles.tripMetricsGrid}>
                    {adv.goods_weight ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Weight</Text>
                        <Text style={styles.tripMetricVal}>
                          {adv.goods_weight} {adv.unit_abbreviation || adv.unit_name || 'MT'}
                        </Text>
                      </View>
                    ) : null}
                    {adv.total_freight ? (
                      <View style={styles.tripMetricItem}>
                        <Text style={styles.tripMetricLabel}>Freight</Text>
                        <Text style={[styles.tripMetricVal, { color: COLORS.primary }]}>
                          {formatCurrency(adv.total_freight)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {adv.trip_date ? (
                    <Text style={styles.tripDateFooter}>
                      📅 Trip Date: {formatDateDMY(adv.trip_date)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Calendar size={12} color={COLORS.textMuted} />
                  <Text style={styles.dateText}>
                    {adv.advance_date ? formatDateDMY(adv.advance_date) : '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.delBtn}
                  onPress={() => handleDeleteAdvance(adv)}
                >
                  <Trash2 size={13} color="#dc2626" />
                  <Text style={styles.delBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>

              {adv.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>Note: {adv.notes}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Truck Advance Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Give Truck Advance</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              {/* Select Vehicle */}
              <Text style={styles.label}>VEHICLE / LORRY *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.selectPill, selectedVehicleId === v.id && styles.selectPillActive]}
                    onPress={() => setSelectedVehicleId(v.id)}
                  >
                    <Text style={[styles.selectPillText, selectedVehicleId === v.id && styles.selectPillTextActive]}>
                      {v.lorry_number}{v.owner_name ? ` (${v.owner_name})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Select Driver (Optional) */}
              <Text style={styles.label}>DRIVER (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.selectPill, selectedDriverId === null && styles.selectPillActive]}
                  onPress={() => setSelectedDriverId(null)}
                >
                  <Text style={[styles.selectPillText, selectedDriverId === null && styles.selectPillTextActive]}>
                    None / Unassigned
                  </Text>
                </TouchableOpacity>
                {drivers.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.selectPill, selectedDriverId === d.id && styles.selectPillActive]}
                    onPress={() => setSelectedDriverId(d.id)}
                  >
                    <Text style={[styles.selectPillText, selectedDriverId === d.id && styles.selectPillTextActive]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Select Manager */}
              <Text style={styles.label}>GIVEN BY (MANAGER / ADMIN) *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {managers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.selectPill, selectedManagerId === m.id && styles.selectPillActive]}
                    onPress={() => setSelectedManagerId(m.id)}
                  >
                    <Text style={[styles.selectPillText, selectedManagerId === m.id && styles.selectPillTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Amount */}
              <Text style={styles.label}>ADVANCE AMOUNT (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Date */}
              <Text style={styles.label}>ADVANCE DATE (DD-MM-YYYY)</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setDatePickerTarget('form')}
              >
                <Text style={{ fontSize: 13, color: advanceDate ? COLORS.text : COLORS.textLight, fontWeight: advanceDate ? '600' : '400' }}>
                  {advanceDate ? toDisplayDate(advanceDate) : 'Select Date (DD-MM-YYYY)'}
                </Text>
                <Calendar size={15} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Notes */}
              <Text style={styles.label}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                placeholder="Reason, diesel fuel reference, etc."
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSaveAdvance}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Advance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Bottom Sheet for Owner Filter Picker */}
      <Modal
        visible={isOwnerPickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsOwnerPickerOpen(false);
          setOwnerSearch('');
        }}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setIsOwnerPickerOpen(false);
            setOwnerSearch('');
          }}
        >
          <View
            style={styles.pickerContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Truck Owner</Text>
              <TouchableOpacity onPress={() => { setIsOwnerPickerOpen(false); setOwnerSearch(''); }}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {owners.length > 4 && (
              <View style={styles.pickerSearchBox}>
                <Search size={14} color={COLORS.textMuted} />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search owner or phone..."
                  placeholderTextColor={COLORS.textMuted}
                  value={ownerSearch}
                  onChangeText={setOwnerSearch}
                  autoCapitalize="none"
                />
                {ownerSearch ? (
                  <TouchableOpacity onPress={() => setOwnerSearch('')}>
                    <X size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <FlatList
              data={filteredOwnersList}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = (item.id === '' && !ownerFilter) || ownerFilter === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setOwnerFilter(item.id);
                      setIsOwnerPickerOpen(false);
                      setOwnerSearch('');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                        {item.name}
                      </Text>
                      {item.mobile_number ? (
                        <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                          📞 {item.mobile_number}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Check size={18} color={COLORS.accentDark} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Date Picker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={
          datePickerTarget === 'from' ? fromDate :
          datePickerTarget === 'to' ? toDate :
          datePickerTarget === 'form' ? advanceDate : ''
        }
        title={
          datePickerTarget === 'from' ? 'Filter: From Date' :
          datePickerTarget === 'to' ? 'Filter: To Date' :
          'Select Advance Date'
        }
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          else if (datePickerTarget === 'form') setAdvanceDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  printBtn: {
    backgroundColor: '#0284c7',
  },
  downloadBtn: {
    backgroundColor: '#059669',
  },
  pdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: RADIUS.lg,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#b45309',
    marginTop: 2,
  },
  summarySub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  reloadBtn: {
    marginTop: 4,
    padding: 4,
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  truckTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lorryNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e40af',
  },
  vehicleType: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#d97706',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  delBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fef2f2',
  },
  delBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: RADIUS.sm,
  },
  notesText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  selectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  selectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectPillTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemSelected: {
    backgroundColor: '#fffbeb',
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerItemTextSelected: {
    color: COLORS.accentDark,
    fontWeight: '800',
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: SPACING.sm,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  clearFiltersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  datePickerBtnActive: {
    backgroundColor: '#eff6ff',
  },
  datePickerBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  datePickerBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tripDetailsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.md,
    padding: 8,
    gap: 3,
    marginTop: 4,
    marginBottom: 2,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tripIdTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tripStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tripStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tripPartyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  tripRouteText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tripMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tripMetricItem: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripMetricLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tripMetricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
  },
  tripDateFooter: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  dateInput: {
    fontSize: 11,
    color: COLORS.text,
    padding: 0,
    minWidth: 90,
    maxWidth: 110,
  },
});
