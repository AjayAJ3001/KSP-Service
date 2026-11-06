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
  Image,
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
  Camera,
  ScanLine,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mobileLookupService, mobileTripService } from '../services/mobileService';
import { Vehicle, Driver, Party, Route, Unit, FreightRate, RootStackParamList } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { ComplianceAlertModal, ComplianceDoc } from '../components/ComplianceAlertModal';
import { AppNoticeModal, AppNoticeModalProps, NoticeKind } from '../components/AppNoticeModal';
import { formatDateDMY } from '../utils/dateUtils';
import { billMatchesTrip } from '../utils/weighBillMatch';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTrip'>;

export const NewTripScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const canManualEntry = String(user?.role || '').toUpperCase() === 'ADMIN';
  const [weightEntryMode, setWeightEntryMode] = useState<'upload' | 'manual'>('upload');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Fields
  const [tripDate, setTripDate] = useState(formatDateDMY(new Date()));

  const handleTripDateChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    setTripDate(formatted);
  };
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    route?.params?.preselectedVehicleId ?? null
  );
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(
    route?.params?.preselectedDriverId ?? null
  );
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [goodsWeight, setGoodsWeight] = useState('');
  const [weighBill, setWeighBill] = useState<{
    preview: string;
    hash: string;
    slip_no: string | null;
    vehicle_no: string | null;
    heading_name: string | null;
    party_name: string | null;
    unit_name: string | null;
    bill_date: string | null;
    net_weight_mt: number | null;
    accepted_weight_mt: number | null;
    weight_source: 'ACCEPTED' | 'NET' | null;
  } | null>(null);
  const [isReadingBill, setIsReadingBill] = useState(false);
  const [freightRate, setFreightRate] = useState('');
  const [advancePaid, setAdvancePaid] = useState(
    route?.params?.advancePaid ? String(route.params.advancePaid) : '0'
  );
  const [draftTripId, setDraftTripId] = useState<number | null>(
    route?.params?.draftTripId ?? null
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
  const [notice, setNotice] = useState<Omit<AppNoticeModalProps, 'visible'> & { visible: boolean }>({
    visible: false,
    kind: 'error',
    title: '',
    message: '',
  });

  const closeNotice = () => setNotice((prev) => ({ ...prev, visible: false, actions: undefined }));

  const showNotice = (
    kind: NoticeKind,
    title: string,
    message: string,
    extra?: Partial<AppNoticeModalProps>
  ) => {
    setNotice({
      visible: true,
      kind,
      title,
      message,
      onClose: extra?.onClose ?? closeNotice,
      ...extra,
    });
  };


  // Compliance Alert Modal State
  const [complianceModal, setComplianceModal] = useState<{
    visible: boolean;
    type: 'VEHICLE' | 'DRIVER';
    entityName: string;
    documents: ComplianceDoc[];
    notice?: string;
    onProceed: () => void;
    onCancel: () => void;
  }>({
    visible: false,
    type: 'VEHICLE',
    entityName: '',
    documents: [],
    onProceed: () => {},
    onCancel: () => {},
  });
  // Pre-selected indicators from GiveTruckAdvanceScreen (editable, not locked)
  const hasPreselectedTruck = !!(route?.params?.preselectedVehicleId);
  const hasPreselectedAdvance = !!(route?.params?.advancePaid);

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

  // Pre-select driver if we came from GiveTruckAdvanceScreen
  useEffect(() => {
    const preselectedDriver = route?.params?.preselectedDriverId;
    if (preselectedDriver && drivers.length > 0) {
      setSelectedDriverId(preselectedDriver);
    }
  }, [drivers, route?.params?.preselectedDriverId]);

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
        if (days <= 30) {
          alerts.push({
            name,
            date: formatDateDMY(dateStr),
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
    checkDoc('RC (Registration)', v.rc_expiry_date);
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
        setComplianceModal({
          visible: true,
          type: 'VEHICLE',
          entityName: v.lorry_number,
          documents: alerts,
          notice: 'Please inform admin or ensure valid renewal documents before dispatching on highway.',
          onProceed: () => {
            setComplianceModal((prev) => ({ ...prev, visible: false }));
          },
          onCancel: () => {
            setSelectedVehicleId(null);
            setComplianceModal((prev) => ({ ...prev, visible: false }));
          },
        });
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
        if (days <= 30) {
          const isExp = days < 0;
          const formattedDate = formatDateDMY(selDriver.license_expiry_date);
          setComplianceModal({
            visible: true,
            type: 'DRIVER',
            entityName: selDriver.name,
            documents: [
              {
                name: 'Commercial Driving License',
                date: formattedDate,
                days,
                isExpired: isExp,
              },
            ],
            notice: 'Please remind the driver to complete license renewal to maintain legal highway compliance.',
            onProceed: () => {
              setComplianceModal((prev) => ({ ...prev, visible: false }));
            },
            onCancel: () => {
              setSelectedDriverId(null);
              setComplianceModal((prev) => ({ ...prev, visible: false }));
            },
          });
        }
      } catch (e) {
        console.error('Date error', e);
      }
    }
  };

  const handleRouteDropdownPress = () => {
    if (!selectedPartyId) {
      setError('Please select a Party / Client Account first to see their assigned units.');
      return;
    }

    // Filter units specifically configured for this selected party
    const partyRates = freightRates.filter((fr) => fr.party_id === selectedPartyId);

    let routeItems: { id: number; label: string; subLabel?: string }[] = [];

    if (partyRates.length > 0) {
      routeItems = partyRates.map((fr) => {
        const route = routes.find((r) => r.id === fr.route_id);
        const fromLoc = route?.from_location || fr.from_location || 'Origin';
        const toLoc = route?.to_location || fr.to_location || 'Unit';
        const unit = units.find((u) => u.id === fr.unit_id);
        const unitName = unit ? unit.name : (fr.unit_name || 'Unit');
        return {
          id: fr.route_id,
          label: toLoc,
          subLabel: `From: ${fromLoc} • Rate: ₹${parseFloat(String(fr.rate_per_unit)).toLocaleString('en-IN')} / ${unitName}${
            route?.distance_km ? ` • ${route.distance_km} KM` : ''
          }`,
        };
      });
    } else {
      // Fallback: If no party-specific rates are created, show all active routes/units
      routeItems = routes.map((r) => ({
        id: r.id,
        label: r.to_location,
        subLabel: `From: ${r.from_location}${r.distance_km ? ` • ${r.distance_km} KM` : ''}`,
      }));
    }

    openDropdown(
      `Units for ${selectedParty?.name || 'Selected Party'}`,
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
    return Math.round(weight * rate);
  };

  const tripSelectionForBill = () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const party = parties.find((p) => p.id === selectedPartyId);
    const route = routes.find((r) => r.id === selectedRouteId);
    return {
      selectedTruck: vehicle?.lorry_number || null,
      selectedParty: party?.name || null,
      selectedUnit: route?.to_location || route?.from_location || null,
    };
  };

  const rejectBill = (title: string, message: string) => {
    setWeighBill(null);
    setGoodsWeight('');
    setError(message);
    showNotice('error', title, message, {
      actions: [
        {
          label: 'Upload Another Bill',
          onPress: () => {
            closeNotice();
            promptBillUpload();
          },
        },
        { label: 'Close', onPress: closeNotice, variant: 'ghost' },
      ],
    });
  };

  const readBillFromUri = async (dataUri: string | null) => {
    if (!dataUri) return;
    const selection = tripSelectionForBill();
    if (!selection.selectedTruck || !selection.selectedParty || !selection.selectedUnit) {
      rejectBill(
        'Select Trip Details First',
        'Select truck number, party, and unit first. Then upload the weighment bill so truck and unit can be checked.'
      );
      return;
    }
    try {
      setIsReadingBill(true);
      setError('');
      showNotice('loading', 'Reading Bill', 'Reading weight from bill...');
      const res = await mobileTripService.parseWeighBill({
        image_base64: dataUri,
        exclude_trip_id: draftTripId || undefined,
        expected_vehicle_no: selection.selectedTruck || undefined,
        expected_party_name: selection.selectedParty || undefined,
        expected_unit_name: selection.selectedUnit || undefined,
      });
      const data = res.data;
      if (!data?.goods_weight) {
        rejectBill('Bill Not Readable', 'Could not read weight. Capture Net Weight, Nett Weight, or Accepted Qty clearly.');
        return;
      }
      const match = billMatchesTrip({
        ...selection,
        billTruck: data.vehicle_no,
        billParty: data.party_name,
        billUnit: data.unit_name,
        billHeading: data.heading_name,
        billOcr: data.ocr_preview,
      });
      if (!match.ok) {
        rejectBill(match.title, match.message);
        return;
      }
      setWeighBill({
        preview: data.weigh_bill_image || dataUri,
        hash: data.weigh_bill_hash,
        slip_no: data.slip_no,
        vehicle_no: data.vehicle_no,
        heading_name: data.heading_name,
        party_name: data.party_name,
        unit_name: data.unit_name,
        bill_date: data.bill_date,
        net_weight_mt: data.net_weight_mt,
        accepted_weight_mt: data.accepted_weight_mt,
        weight_source: data.weight_source,
      });
      setGoodsWeight(String(data.goods_weight));
      const weightLabel = data.weight_source === 'ACCEPTED' ? 'Accepted qty' : 'Net weight';
      const extra = [
        `${weightLabel} ${data.goods_weight} MT`,
        data.bill_date ? `Bill date ${data.bill_date}` : '',
        data.vehicle_no ? `Truck / Vehicle No ${data.vehicle_no}` : '',
      ].filter(Boolean).join('  ·  ');
      showNotice(
        'success',
        'Trip Entry Can Start',
        'Truck, party and unit match the bill. Weight is filled for the trip.',
        {
          detail: extra,
          actions: [{ label: 'Continue Trip Entry', onPress: closeNotice }],
        }
      );
    } catch (err: any) {
      setWeighBill(null);
      setGoodsWeight('');
      const msg = err.message || 'Failed to read weighment bill.';
      setError(msg);
      showBillError(msg);
    } finally {
      setIsReadingBill(false);
    }
  };

  const pickBillImage = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showNotice('warning', 'Gallery Permission Required', 'Allow gallery access to upload the weighment bill.', {
        actions: [{ label: 'OK', onPress: closeNotice }],
      });
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.42,
      base64: true,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  };

  const takeBillPhoto = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showNotice('warning', 'Camera Permission Required', 'Allow camera access to capture the weighment bill.', {
        actions: [{ label: 'OK', onPress: closeNotice }],
      });
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.42,
      base64: true,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  };

  const promptBillUpload = () => {
    const selection = tripSelectionForBill();
    if (!selection.selectedTruck || !selection.selectedParty || !selection.selectedUnit) {
      showNotice(
        'warning',
        'Select Trip Details First',
        'Select truck number, party, and unit first. Then upload the weighment bill.',
        { actions: [{ label: 'OK', onPress: closeNotice }] }
      );
      return;
    }
    showNotice(
      'upload',
      'Upload Weighment Bill',
      'Take or choose a clear photo of the slip. Weight is taken from Net Weight, Nett Weight, or Accepted Qty.',
      {
        actions: [
          {
            label: 'Camera',
            onPress: async () => {
              closeNotice();
              await readBillFromUri(await takeBillPhoto());
            },
          },
          {
            label: 'Gallery',
            onPress: async () => {
              closeNotice();
              await readBillFromUri(await pickBillImage());
            },
            variant: 'secondary',
          },
          { label: 'Cancel', onPress: closeNotice, variant: 'ghost' },
        ],
      }
    );
  };

  useEffect(() => {
    if (!weighBill) return;
    const selection = tripSelectionForBill();
    const match = billMatchesTrip({
      ...selection,
      billTruck: weighBill.vehicle_no,
      billParty: weighBill.party_name,
      billUnit: weighBill.unit_name,
      billHeading: weighBill.heading_name,
    });
    if (!match.ok) {
      setWeighBill(null);
      setGoodsWeight('');
      setError(match.message);
      showNotice('error', match.title, match.message, {
        actions: [{ label: 'OK', onPress: closeNotice }],
      });
    }
  }, [selectedVehicleId, selectedPartyId, selectedRouteId]);

  const showBillError = (raw: string) => {
    const msg = raw || 'Unable to process the weighment bill.';
    const isDup = /duplicate|already used on trip/i.test(msg);
    const isNet = /network|timeout|reach server|econn/i.test(msg);
    const isRead = /could not read|clearer|net weight|accepted qty|nett/i.test(msg);
    showNotice(
      isDup || isNet ? 'error' : 'warning',
      isDup ? 'Duplicate Bill' : isNet ? 'Connection Failed' : isRead ? 'Bill Not Readable' : 'Bill Upload Failed',
      isDup
        ? msg
        : isRead
        ? 'Weight could not be read. Capture Net Weight, Nett Weight, or Accepted Qty and try again.'
        : msg,
      {
        detail: isDup ? msg : undefined,
        actions: [
          {
            label: isDup || isRead ? 'Upload Another Bill' : 'Try Again',
            onPress: () => {
              closeNotice();
              promptBillUpload();
            },
          },
          { label: 'Close', onPress: closeNotice, variant: 'ghost' },
        ],
      }
    );
  };

  const handleSaveAndContinue = async () => {
    if (!selectedVehicleId || !selectedDriverId || !selectedPartyId || !selectedRouteId) {
      const msg = 'Please select Truck Number, Driver Name, Party, and Route.';
      setError(msg);
      showNotice('warning', 'Incomplete Trip Details', msg, {
        actions: [{ label: 'OK', onPress: closeNotice }],
      });
      return;
    }
    const usingManualWeight = canManualEntry && (weightEntryMode === 'manual' || !weighBill?.hash);
    if (!usingManualWeight && !weighBill?.hash) {
      const msg = 'Upload the weighment bill. Weight is taken from Net Weight, Nett Weight, or Accepted Qty.';
      setError(msg);
      showNotice('warning', 'Bill Required', msg, {
        actions: [
          { label: 'Upload Bill', onPress: () => { closeNotice(); promptBillUpload(); } },
          { label: 'Close', onPress: closeNotice, variant: 'ghost' },
        ],
      });
      return;
    }
    if (weighBill?.hash) {
      const billMatch = billMatchesTrip({
        ...tripSelectionForBill(),
        billTruck: weighBill.vehicle_no,
        billParty: weighBill.party_name,
        billUnit: weighBill.unit_name,
        billHeading: weighBill.heading_name,
      });
      if (!billMatch.ok) {
        setError(billMatch.message);
        showNotice('error', billMatch.title, billMatch.message, {
          actions: [{ label: 'OK', onPress: closeNotice }],
        });
        return;
      }
    }
    const weight = parseFloat(goodsWeight);
    if (isNaN(weight) || weight <= 0) {
      const msg = usingManualWeight
        ? 'Enter the trip weight.'
        : 'Bill weight could not be read. Upload a clearer bill photo.';
      setError(msg);
      if (usingManualWeight) {
        showNotice('warning', 'Weight Required', msg, {
          actions: [{ label: 'OK', onPress: closeNotice }],
        });
      } else {
        showBillError(msg);
      }
      return;
    }
    const rate = parseFloat(freightRate);
    if (isNaN(rate) || rate < 0) {
      const msg = 'Please enter a valid freight rate.';
      setError(msg);
      showNotice('warning', 'Invalid Freight Rate', msg, {
        actions: [{ label: 'OK', onPress: closeNotice }],
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const defaultUnitId = selectedUnitId || (units.length > 0 ? units[0].id : 1);
      let apiTripDate = tripDate.trim();
      const dmy = apiTripDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (dmy) {
        apiTripDate = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
      }
      const res = await mobileTripService.createTrip({
        trip_date: apiTripDate,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        party_id: selectedPartyId,
        route_id: selectedRouteId,
        unit_id: defaultUnitId,
        freight_rate: rate,
        goods_weight: weight,
        advance_paid: parseFloat(advancePaid) || 0,
        cancel_draft_trip_id: draftTripId || undefined,
        weigh_bill_hash: weighBill?.hash,
        weigh_bill_slip_no: weighBill?.slip_no,
        weigh_bill_vehicle_no: weighBill?.vehicle_no,
        weigh_bill_net_weight: weighBill?.net_weight_mt,
        weigh_bill_accepted_weight: weighBill?.accepted_weight_mt,
        weigh_bill_image: weighBill?.preview,
        weigh_bill_party_name: weighBill?.party_name,
        weigh_bill_unit_name: weighBill?.unit_name,
        weigh_bill_date: weighBill?.bill_date,
      });

      setDraftTripId(res.data.id);
      const fullTripRes = await mobileTripService.getTripById(res.data.id);
      navigation.navigate('PartyPayment', { trip: fullTripRes.data, draftTripId: res.data.id });
    } catch (err: any) {
      const msg = err.message || 'Failed to create trip.';
      setError(msg);
      if (/duplicate|already used on trip/i.test(msg)) {
        setWeighBill(null);
        setGoodsWeight('');
        showBillError(msg);
      } else {
        showNotice('error', 'Could Not Save Trip', msg, {
          actions: [{ label: 'OK', onPress: closeNotice }],
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
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
            <Text style={styles.fieldLabel}>Trip Date (DD-MM-YYYY) *</Text>
            <View style={styles.inputWithIcon}>
              <Calendar size={18} color={COLORS.accent} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.innerInput}
                value={tripDate}
                onChangeText={handleTripDateChange}
                placeholder="DD-MM-YYYY"
                maxLength={10}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Truck Number — pre-selected from advance if available, but fully editable */}
          <View style={styles.formRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.fieldLabel}>Truck Number *</Text>
              {hasPreselectedTruck && selectedVehicleId === route?.params?.preselectedVehicleId && (
                <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#1d4ed8' }}>FROM ADVANCE (TAP TO CHANGE)</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() =>
                openDropdown(
                  'Select Truck Number',
                  vehicles.map((v) => {
                      const alerts = getVehicleComplianceAlerts(v);
                      let sub = v.owner_name ? `Owner: ${v.owner_name}` : '';
                      if (v.goodshed_loading_expense) {
                        const gh = `Loading: ₹${parseFloat(String(v.goodshed_loading_expense)).toLocaleString('en-IN')}`;
                        sub = sub ? `${sub} • ${gh}` : gh;
                      }
                      if (alerts.length > 0) {
                        const expCount = alerts.filter((a) => a.isExpired).length;
                        const soonCount = alerts.length - expCount;
                        const alertTag = expCount > 0
                          ? `⚠️ ${expCount} Expired Doc(s)`
                          : `⚠️ ${soonCount} Expiring in ≤30d`;
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

            {/* Selected Truck Owner Card */}
            {selectedVehicle && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: '#eff6ff',
                  borderColor: '#bfdbfe',
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e40af' }}>
                    👤 Truck Owner:
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1d4ed8' }}>
                    {selectedVehicle.owner_name || 'Direct / Self'}
                  </Text>
                  {selectedVehicle.owner_mobile ? (
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      ({selectedVehicle.owner_mobile})
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Selected Truck 30-day Compliance Alert Banner */}
            {selectedVehicle && (() => {
              const alerts = getVehicleComplianceAlerts(selectedVehicle);
              if (alerts.length === 0) return null;
              const hasExpired = alerts.some((a) => a.isExpired);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setComplianceModal({
                      visible: true,
                      type: 'VEHICLE',
                      entityName: selectedVehicle.lorry_number,
                      documents: alerts,
                      notice: 'Please inform admin or ensure valid renewal documents before dispatching on highway.',
                      onProceed: () => setComplianceModal((prev) => ({ ...prev, visible: false })),
                      onCancel: () => {
                        setSelectedVehicleId(null);
                        setComplianceModal((prev) => ({ ...prev, visible: false }));
                      },
                    });
                  }}
                  style={{
                    marginTop: 10,
                    backgroundColor: hasExpired ? '#fef2f2' : '#fffbeb',
                    borderColor: hasExpired ? '#fca5a5' : '#fde68a',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={16} color={hasExpired ? '#dc2626' : '#d97706'} />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '800',
                          color: hasExpired ? '#991b1b' : '#92400e',
                        }}
                      >
                        {hasExpired ? 'Compliance Expired' : 'Renewal Due (≤ 30 Days)'}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: hasExpired ? '#fee2e2' : '#fef3c7',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '800',
                          color: hasExpired ? '#dc2626' : '#b45309',
                        }}
                      >
                        TAP TO VIEW
                      </Text>
                    </View>
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
                </TouchableOpacity>
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
                          sub += `${sub ? ' • ' : ''}⚠️ EXPIRED (${formatDateDMY(d.license_expiry_date)})`;
                        } else if (diff <= 30) {
                          sub += `${sub ? ' • ' : ''}⚠️ Expires in ${diff}d (${formatDateDMY(d.license_expiry_date)})`;
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
                {route?.params?.preselectedDriverId && selectedDriverId === route?.params?.preselectedDriverId && (
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>FROM ADVANCE</Text>
                  </View>
                )}
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
                          License EXPIRED ({formatDateDMY(selectedDriver.license_expiry_date)})
                        </Text>
                      </View>
                    );
                  } else if (diff <= 30) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#fffbeb', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fde047' }}>
                        <AlertCircle size={14} color="#d97706" />
                        <Text style={{ fontSize: 12, color: '#b45309', fontWeight: '700' }}>
                          License expires in {diff} day{diff === 1 ? '' : 's'} ({formatDateDMY(selectedDriver.license_expiry_date)})
                        </Text>
                      </View>
                    );
                  }
                } catch {}
              }
              return null;
            })()}

            {(() => {
              const owed = parseFloat(String(selectedDriver?.pending_owed_to_driver || 0));
              if (owed > 0) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                    <AlertCircle size={15} color="#c2410c" />
                    <Text style={{ fontSize: 12, color: '#c2410c', fontWeight: '700', flex: 1 }}>
                      Office owes driver: ₹{owed.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (from previous trip dues)
                    </Text>
                  </View>
                );
              }
              if (selectedDriver && Number(selectedDriver.remaining_advance_balance || 0) > 0) {
                const bal = parseFloat(String(selectedDriver.remaining_advance_balance));
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#eff6ff', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' }}>
                    <Text style={{ fontSize: 12, color: '#1d4ed8', fontWeight: '700' }}>
                      💰 Driver Advance in Hand: ₹{bal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Expenses can be deducted from this)
                    </Text>
                  </View>
                );
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

          {/* Unit / Destination Dropdown (Filtered to Selected Party) */}
          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Unit (Destination) *</Text>
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
                    ? (selectedRoute.to_location || `${selectedRoute.from_location} → ${selectedRoute.to_location}`)
                    : selectedPartyId
                    ? 'Select Unit for ' + (selectedParty?.name || 'Party')
                    : 'Select Party first...'}
                </Text>
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.formRow}>
            {canManualEntry ? (
              <View style={styles.entryModeRow}>
                <TouchableOpacity
                  style={[styles.entryModeBtn, weightEntryMode === 'upload' && styles.entryModeBtnActive]}
                  onPress={() => setWeightEntryMode('upload')}
                >
                  <Text style={[styles.entryModeText, weightEntryMode === 'upload' && styles.entryModeTextActive]}>
                    Upload weight
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.entryModeBtn, weightEntryMode === 'manual' && styles.entryModeBtnActive]}
                  onPress={() => setWeightEntryMode('manual')}
                >
                  <Text style={[styles.entryModeText, weightEntryMode === 'manual' && styles.entryModeTextActive]}>
                    Manual entry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>
              {canManualEntry && weightEntryMode === 'manual'
                ? 'Weighment / Acceptance Bill (optional)'
                : 'Weighment / Acceptance Bill *'}
            </Text>
            {isReadingBill ? (
              <View style={styles.billScanning}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <ScanLine size={16} color="#7c3aed" />
                <Text style={styles.billScanningText}>Reading bill weight...</Text>
              </View>
            ) : weighBill ? (
              <View style={styles.billUploaded}>
                <Image source={{ uri: weighBill.preview }} style={styles.billPreview} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.billOkTitle}>
                    {weighBill.weight_source === 'ACCEPTED' ? 'Accepted qty' : 'Net weight'}{' '}
                    {weighBill.net_weight_mt ?? weighBill.accepted_weight_mt} MT
                  </Text>
                  {weighBill.bill_date ? (
                    <Text style={styles.billOkMeta}>Bill date: {weighBill.bill_date}</Text>
                  ) : null}
                  {weighBill.vehicle_no ? (
                    <Text style={styles.billOkMeta}>Truck / Vehicle No: {weighBill.vehicle_no}</Text>
                  ) : null}
                  <TouchableOpacity onPress={promptBillUpload}>
                    <Text style={styles.billChange}>Change bill</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => { setWeighBill(null); setGoodsWeight(''); }}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.billUploadBtn} onPress={promptBillUpload}>
                <Camera size={18} color="#1d4ed8" />
                <Text style={styles.billUploadText}>Upload bill photo — auto take net / accepted weight</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Goods Weight & Freight Rate */}
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                Trip Weight ({selectedUnit ? selectedUnit.name : 'Tons'}) *
              </Text>
              <View style={styles.inputWithIcon}>
                <Scale size={18} color={COLORS.accent} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.innerInput}
                  placeholder={canManualEntry ? 'Enter weight' : 'From bill'}
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="decimal-pad"
                  value={goodsWeight}
                  editable={canManualEntry}
                  onChangeText={setGoodsWeight}
                />
              </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.fieldLabel}>Advance Paid to Driver (₹)</Text>
              {hasPreselectedAdvance && (
                <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#1d4ed8' }}>PRE-FILLED FROM ADVANCE</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={advancePaid}
              onChangeText={setAdvancePaid}
            />
            {(() => {
              const owed = parseFloat(String(selectedDriver?.pending_owed_to_driver || 0));
              const entered = parseFloat(advancePaid) || 0;
              if (owed > 0) {
                const deducted = Math.min(entered, owed);
                const effective = Math.max(0, entered - deducted);
                return (
                  <View style={{ marginTop: 8, padding: 10, backgroundColor: '#fff7ed', borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa' }}>
                    <Text style={{ fontSize: 11.5, color: '#9a3412', fontWeight: '700', marginBottom: 4 }}>
                      Advance Adjustment Breakdown:
                    </Text>
                    <Text style={{ fontSize: 11, color: '#7c2d12' }}>
                      • Cash given: ₹{entered.toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#c2410c', fontWeight: '600' }}>
                      • Settles previous trip balance: −₹{deducted.toLocaleString('en-IN')} (auto-settles previous trip)
                    </Text>
                    <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '800', marginTop: 3 }}>
                      • Effective advance for this trip: ₹{effective.toLocaleString('en-IN')}
                    </Text>
                  </View>
                );
              }
              if (selectedDriver && Number(selectedDriver.remaining_advance_balance || 0) > 0) {
                const bal = parseFloat(String(selectedDriver.remaining_advance_balance));
                return (
                  <Text style={{ fontSize: 11, color: '#1d4ed8', marginTop: 4, fontWeight: '600' }}>
                    Driver has ₹{bal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} advance in hand. Enter 0 if expenses should come from this.
                  </Text>
                );
              }
              return null;
            })()}
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

      <AppNoticeModal
        visible={notice.visible}
        kind={notice.kind}
        title={notice.title}
        message={notice.message}
        detail={notice.detail}
        actions={notice.actions}
        onClose={notice.onClose}
      />

      {/* Professional Compliance Alert Modal */}
      <ComplianceAlertModal
        visible={complianceModal.visible}
        type={complianceModal.type}
        entityName={complianceModal.entityName}
        documents={complianceModal.documents}
        notice={complianceModal.notice}
        onProceed={complianceModal.onProceed}
        onCancel={complianceModal.onCancel}
      />
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
  billUploadBtn: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billUploadText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  billScanning: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billScanningText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6d28d9',
  },
  billUploaded: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billPreview: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  billOkTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  billOkMeta: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
    fontWeight: '600',
  },
  billChange: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 6,
  },
  entryModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  entryModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  entryModeBtnActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  entryModeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  entryModeTextActive: {
    color: '#1d4ed8',
  },
});
