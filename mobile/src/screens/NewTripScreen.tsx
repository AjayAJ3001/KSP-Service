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
  Alert,
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
  ShieldAlert,
  Lock,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mobileLookupService, mobileTripService } from '../services/mobileService';
import { Vehicle, Driver, Party, Route, Unit, FreightRate, RootStackParamList } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTrip'>;

export const NewTripScreen: React.FC<Props> = ({ navigation, route }) => {
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
  const [advancePaid, setAdvancePaid] = useState(
    route?.params?.advancePaid ? String(route.params.advancePaid) : '0'
  );

  // Modal Dropdown State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState<{ id: number; label: string; subLabel?: string }[]>([]);
  const [modalSelectedId, setModalSelectedId] = useState<number | null>(null);
  const [onModalSelect, setOnModalSelect] = useState<(id: number) => void>(() => () => {});
  const [searchQuery, setSearchQuery] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // True when truck was pre-selected from GiveTruckAdvanceScreen — lock it
  const isTruckLocked = !!(route?.params?.preselectedVehicleId);
  // True when advance was pre-filled from GiveTruckAdvanceScreen — lock it
  const isAdvanceLocked = !!(route?.params?.advancePaid);

  useEffect(() => {
    loadLookups();
  }, []);

  // Pre-select truck if we came from GiveTruckAdvanceScreen
  useEffect(() => {
    const preselectedId = route?.params?.preselectedVehicleId;
    if (preselectedId && vehicles.length > 0) {
      setSelectedVehicleId(preselectedId);
    }
  }, [vehicles, route?.params?.preselectedVehicleId]);

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
      if (uRes.data && uRes.data.length > 0) {
        setSelectedUnitId(uRes.data[0].id);
      }
      setFreightRates(frRes.data.items);

      // No auto-selection — user must explicitly choose from dropdown
    } catch (err) {
      console.error('Failed to load lookups', err);
      setError('Unable to load master data. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill freight rate when route or party changes
  useEffect(() => {
    if (selectedRouteId && selectedPartyId) {
      const match = freightRates.find(
        (r) => r.route_id === selectedRouteId && r.party_id === selectedPartyId
      ) || freightRates.find((r) => r.route_id === selectedRouteId && !r.party_id);
      if (match) {
        setFreightRate(String(match.rate_per_unit));
        if (match.unit_id) {
          setSelectedUnitId(match.unit_id);
        }
      }
    }
  }, [selectedRouteId, selectedPartyId, freightRates]);

  const handlePartySelect = (partyId: number) => {
    setSelectedPartyId(partyId);
    setError('');

    // Find all freight rates configured for this specific party
    const partyRates = freightRates.filter((fr) => fr.party_id === partyId);

    if (partyRates.length === 1) {
      // Auto-select the only route configured for this party
      const autoRate = partyRates[0];
      setSelectedRouteId(autoRate.route_id);
      setFreightRate(String(autoRate.rate_per_unit));
      if (autoRate.unit_id) {
        setSelectedUnitId(autoRate.unit_id);
      }
    } else if (partyRates.length > 1) {
      // Check if current route is part of this party's routes
      const currentValid = partyRates.find((fr) => fr.route_id === selectedRouteId);
      if (currentValid) {
        setFreightRate(String(currentValid.rate_per_unit));
        if (currentValid.unit_id) setSelectedUnitId(currentValid.unit_id);
      } else {
        setSelectedRouteId(null);
        setFreightRate('');
      }
    } else {
      // No specific rates configured for this party yet
      setSelectedRouteId(null);
      setFreightRate('');
    }
  };

  const getVehicleComplianceAlerts = (v?: Vehicle | null) => {
    if (!v) return [];
    const alerts: { name: string; date: string; days: number; isExpired: boolean }[] = [];
    const checkDoc = (name: string, dateStr?: string) => {
      if (!dateStr) return;
      try {
        const exp = new Date(dateStr);
        const td = new Date();
        exp.setHours(0, 0, 0, 0);
        td.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp.getTime() - td.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 45) {
          alerts.push({
            name,
            date: dateStr.split('T')[0],
            days,
            isExpired: days < 0,
          });
        }
      } catch {}
    };

    checkDoc('Fitness Certificate (FC)', v.fc_expiry_date);
    checkDoc('Insurance Policy', v.insurance_expiry_date);
    checkDoc('Road Permit', v.permit_expiry_date);
    checkDoc('Yearly Road Tax', v.tax_expiry_date);
    checkDoc('DTS Certificate', v.dts_expiry_date);

    return alerts;
  };

  const handleVehicleSelect = (vehicleId: number) => {
    setSelectedVehicleId(vehicleId);
    setError('');
    const v = vehicles.find((item) => item.id === vehicleId);
    if (v) {
      const alerts = getVehicleComplianceAlerts(v);
      if (alerts.length > 0) {
        const hasExpired = alerts.some((a) => a.isExpired);
        const alertMsg = alerts
          .map((a) => `• ${a.name}: ${a.isExpired ? 'EXPIRED (' + a.date + ')' : 'Expires in ' + a.days + ' days (' + a.date + ')'}`)
          .join('\n');
        Alert.alert(
          hasExpired ? '⚠️ Truck Compliance Expired!' : '⚠️ Compliance Notice (≤ 45 Days)',
          `Truck ${v.lorry_number} has ${alerts.length} compliance document(s) requiring attention:\n\n${alertMsg}\n\nPlease inform admin or ensure renewal before dispatch.`,
          [
            {
              text: 'Choose Another Truck',
              style: 'cancel',
              onPress: () => setSelectedVehicleId(null),
            },
            {
              text: 'Acknowledge & Proceed',
              style: 'default',
            },
          ]
        );
      }
    }
  };

  const handleDriverSelect = (driverId: number) => {
    setSelectedDriverId(driverId);
    setError('');
    const selDriver = drivers.find((d) => d.id === driverId);
    if (selDriver && selDriver.license_expiry_date) {
      try {
        const exp = new Date(selDriver.license_expiry_date);
        const td = new Date();
        exp.setHours(0, 0, 0, 0);
        td.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp.getTime() - td.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 45) {
          const isExp = days < 0;
          const formattedDate = selDriver.license_expiry_date.split('T')[0];
          Alert.alert(
            isExp ? '⚠️ Driving License Expired!' : '⚠️ License Expiring Soon!',
            `Driver ${selDriver.name}'s license ${
              isExp
                ? `expired on ${formattedDate} (${Math.abs(days)} days ago).`
                : `expires on ${formattedDate} (${days} days remaining).`
            }\n\nPlease remind the driver to start the renewal process.`,
            [
              {
                text: 'Choose Another Driver',
                style: 'cancel',
                onPress: () => setSelectedDriverId(null),
              },
              {
                text: 'Acknowledge & Proceed',
                style: 'default',
              },
            ]
          );
        }
      } catch (e) {
        console.error('Date error', e);
      }
    }
  };

  const handleRouteDropdownPress = () => {
    if (!selectedPartyId) {
      setError('Please select a Party / Client Account first to see their assigned routes.');
      return;
    }

    // Filter routes specifically configured for this selected party
    const partyRates = freightRates.filter((fr) => fr.party_id === selectedPartyId);

    let routeItems: { id: number; label: string; subLabel?: string }[] = [];

    if (partyRates.length > 0) {
      routeItems = partyRates.map((fr) => {
        const route = routes.find((r) => r.id === fr.route_id);
        const fromLoc = route?.from_location || fr.from_location || 'Origin';
        const toLoc = route?.to_location || fr.to_location || 'Destination';
        const unit = units.find((u) => u.id === fr.unit_id);
        const unitName = unit ? unit.name : (fr.unit_name || 'Unit');
        return {
          id: fr.route_id,
          label: `${fromLoc} → ${toLoc}`,
          subLabel: `Rate: ₹${parseFloat(String(fr.rate_per_unit)).toLocaleString('en-IN')} / ${unitName}${
            route?.distance_km ? ` • ${route.distance_km} KM` : ''
          }`,
        };
      });
    } else {
      // Fallback: If no party-specific rates are created, show all active routes
      routeItems = routes.map((r) => ({
        id: r.id,
        label: `${r.from_location} → ${r.to_location}`,
        subLabel: r.distance_km ? `${r.distance_km} KM Distance` : undefined,
      }));
    }

    openDropdown(
      `Routes for ${selectedParty?.name || 'Selected Party'}`,
      routeItems,
      selectedRouteId,
      (id) => {
        setSelectedRouteId(id);
        setError('');
        const match = freightRates.find(
          (fr) => fr.route_id === id && fr.party_id === selectedPartyId
        ) || freightRates.find((fr) => fr.route_id === id && !fr.party_id) || freightRates.find((fr) => fr.route_id === id);

        if (match) {
          setFreightRate(String(match.rate_per_unit));
          if (match.unit_id) {
            setSelectedUnitId(match.unit_id);
          }
        }
      }
    );
  };

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
    if (!selectedVehicleId || !selectedDriverId || !selectedPartyId || !selectedRouteId) {
      setError('Please select Truck Number, Driver Name, Party, and Route.');
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
      const defaultUnitId = selectedUnitId || (units.length > 0 ? units[0].id : 1);
      const res = await mobileTripService.createTrip({
        trip_date: tripDate,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        party_id: selectedPartyId,
        route_id: selectedRouteId,
        unit_id: defaultUnitId,
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

          {/* Truck Number — locked if pre-selected from advance screen */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Truck Number *</Text>
            {isTruckLocked ? (
              <View style={[styles.dropdownBtn, styles.dropdownLocked]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <Truck size={18} color={COLORS.accent} />
                  <Text style={styles.dropdownSelectedText}>
                    {selectedVehicle ? selectedVehicle.lorry_number : '...'}
                  </Text>
                </View>
                <Lock size={15} color={COLORS.textMuted} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() =>
                  openDropdown(
                    'Select Truck Number',
                    vehicles.map((v) => {
                      const alerts = getVehicleComplianceAlerts(v);
                      let sub = v.goodshed_loading_expense
                        ? `Goodshed Loading Exp: ₹${parseFloat(String(v.goodshed_loading_expense)).toLocaleString('en-IN')}`
                        : '';
                      if (alerts.length > 0) {
                        const expCount = alerts.filter((a) => a.isExpired).length;
                        const soonCount = alerts.length - expCount;
                        const alertTag = expCount > 0
                          ? `⚠️ ${expCount} Expired Doc(s)`
                          : `⚠️ ${soonCount} Expiring in ≤45d`;
                        sub = sub ? `${sub} • ${alertTag}` : alertTag;
                      }
                      return {
                        id: v.id,
                        label: v.lorry_number,
                        subLabel: sub || undefined,
                      };
                    }),
                    selectedVehicleId,
                    (id) => handleVehicleSelect(id)
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
            )}

            {/* Selected Truck 45-day Compliance Alert Banner */}
            {selectedVehicle && (() => {
              const alerts = getVehicleComplianceAlerts(selectedVehicle);
              if (alerts.length === 0) return null;
              const hasExpired = alerts.some((a) => a.isExpired);
              return (
                <View
                  style={{
                    marginTop: 10,
                    backgroundColor: hasExpired ? '#fef2f2' : '#fffbeb',
                    borderColor: hasExpired ? '#fca5a5' : '#fde68a',
                    borderWidth: 1.5,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <ShieldAlert size={16} color={hasExpired ? '#dc2626' : '#d97706'} />
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        color: hasExpired ? '#991b1b' : '#92400e',
                      }}
                    >
                      {hasExpired ? '⚠️ Compliance Warning — Expired Documents' : '⚠️ Expiry Notice (Within 45 Days)'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: hasExpired ? '#b91c1c' : '#b45309', marginBottom: 6 }}>
                    Truck {selectedVehicle.lorry_number} has {alerts.length} document(s) needing renewal:
                  </Text>
                  {alerts.map((a, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: a.isExpired ? '#dc2626' : '#d97706' }}>
                        {a.isExpired ? '❌' : '⏳'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '600',
                          color: a.isExpired ? '#991b1b' : '#92400e',
                        }}
                      >
                        {a.name}:{' '}
                        <Text style={{ fontWeight: 'normal' }}>
                          {a.isExpired ? `EXPIRED (${a.date})` : a.days === 0 ? `Expires Today (${a.date})` : `Expires in ${a.days}d (${a.date})`}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>

          {/* Driver Name Dropdown */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Driver Name *</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Driver Name',
                  drivers.map((d) => {
                    let sub = d.mobile_number ? `Mobile: ${d.mobile_number}` : '';
                    if (d.license_expiry_date) {
                      try {
                        const exp = new Date(d.license_expiry_date);
                        const td = new Date();
                        exp.setHours(0, 0, 0, 0);
                        td.setHours(0, 0, 0, 0);
                        const diff = Math.ceil((exp.getTime() - td.getTime()) / (1000 * 60 * 60 * 24));
                        if (diff < 0) {
                          sub += `${sub ? ' • ' : ''}⚠️ EXPIRED (${d.license_expiry_date.split('T')[0]})`;
                        } else if (diff <= 45) {
                          sub += `${sub ? ' • ' : ''}⚠️ Expires in ${diff}d (${d.license_expiry_date.split('T')[0]})`;
                        }
                      } catch {}
                    }
                    return {
                      id: d.id,
                      label: d.name,
                      subLabel: sub || undefined,
                    };
                  }),
                  selectedDriverId,
                  (id) => handleDriverSelect(id)
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

            {(() => {
              if (selectedDriver && selectedDriver.license_expiry_date) {
                try {
                  const exp = new Date(selectedDriver.license_expiry_date);
                  const td = new Date();
                  exp.setHours(0, 0, 0, 0);
                  td.setHours(0, 0, 0, 0);
                  const diff = Math.ceil((exp.getTime() - td.getTime()) / (1000 * 60 * 60 * 24));
                  if (diff < 0) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#fef2f2', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' }}>
                        <AlertCircle size={14} color="#dc2626" />
                        <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '700' }}>
                          License EXPIRED ({selectedDriver.license_expiry_date.split('T')[0]})
                        </Text>
                      </View>
                    );
                  } else if (diff <= 45) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#fffbeb', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fde047' }}>
                        <AlertCircle size={14} color="#d97706" />
                        <Text style={{ fontSize: 12, color: '#b45309', fontWeight: '700' }}>
                          License expires in {diff} day{diff === 1 ? '' : 's'} ({selectedDriver.license_expiry_date.split('T')[0]})
                        </Text>
                      </View>
                    );
                  }
                } catch {}
              }
              return null;
            })()}
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
                  (id) => handlePartySelect(id)
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

          {/* Route Dropdown (Filtered to Selected Party) */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Route (From → To) *</Text>
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                !selectedPartyId && { backgroundColor: COLORS.surface, borderColor: COLORS.border }
              ]}
              onPress={handleRouteDropdownPress}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <MapPin size={18} color={selectedPartyId ? COLORS.accent : COLORS.textLight} />
                <Text style={selectedRoute ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                  {selectedRoute
                    ? `${selectedRoute.from_location} → ${selectedRoute.to_location}`
                    : selectedPartyId
                    ? 'Select Route for ' + (selectedParty?.name || 'Party')
                    : 'Select Party first...'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Goods Weight & Freight Rate */}
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                Goods Weight ({selectedUnit ? selectedUnit.name : 'Tons'}) *
              </Text>
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
            {isAdvanceLocked ? (
              <View style={[styles.input, styles.lockedInput]}>
                <Lock size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.lockedInputText}>₹{parseFloat(advancePaid).toLocaleString('en-IN')}</Text>
                <Text style={styles.lockedInputNote}> · Paid via truck advance</Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
                value={advancePaid}
                onChangeText={setAdvancePaid}
              />
            )}
          </View>
        </View>

        {/* Live Total Freight Calculation Card */}
        <View style={styles.calculationCard}>
          <View>
            <Text style={styles.calcTitle}>TOTAL FREIGHT</Text>
            <Text style={styles.calcFormula}>
              {goodsWeight || 0} {selectedUnit ? selectedUnit.name : 'Tons'} × ₹{freightRate || 0}
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
  dropdownLocked: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  lockedInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef9ec',
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
    opacity: 0.9,
  },
  lockedInputText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  lockedInputNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
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
