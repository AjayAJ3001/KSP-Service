import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import {
  Truck,
  User,
  Building2,
  MapPin,
  Scale,
  Calendar,
  ChevronDown,
  Check,
  X,
  Search,
  ArrowRight,
  AlertCircle,
} from 'lucide-react-native';
import { mobileLookupService, mobileTripService } from '../services/mobileService';
import { Vehicle, Driver, Party, Route, Unit, FreightRate } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const NewTripScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Fields
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [goodsWeight, setGoodsWeight] = useState('');
  const [freightRate, setFreightRate] = useState('');
  const [advancePaid, setAdvancePaid] = useState('0');

  // Modal Dropdown State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState<{ id: number; label: string; subLabel?: string }[]>([]);
  const [modalSelectedId, setModalSelectedId] = useState<number | null>(null);
  const [onModalSelect, setOnModalSelect] = useState<(id: number) => void>(() => () => {});
  const [searchQuery, setSearchQuery] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      setIsLoading(true);
      const [vRes, dRes, pRes, rRes, uRes, frRes] = await Promise.all([
        mobileLookupService.getVehicles(),
        mobileLookupService.getDrivers(),
        mobileLookupService.getParties(),
        mobileLookupService.getRoutes(),
        mobileLookupService.getUnits(),
        mobileLookupService.getFreightRates(),
      ]);

      setVehicles(vRes.data.items);
      setDrivers(dRes.data.items);
      setParties(pRes.data.items);
      setRoutes(rRes.data.items);
      setUnits(uRes.data);
      setFreightRates(frRes.data.items);

      // No auto-selection — user must explicitly choose from dropdown
    } catch (err) {
      console.error('Failed to load lookups', err);
      setError('Unable to load master data. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill freight rate when route / unit / party changes
  useEffect(() => {
    if (selectedRouteId && selectedUnitId) {
      let match = freightRates.find(
        (r) => r.route_id === selectedRouteId && r.unit_id === selectedUnitId && r.party_id === selectedPartyId
      );
      if (!match && selectedPartyId) {
        match = freightRates.find((r) => r.route_id === selectedRouteId && r.unit_id === selectedUnitId && !r.party_id);
      }
      if (match) {
        setFreightRate(String(match.rate_per_unit));
      }
    }
  }, [selectedRouteId, selectedUnitId, selectedPartyId, freightRates]);

  const openDropdown = (
    title: string,
    items: { id: number; label: string; subLabel?: string }[],
    currentSelectedId: number | null,
    onSelect: (id: number) => void
  ) => {
    setModalTitle(title);
    setModalItems(items);
    setModalSelectedId(currentSelectedId);
    setOnModalSelect(() => onSelect);
    setSearchQuery('');
    setModalVisible(true);
  };

  const calculateTotalFreight = () => {
    const weight = parseFloat(goodsWeight) || 0;
    const rate = parseFloat(freightRate) || 0;
    return weight * rate;
  };

  const handleSaveAndContinue = async () => {
    if (!selectedVehicleId || !selectedDriverId || !selectedPartyId || !selectedRouteId || !selectedUnitId) {
      setError('Please select Truck Number, Driver Name, Party, Route and Unit.');
      return;
    }
    const weight = parseFloat(goodsWeight);
    if (isNaN(weight) || weight <= 0) {
      setError('Please enter valid goods weight > 0.');
      return;
    }
    const rate = parseFloat(freightRate);
    if (isNaN(rate) || rate < 0) {
      setError('Please enter valid freight rate.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const res = await mobileTripService.createTrip({
        trip_date: tripDate,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        party_id: selectedPartyId,
        route_id: selectedRouteId,
        unit_id: selectedUnitId,
        freight_rate: rate,
        goods_weight: weight,
        advance_paid: parseFloat(advancePaid) || 0,
      });

      const fullTripRes = await mobileTripService.getTripById(res.data.id);
      navigation.navigate('PartyPayment', { trip: fullTripRes.data });
    } catch (err: any) {
      setError(err.message || 'Failed to create trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Selected Item labels
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const filteredModalItems = modalItems.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subLabel && item.subLabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Masters from Admin Panel...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.screenHeading}>New Trip Dispatch Entry</Text>
        <Text style={styles.screenSub}>Assign fleet vehicle, driver, client party & calculate freight</Text>

        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Dispatch Form Card */}
        <View style={styles.card}>
          {/* Trip Date */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Trip Date (YYYY-MM-DD)</Text>
            <View style={styles.inputWithIcon}>
              <Calendar size={18} color={COLORS.accent} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.innerInput}
                value={tripDate}
                onChangeText={setTripDate}
                placeholder="2026-08-30"
              />
            </View>
          </View>

          {/* Truck Number Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Truck Number *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Truck Number',
                  vehicles.map((v) => ({
                    id: v.id,
                    label: v.lorry_number,
                    subLabel: v.goodshed_loading_expense
                      ? `Goodshed Loading Exp: ₹${parseFloat(String(v.goodshed_loading_expense)).toLocaleString('en-IN')}`
                      : undefined,
                  })),
                  selectedVehicleId,
                  (id) => setSelectedVehicleId(id)
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Truck size={18} color={COLORS.accent} />
                <Text style={selectedVehicle ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedVehicle ? selectedVehicle.lorry_number : 'Select Truck'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Driver Name Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Driver Name *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Driver Name',
                  drivers.map((d) => ({
                    id: d.id,
                    label: d.name,
                    subLabel: d.mobile_number ? `Mobile: ${d.mobile_number}` : undefined,
                  })),
                  selectedDriverId,
                  (id) => setSelectedDriverId(id)
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <User size={18} color={COLORS.accent} />
                <Text style={selectedDriver ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedDriver ? selectedDriver.name : 'Select Driver'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Party / Client Name Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Party / Client Name *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Party / Client Account',
                  parties.map((p) => ({
                    id: p.id,
                    label: p.name,
                    subLabel: p.contact_person ? `Contact: ${p.contact_person}` : undefined,
                  })),
                  selectedPartyId,
                  (id) => setSelectedPartyId(id)
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Building2 size={18} color={COLORS.accent} />
                <Text style={selectedParty ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedParty ? selectedParty.name : 'Select Party'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Route Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Route (From → To) *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Dispatch Route',
                  routes.map((r) => ({
                    id: r.id,
                    label: `${r.from_location} → ${r.to_location}`,
                    subLabel: r.distance_km ? `${r.distance_km} KM Distance` : undefined,
                  })),
                  selectedRouteId,
                  (id) => setSelectedRouteId(id)
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <MapPin size={18} color={COLORS.accent} />
                <Text style={selectedRoute ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedRoute ? `${selectedRoute.from_location} → ${selectedRoute.to_location}` : 'Select Route'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Measurement Unit Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Measurement Unit *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Unit',
                  units.map((u) => ({
                    id: u.id,
                    label: u.name,
                    subLabel: u.abbreviation ? `(${u.abbreviation})` : undefined,
                  })),
                  selectedUnitId,
                  (id) => setSelectedUnitId(id)
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Scale size={18} color={COLORS.accent} />
                <Text style={selectedUnit ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedUnit ? `${selectedUnit.name} ${selectedUnit.abbreviation ? `(${selectedUnit.abbreviation})` : ''}` : 'Select Unit'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Goods Weight & Freight Rate */}
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Goods Weight ({selectedUnit?.name || 'Units'}) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
                value={goodsWeight}
                onChangeText={setGoodsWeight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Freight Rate (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1250"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
                value={freightRate}
                onChangeText={setFreightRate}
              />
            </View>
          </View>

          {/* Advance to Driver */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Advance Paid to Driver (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={advancePaid}
              onChangeText={setAdvancePaid}
            />
          </View>
        </View>

        {/* Live Total Freight Calculation Card */}
        <View style={styles.calculationCard}>
          <View>
            <Text style={styles.calcTitle}>TOTAL FREIGHT</Text>
            <Text style={styles.calcFormula}>
              {goodsWeight || 0} {selectedUnit?.name || 'units'} × ₹{freightRate || 0}
            </Text>
          </View>
          <Text style={styles.calcValue}>{formatCurrency(calculateTotalFreight())}</Text>
        </View>

        {/* Save & Continue Button */}
        <TouchableOpacity
          style={[styles.continueBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSaveAndContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.continueBtnText}>SAVE & CONTINUE TO PAYMENT</Text>
              <ArrowRight size={20} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modern Bottom Sheet / Modal Dropdown Picker */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBox}>
              <Search size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={COLORS.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Options List */}
            <FlatList
              data={filteredModalItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = item.id === modalSelectedId;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      onModalSelect(item.id);
                      setModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemLabel, isSelected && styles.modalItemLabelSelected]}>
                        {item.label}
                      </Text>
                      {item.subLabel ? (
                        <Text style={styles.modalItemSubLabel}>{item.subLabel}</Text>
                      ) : null}
                    </View>
                    {isSelected ? <Check size={18} color={COLORS.accent} /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No matching records found.</Text>
              }
              contentContainerStyle={{ paddingBottom: SPACING.xl }}
            />
          </View>
        </View>
      </Modal>
    </View>
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
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  screenSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 13,
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  formRow: {
    marginBottom: SPACING.md,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  inputWithIcon: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  innerInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  dropdownBtn: {
    height: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSelectedText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  calculationCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  calcTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  calcFormula: {
    color: COLORS.white,
    fontSize: 13,
    marginTop: 2,
  },
  calcValue: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  continueBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  continueBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Modal Dropdown Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: RADIUS.md,
  },
  modalItemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalItemLabelSelected: {
    color: COLORS.accent,
  },
  modalItemSubLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyListText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    paddingVertical: SPACING.lg,
    fontSize: 14,
  },
});
