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
} from 'react-native';
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  X,
  MapPin,
  Sparkles,
  Layers,
  Scale,
  DollarSign,
  UserCheck,
  Building,
  RefreshCw,
  HandCoins,
  Calendar,
} from 'lucide-react-native';
import {
  adminUnitService,
  adminRouteService,
  adminCleaningExpenseRateService,
  adminUnloadingRateService,
  adminDriverBataRateService,
  adminOtherExpenseLimitService,
  adminOwnerService,
  adminPartyService,
  adminOwnerAdvanceService,
  adminUserService,
} from '../../services/adminService';
import {
  Unit,
  Route,
  CleaningExpenseRate,
  UnloadingRate,
  DriverBataRate,
  OtherExpenseLimit,
  Owner,
  Party,
  OwnerAdvance,
  User,
} from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

type MasterTab = 'UNITS' | 'ROUTES' | 'CLEANING' | 'UNLOADING' | 'BATA' | 'LIMITS' | 'OWNERS' | 'ADVANCES';

export const AdminMastersScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const initial = route.params?.initialTab as MasterTab | undefined;
  const [activeTab, setActiveTab] = useState<MasterTab>(initial || 'UNITS');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [units, setUnits] = useState<Unit[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cleaningRates, setCleaningRates] = useState<CleaningExpenseRate[]>([]);
  const [unloadingRates, setUnloadingRates] = useState<UnloadingRate[]>([]);
  const [bataRates, setBataRates] = useState<DriverBataRate[]>([]);
  const [limits, setLimits] = useState<OtherExpenseLimit[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [partiesList, setPartiesList] = useState<Party[]>([]);

  // Editing items
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingCleaning, setEditingCleaning] = useState<CleaningExpenseRate | null>(null);
  const [editingUnloading, setEditingUnloading] = useState<UnloadingRate | null>(null);
  const [editingBata, setEditingBata] = useState<DriverBataRate | null>(null);
  const [editingLimit, setEditingLimit] = useState<OtherExpenseLimit | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);

  // Form states - UNIT
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitAbbr, setUnitAbbr] = useState('');

  // Form states - ROUTE
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeRate, setRouteRate] = useState('');

  // Form states - CLEANING
  const [isCleaningModalOpen, setIsCleaningModalOpen] = useState(false);
  const [cleaningUnitName, setCleaningUnitName] = useState('');
  const [cleaningCharge, setCleaningCharge] = useState('');

  // Form states - UNLOADING
  const [isUnloadingModalOpen, setIsUnloadingModalOpen] = useState(false);
  const [unloadingPartyId, setUnloadingPartyId] = useState<number | null>(null);
  const [unloadingUnitName, setUnloadingUnitName] = useState('');
  const [unloadingUnitNumber, setUnloadingUnitNumber] = useState('');
  const [unloadingRatePerTon, setUnloadingRatePerTon] = useState('');
  const [unloadingDesc, setUnloadingDesc] = useState('');

  // Form states - BATA
  const [isBataModalOpen, setIsBataModalOpen] = useState(false);
  const [bataPercentage, setBataPercentage] = useState('');
  const [bataMultiplier, setBataMultiplier] = useState('');
  const [bataDesc, setBataDesc] = useState('');

  // Form states - LIMIT
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [maxAmount, setMaxAmount] = useState('');
  const [limitDesc, setLimitDesc] = useState('');

  // Form states - OWNER
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');

  // Advances State
  const [advances, setAdvances] = useState<OwnerAdvance[]>([]);
  const [managersList, setManagersList] = useState<User[]>([]);
  const [editingAdvance, setEditingAdvance] = useState<OwnerAdvance | null>(null);

  // Form states - ADVANCE
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advOwnerId, setAdvOwnerId] = useState<number | null>(null);
  const [advManagerId, setAdvManagerId] = useState<number | null>(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState('');
  const [advMode, setAdvMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [advNotes, setAdvNotes] = useState('');

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Load parties, owners, and managers list for dropdowns
  useEffect(() => {
    adminPartyService.getParties({ limit: 100 })
      .then(res => setPartiesList(res.data.items || []))
      .catch(() => {});
    adminOwnerService.getOwners({ limit: 100 })
      .then(res => setOwners(res.data.items || []))
      .catch(() => {});
    adminUserService.getUsers({ limit: 100, status: 'ACTIVE' })
      .then(res => setManagersList((res.data.items || []).filter(u => u.role === 'MANAGER' || u.role === 'ADMIN')))
      .catch(() => {});
  }, []);

  const loadActiveTabData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'UNITS') {
        const res = await adminUnitService.getUnits();
        setUnits(res.data || []);
      } else if (activeTab === 'ROUTES') {
        const res = await adminRouteService.getRoutes({ limit: 100 });
        setRoutes(res.data.items || []);
      } else if (activeTab === 'CLEANING') {
        const res = await adminCleaningExpenseRateService.getCleaningExpenseRates();
        setCleaningRates(res.data || []);
      } else if (activeTab === 'UNLOADING') {
        const res = await adminUnloadingRateService.getUnloadingRates();
        setUnloadingRates(res.data || []);
      } else if (activeTab === 'BATA') {
        const res = await adminDriverBataRateService.getDriverBataRates();
        setBataRates(res.data || []);
      } else if (activeTab === 'LIMITS') {
        const res = await adminOtherExpenseLimitService.getOtherExpenseLimits();
        setLimits(res.data || []);
      } else if (activeTab === 'OWNERS') {
        const res = await adminOwnerService.getOwners({ limit: 100 });
        setOwners(res.data.items || []);
      } else if (activeTab === 'ADVANCES') {
        const res = await adminOwnerAdvanceService.getOwnerAdvances({ limit: 100 });
        setAdvances(res.data.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load tab data', err);
      Alert.alert('Error', err.message || 'Failed to fetch master data.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // ================= UNIT ACTIONS =================
  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitName('');
    setUnitAbbr('');
    setIsUnitModalOpen(true);
  };

  const openEditUnit = (u: Unit) => {
    setEditingUnit(u);
    setUnitName(u.name);
    setUnitAbbr(u.abbreviation || '');
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async () => {
    if (!unitName.trim()) return Alert.alert('Required', 'Unit name is required');
    try {
      if (editingUnit) {
        await adminUnitService.updateUnit(editingUnit.id, {
          name: unitName.trim(),
          abbreviation: unitAbbr.trim() || undefined,
        });
        Alert.alert('Updated', 'Unit updated successfully');
      } else {
        await adminUnitService.createUnit({
          name: unitName.trim(),
          abbreviation: unitAbbr.trim() || undefined,
        });
        Alert.alert('Created', 'Unit created successfully');
      }
      setIsUnitModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteUnit = (u: Unit) => {
    Alert.alert('Delete Unit', `Are you sure you want to delete unit "${u.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminUnitService.deleteUnit(u.id);
            Alert.alert('Deleted', 'Unit removed successfully');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= ROUTE ACTIONS =================
  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteFrom('');
    setRouteTo('');
    setRouteRate('');
    setIsRouteModalOpen(true);
  };

  const openEditRoute = (r: Route) => {
    setEditingRoute(r);
    setRouteFrom(r.from_location);
    setRouteTo(r.to_location);
    setRouteRate(r.rate_per_unit ? String(r.rate_per_unit) : '');
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) return Alert.alert('Required', 'From and To locations are required');
    try {
      const payload = {
        from_location: routeFrom.trim(),
        to_location: routeTo.trim(),
        rate_per_unit: routeRate ? parseFloat(routeRate) : undefined,
      };
      if (editingRoute) {
        await adminRouteService.updateRoute(editingRoute.id, payload);
        Alert.alert('Updated', 'Route updated successfully');
      } else {
        await adminRouteService.createRoute(payload);
        Alert.alert('Created', 'Route created successfully');
      }
      setIsRouteModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteRoute = (r: Route) => {
    Alert.alert('Delete Route', `Delete route "${r.from_location} → ${r.to_location}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminRouteService.deleteRoute(r.id);
            Alert.alert('Deleted', 'Route deleted successfully');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= CLEANING ACTIONS =================
  const openAddCleaning = () => {
    setEditingCleaning(null);
    setCleaningUnitName('');
    setCleaningCharge('');
    setIsCleaningModalOpen(true);
  };

  const openEditCleaning = (c: CleaningExpenseRate) => {
    setEditingCleaning(c);
    setCleaningUnitName(c.unit_name);
    setCleaningCharge(String(c.cleaning_charge));
    setIsCleaningModalOpen(true);
  };

  const handleSaveCleaning = async () => {
    if (!cleaningUnitName.trim() || !cleaningCharge) return Alert.alert('Required', 'All fields required');
    try {
      const payload = {
        unit_name: cleaningUnitName.trim(),
        cleaning_charge: parseFloat(cleaningCharge) || 0,
      };
      if (editingCleaning) {
        await adminCleaningExpenseRateService.updateCleaningExpenseRate(editingCleaning.id, payload);
        Alert.alert('Updated', 'Cleaning charge updated successfully');
      } else {
        await adminCleaningExpenseRateService.createCleaningExpenseRate(payload);
        Alert.alert('Created', 'Cleaning charge created successfully');
      }
      setIsCleaningModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteCleaning = (c: CleaningExpenseRate) => {
    Alert.alert('Delete Cleaning Rate', `Delete rate for "${c.unit_name}" (₹${c.cleaning_charge})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminCleaningExpenseRateService.deleteCleaningExpenseRate(c.id);
            Alert.alert('Deleted', 'Cleaning rate removed');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= UNLOADING ACTIONS =================
  const openAddUnloading = () => {
    setEditingUnloading(null);
    setUnloadingPartyId(partiesList.length > 0 ? partiesList[0].id : null);
    setUnloadingUnitName('');
    setUnloadingUnitNumber('');
    setUnloadingRatePerTon('');
    setUnloadingDesc('');
    setIsUnloadingModalOpen(true);
  };

  const openEditUnloading = (ul: UnloadingRate) => {
    setEditingUnloading(ul);
    setUnloadingPartyId(ul.party_id);
    setUnloadingUnitName(ul.unit_name);
    setUnloadingUnitNumber(ul.unit_number !== undefined && ul.unit_number !== null ? String(ul.unit_number) : '');
    setUnloadingRatePerTon(String(ul.rate_per_ton));
    setUnloadingDesc(ul.description || '');
    setIsUnloadingModalOpen(true);
  };

  const handleSaveUnloading = async () => {
    if (!unloadingPartyId) return Alert.alert('Required', 'Please select a party');
    if (!unloadingUnitName.trim()) return Alert.alert('Required', 'Unit name is required');
    if (!unloadingRatePerTon) return Alert.alert('Required', 'Rate per ton is required');

    try {
      const payload: any = {
        party_id: unloadingPartyId,
        unit_name: unloadingUnitName.trim(),
        unit_number: unloadingUnitNumber ? parseInt(unloadingUnitNumber) : undefined,
        rate_per_ton: parseFloat(unloadingRatePerTon) || 0,
        description: unloadingDesc.trim() || undefined,
      };

      if (editingUnloading) {
        await adminUnloadingRateService.updateUnloadingRate(editingUnloading.id, payload);
        Alert.alert('Updated', 'Unloading rate updated successfully');
      } else {
        await adminUnloadingRateService.createUnloadingRate(payload);
        Alert.alert('Created', 'Unloading rate created successfully');
      }
      setIsUnloadingModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteUnloading = (ul: UnloadingRate) => {
    Alert.alert('Delete Unloading Rate', `Delete unloading rate for "${ul.unit_name}" (₹${ul.rate_per_ton}/ton)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminUnloadingRateService.deleteUnloadingRate(ul.id);
            Alert.alert('Deleted', 'Unloading rate removed');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= BATA ACTIONS =================
  const openAddBata = () => {
    setEditingBata(null);
    setBataPercentage('');
    setBataMultiplier('');
    setBataDesc('');
    setIsBataModalOpen(true);
  };

  const openEditBata = (b: DriverBataRate) => {
    setEditingBata(b);
    setBataPercentage(String(b.rate_percentage));
    setBataMultiplier(String(b.rate_multiplier));
    setBataDesc(b.description || '');
    setIsBataModalOpen(true);
  };

  const handleSaveBata = async () => {
    if (!bataPercentage || !bataMultiplier) return Alert.alert('Required', 'Percentage and multiplier required');
    try {
      const payload = {
        rate_percentage: parseFloat(bataPercentage) || 0,
        rate_multiplier: parseFloat(bataMultiplier) || 0,
        description: bataDesc.trim() || undefined,
      };
      if (editingBata) {
        await adminDriverBataRateService.updateDriverBataRate(editingBata.id, payload);
        Alert.alert('Updated', 'Driver bata rate updated');
      } else {
        await adminDriverBataRateService.createDriverBataRate(payload);
        Alert.alert('Created', 'Driver bata rate created');
      }
      setIsBataModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteBata = (b: DriverBataRate) => {
    Alert.alert('Delete Bata Rate', `Delete Driver Bata rate (${b.rate_percentage}%)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminDriverBataRateService.deleteDriverBataRate(b.id);
            Alert.alert('Deleted', 'Driver bata rate removed');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= LIMIT ACTIONS =================
  const openAddLimit = () => {
    setEditingLimit(null);
    setMaxAmount('');
    setLimitDesc('');
    setIsLimitModalOpen(true);
  };

  const openEditLimit = (l: OtherExpenseLimit) => {
    setEditingLimit(l);
    setMaxAmount(String(l.max_amount));
    setLimitDesc(l.description || '');
    setIsLimitModalOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!maxAmount) return Alert.alert('Required', 'Max Amount required');
    try {
      const payload = {
        max_amount: parseFloat(maxAmount) || 0,
        description: limitDesc.trim() || undefined,
      };
      if (editingLimit) {
        await adminOtherExpenseLimitService.updateOtherExpenseLimit(editingLimit.id, payload);
        Alert.alert('Updated', 'Expense limit updated');
      } else {
        await adminOtherExpenseLimitService.createOtherExpenseLimit(payload);
        Alert.alert('Created', 'Expense limit created');
      }
      setIsLimitModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteLimit = (l: OtherExpenseLimit) => {
    Alert.alert('Delete Expense Limit', `Delete expense limit of ₹${l.max_amount}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminOtherExpenseLimitService.deleteOtherExpenseLimit(l.id);
            Alert.alert('Deleted', 'Expense limit removed');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= OWNER ACTIONS =================
  const openAddOwner = () => {
    setEditingOwner(null);
    setOwnerName('');
    setOwnerMobile('');
    setIsOwnerModalOpen(true);
  };

  const openEditOwner = (o: Owner) => {
    setEditingOwner(o);
    setOwnerName(o.name);
    setOwnerMobile(o.mobile_number || '');
    setIsOwnerModalOpen(true);
  };

  const handleSaveOwner = async () => {
    if (!ownerName.trim()) return Alert.alert('Required', 'Owner name required');
    try {
      const payload = {
        name: ownerName.trim(),
        mobile_number: ownerMobile.trim() || undefined,
      };
      if (editingOwner) {
        await adminOwnerService.updateOwner(editingOwner.id, payload);
        Alert.alert('Updated', 'Owner updated successfully');
      } else {
        await adminOwnerService.createOwner(payload);
        Alert.alert('Created', 'Owner created successfully');
      }
      setIsOwnerModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteOwner = (o: Owner) => {
    Alert.alert('Delete Owner', `Delete vehicle owner "${o.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminOwnerService.deleteOwner(o.id);
            Alert.alert('Deleted', 'Owner removed successfully');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  // ================= ADVANCE TO MANAGER ACTIONS =================
  const openAddAdvance = () => {
    setEditingAdvance(null);
    setAdvOwnerId(owners.length > 0 ? owners[0].id : null);
    setAdvManagerId(managersList.length > 0 ? managersList[0].id : null);
    setAdvAmount('');
    setAdvDate(new Date().toISOString().split('T')[0]);
    setAdvMode('CASH');
    setAdvNotes('');
    setIsAdvanceModalOpen(true);
  };

  const openEditAdvance = (adv: OwnerAdvance) => {
    setEditingAdvance(adv);
    setAdvOwnerId(adv.owner_id);
    setAdvManagerId(adv.manager_id);
    setAdvAmount(String(adv.amount));
    setAdvDate(adv.advance_date ? adv.advance_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setAdvMode((adv.payment_mode as any) || 'CASH');
    setAdvNotes(adv.notes || '');
    setIsAdvanceModalOpen(true);
  };

  const handleSaveAdvance = async () => {
    if (!advOwnerId) return Alert.alert('Required', 'Please select a vehicle owner');
    if (!advManagerId) return Alert.alert('Required', 'Please select a manager');
    const amt = parseFloat(advAmount);
    if (!advAmount || isNaN(amt) || amt <= 0) return Alert.alert('Required', 'Valid advance amount required');

    const getFullAdvanceIsoTimestamp = (dateInput?: string) => {
      const now = new Date();
      if (!dateInput || !dateInput.trim()) return now.toISOString();
      const clean = dateInput.trim();
      const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayUTC = now.toISOString().split('T')[0];
      if (clean === todayYMD || clean === todayUTC) {
        return now.toISOString();
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-').map(Number);
        const combined = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        return combined.toISOString();
      }
      return clean;
    };

    try {
      const payload: any = {
        owner_id: advOwnerId,
        manager_id: advManagerId,
        amount: amt,
        advance_date: getFullAdvanceIsoTimestamp(advDate),
        payment_mode: advMode,
        notes: advNotes.trim() || undefined,
      };

      if (editingAdvance) {
        await adminOwnerAdvanceService.updateOwnerAdvance(editingAdvance.id, payload);
        Alert.alert('Updated', 'Advance to manager updated');
      } else {
        await adminOwnerAdvanceService.createOwnerAdvance(payload);
        Alert.alert('Created', 'Advance to manager recorded');
      }
      setIsAdvanceModalOpen(false);
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteAdvance = (adv: OwnerAdvance) => {
    Alert.alert('Delete Advance', `Delete advance entry #${adv.id} of ₹${adv.amount}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminOwnerAdvanceService.deleteOwnerAdvance(adv.id);
            Alert.alert('Deleted', 'Advance record removed');
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Top Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {[
          { id: 'UNITS', label: 'Units Master', icon: Scale },
          { id: 'ROUTES', label: 'Routes & Rates', icon: MapPin },
          { id: 'CLEANING', label: 'Cleaning Charges', icon: Sparkles },
          { id: 'UNLOADING', label: 'Unloading Rates', icon: Layers },
          { id: 'BATA', label: 'Driver Bata %', icon: DollarSign },
          { id: 'LIMITS', label: 'Expense Limits', icon: Sliders },
          { id: 'OWNERS', label: 'Owners Master', icon: UserCheck },
          { id: 'ADVANCES', label: 'Advance to Manager', icon: HandCoins },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.id as MasterTab)}
            >
              <Icon size={14} color={isActive ? COLORS.primaryDark : COLORS.textMuted} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content Action Header */}
      <View style={styles.contentHeader}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'UNITS' && `Units Master (${units.length})`}
          {activeTab === 'ROUTES' && `Routes & Rates (${routes.length})`}
          {activeTab === 'CLEANING' && `Cleaning Charges (${cleaningRates.length})`}
          {activeTab === 'UNLOADING' && `Unloading Rates (${unloadingRates.length})`}
          {activeTab === 'BATA' && `Driver Bata Rates (${bataRates.length})`}
          {activeTab === 'LIMITS' && `Expense Limits (${limits.length})`}
          {activeTab === 'OWNERS' && `Owners Master (${owners.length})`}
          {activeTab === 'ADVANCES' && `Advance to Manager (${advances.length})`}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.refreshIconBtn} onPress={loadActiveTabData}>
            <RefreshCw size={15} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (activeTab === 'UNITS') openAddUnit();
              else if (activeTab === 'ROUTES') openAddRoute();
              else if (activeTab === 'CLEANING') openAddCleaning();
              else if (activeTab === 'UNLOADING') openAddUnloading();
              else if (activeTab === 'BATA') openAddBata();
              else if (activeTab === 'LIMITS') openAddLimit();
              else if (activeTab === 'OWNERS') openAddOwner();
              else if (activeTab === 'ADVANCES') openAddAdvance();
            }}
          >
            <Plus size={15} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Records */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Master Records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {/* UNITS */}
          {activeTab === 'UNITS' &&
            (units.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No units defined</Text></View>
            ) : (
              units.map((u) => (
                <View key={u.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{u.name}</Text>
                    {u.abbreviation ? (
                      <Text style={styles.itemSub}>Abbreviation: <Text style={{ fontWeight: '700', color: COLORS.primary }}>{u.abbreviation}</Text></Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditUnit(u)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteUnit(u)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* ROUTES */}
          {activeTab === 'ROUTES' &&
            (routes.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No routes defined</Text></View>
            ) : (
              routes.map((r) => (
                <View key={r.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{r.from_location} → {r.to_location}</Text>
                    {r.party_name ? <Text style={styles.itemSub}>Party: {r.party_name}</Text> : null}
                    {r.rate_per_unit ? (
                      <Text style={[styles.itemSub, { color: '#047857', fontWeight: '800' }]}>
                        Standard Rate: ₹{parseFloat(String(r.rate_per_unit)).toLocaleString('en-IN')}/unit
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditRoute(r)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteRoute(r)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* CLEANING */}
          {activeTab === 'CLEANING' &&
            (cleaningRates.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No cleaning rates defined</Text></View>
            ) : (
              cleaningRates.map((c) => (
                <View key={c.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{c.unit_name}</Text>
                    <Text style={[styles.itemSub, { color: '#047857', fontWeight: '800' }]}>
                      Fixed Cleaning Charge: ₹{parseFloat(String(c.cleaning_charge)).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditCleaning(c)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteCleaning(c)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* UNLOADING */}
          {activeTab === 'UNLOADING' &&
            (unloadingRates.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No unloading rates defined</Text></View>
            ) : (
              unloadingRates.map((ul) => (
                <View key={ul.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{ul.party_name || `Party #${ul.party_id}`}</Text>
                    <Text style={styles.itemSub}>
                      Unit: {ul.unit_name} {ul.unit_number ? `(#${ul.unit_number})` : ''}
                    </Text>
                    <Text style={[styles.itemSub, { color: '#047857', fontWeight: '800' }]}>
                      Rate: ₹{parseFloat(String(ul.rate_per_ton)).toLocaleString('en-IN')} / ton
                    </Text>
                    {ul.description ? <Text style={styles.itemSub}>{ul.description}</Text> : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditUnloading(ul)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteUnloading(ul)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* BATA */}
          {activeTab === 'BATA' &&
            (bataRates.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No driver bata rates defined</Text></View>
            ) : (
              bataRates.map((b) => (
                <View key={b.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {b.rate_percentage}% (Multiplier: {b.rate_multiplier})
                    </Text>
                    <Text style={styles.itemSub}>
                      {b.party_name ? `Party: ${b.party_name}` : 'Default Standard Bata Rate'}
                    </Text>
                    {b.description ? <Text style={styles.itemSub}>{b.description}</Text> : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditBata(b)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteBata(b)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* LIMITS */}
          {activeTab === 'LIMITS' &&
            (limits.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No expense limits defined</Text></View>
            ) : (
              limits.map((l) => (
                <View key={l.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>Max Allowed: ₹{parseFloat(String(l.max_amount)).toLocaleString('en-IN')}</Text>
                    {l.description ? <Text style={styles.itemSub}>{l.description}</Text> : null}
                    {l.party_name ? <Text style={styles.itemSub}>Party: {l.party_name}</Text> : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditLimit(l)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteLimit(l)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* OWNERS */}
          {activeTab === 'OWNERS' &&
            (owners.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No owners registered</Text></View>
            ) : (
              owners.map((o) => (
                <View key={o.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{o.name}</Text>
                    {o.mobile_number ? (
                      <Text style={styles.itemSub}>Phone: {o.mobile_number}</Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditOwner(o)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteOwner(o)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}

          {/* ADVANCES */}
          {activeTab === 'ADVANCES' &&
            (advances.length === 0 ? (
              <View style={styles.centerBox}><Text style={styles.centerText}>No advance records found</Text></View>
            ) : (
              advances.map((adv) => (
                <View key={adv.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{adv.owner_name || `Owner #${adv.owner_id}`}</Text>
                    <Text style={[styles.itemSub, { color: '#047857', fontWeight: '800' }]}>
                      Amount: ₹{parseFloat(String(adv.amount)).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.itemSub}>
                      To: {adv.manager_name || `Manager #${adv.manager_id}`} • {formatDateDMY(adv.advance_date)} ({adv.payment_mode || 'CASH'})
                    </Text>
                    {adv.notes ? <Text style={styles.itemSub}>Note: {adv.notes}</Text> : null}
                  </View>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditAdvance(adv)}>
                      <Edit2 size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteAdvance(adv)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ))}
        </ScrollView>
      )}

      {/* ── Add / Edit Unit Modal ── */}
      <Modal visible={isUnitModalOpen} transparent animationType="slide" onRequestClose={() => setIsUnitModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUnit ? `Edit Unit #${editingUnit.id}` : 'Add Unit Master'}</Text>
              <TouchableOpacity onPress={() => setIsUnitModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Unit Name (e.g. Metric Ton) *</Text>
            <TextInput style={styles.input} value={unitName} onChangeText={setUnitName} placeholder="Metric Ton" />
            <Text style={styles.label}>Abbreviation (e.g. MT)</Text>
            <TextInput style={styles.input} value={unitAbbr} onChangeText={setUnitAbbr} placeholder="MT" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsUnitModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveUnit}><Text style={styles.submitText}>{editingUnit ? 'Save Changes' : 'Save Unit'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Route Modal ── */}
      <Modal visible={isRouteModalOpen} transparent animationType="slide" onRequestClose={() => setIsRouteModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRoute ? `Edit Route #${editingRoute.id}` : 'Add Route'}</Text>
              <TouchableOpacity onPress={() => setIsRouteModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>From Location *</Text>
            <TextInput style={styles.input} value={routeFrom} onChangeText={setRouteFrom} placeholder="e.g. Salem" />
            <Text style={styles.label}>To Location *</Text>
            <TextInput style={styles.input} value={routeTo} onChangeText={setRouteTo} placeholder="e.g. Chennai" />
            <Text style={styles.label}>Standard Rate Per Unit (₹)</Text>
            <TextInput style={styles.input} value={routeRate} onChangeText={setRouteRate} placeholder="0.00" keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRouteModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveRoute}><Text style={styles.submitText}>{editingRoute ? 'Save Changes' : 'Save Route'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Cleaning Modal ── */}
      <Modal visible={isCleaningModalOpen} transparent animationType="slide" onRequestClose={() => setIsCleaningModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCleaning ? `Edit Cleaning Rate` : 'Add Cleaning Rate'}</Text>
              <TouchableOpacity onPress={() => setIsCleaningModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Unit / Commodity Name *</Text>
            <TextInput style={styles.input} value={cleaningUnitName} onChangeText={setCleaningUnitName} placeholder="e.g. Cement Tanker" />
            <Text style={styles.label}>Cleaning Charge (₹) *</Text>
            <TextInput style={styles.input} value={cleaningCharge} onChangeText={setCleaningCharge} placeholder="250" keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCleaningModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveCleaning}><Text style={styles.submitText}>{editingCleaning ? 'Save Changes' : 'Save Rate'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Unloading Modal ── */}
      <Modal visible={isUnloadingModalOpen} transparent animationType="slide" onRequestClose={() => setIsUnloadingModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUnloading ? 'Edit Unloading Rate' : 'Add Unloading Rate'}</Text>
              <TouchableOpacity onPress={() => setIsUnloadingModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Select Party *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {partiesList.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.partySelectChip,
                    unloadingPartyId === p.id && styles.partySelectChipActive,
                  ]}
                  onPress={() => setUnloadingPartyId(p.id)}
                >
                  <Text style={[styles.partySelectText, unloadingPartyId === p.id && styles.partySelectTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Unit / Commodity Name *</Text>
            <TextInput style={styles.input} value={unloadingUnitName} onChangeText={setUnloadingUnitName} placeholder="e.g. Clinker Bags" />

            <Text style={styles.label}>Unit Number (Optional)</Text>
            <TextInput style={styles.input} value={unloadingUnitNumber} onChangeText={setUnloadingUnitNumber} placeholder="e.g. 1" keyboardType="numeric" />

            <Text style={styles.label}>Rate Per Ton (₹) *</Text>
            <TextInput style={styles.input} value={unloadingRatePerTon} onChangeText={setUnloadingRatePerTon} placeholder="45.00" keyboardType="numeric" />

            <Text style={styles.label}>Description / Notes (Optional)</Text>
            <TextInput style={styles.input} value={unloadingDesc} onChangeText={setUnloadingDesc} placeholder="Unloading notes..." />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsUnloadingModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveUnloading}><Text style={styles.submitText}>{editingUnloading ? 'Save Changes' : 'Save Rate'}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add / Edit Bata Modal ── */}
      <Modal visible={isBataModalOpen} transparent animationType="slide" onRequestClose={() => setIsBataModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBata ? 'Edit Driver Bata Rate' : 'Add Driver Bata Rate'}</Text>
              <TouchableOpacity onPress={() => setIsBataModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Rate Percentage (%) *</Text>
            <TextInput style={styles.input} value={bataPercentage} onChangeText={setBataPercentage} placeholder="e.g. 5" keyboardType="numeric" />
            <Text style={styles.label}>Rate Multiplier (e.g. 0.05) *</Text>
            <TextInput style={styles.input} value={bataMultiplier} onChangeText={setBataMultiplier} placeholder="e.g. 0.05" keyboardType="numeric" />
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput style={styles.input} value={bataDesc} onChangeText={setBataDesc} placeholder="Notes..." />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsBataModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveBata}><Text style={styles.submitText}>{editingBata ? 'Save Changes' : 'Save Bata'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Limit Modal ── */}
      <Modal visible={isLimitModalOpen} transparent animationType="slide" onRequestClose={() => setIsLimitModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingLimit ? 'Edit Expense Limit' : 'Add Expense Limit'}</Text>
              <TouchableOpacity onPress={() => setIsLimitModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Max Allowed Amount (₹) *</Text>
            <TextInput style={styles.input} value={maxAmount} onChangeText={setMaxAmount} placeholder="e.g. 500" keyboardType="numeric" />
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={limitDesc} onChangeText={setLimitDesc} placeholder="e.g. Loading Tea / Toll max" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsLimitModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveLimit}><Text style={styles.submitText}>{editingLimit ? 'Save Changes' : 'Save Limit'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Owner Modal ── */}
      <Modal visible={isOwnerModalOpen} transparent animationType="slide" onRequestClose={() => setIsOwnerModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingOwner ? `Edit Owner #${editingOwner.id}` : 'Add Vehicle Owner'}</Text>
              <TouchableOpacity onPress={() => setIsOwnerModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Owner Full Name *</Text>
            <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="e.g. K. Periasamy" />
            <Text style={styles.label}>Mobile Phone Number</Text>
            <TextInput style={styles.input} value={ownerMobile} onChangeText={setOwnerMobile} placeholder="9876543210" keyboardType="phone-pad" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsOwnerModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveOwner}><Text style={styles.submitText}>{editingOwner ? 'Save Changes' : 'Save Owner'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Advance to Manager Modal ── */}
      <Modal visible={isAdvanceModalOpen} transparent animationType="slide" onRequestClose={() => setIsAdvanceModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAdvance ? `Edit Advance #${editingAdvance.id}` : 'Give Advance to Manager'}</Text>
              <TouchableOpacity onPress={() => setIsAdvanceModalOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>

            <Text style={styles.label}>Select Vehicle Owner *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {owners.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.partySelectChip, advOwnerId === o.id && styles.partySelectChipActive]}
                  onPress={() => setAdvOwnerId(o.id)}
                >
                  <Text style={[styles.partySelectText, advOwnerId === o.id && styles.partySelectTextActive]}>{o.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Select Receiving Manager *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {managersList.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.partySelectChip, advManagerId === m.id && styles.partySelectChipActive]}
                  onPress={() => setAdvManagerId(m.id)}
                >
                  <Text style={[styles.partySelectText, advManagerId === m.id && styles.partySelectTextActive]}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Advance Amount (₹) *</Text>
            <TextInput style={styles.input} value={advAmount} onChangeText={setAdvAmount} placeholder="e.g. 25000" keyboardType="numeric" />

            <Text style={styles.label}>Advance Date (YYYY-MM-DD) *</Text>
            <TextInput style={styles.input} value={advDate} onChangeText={setAdvDate} placeholder="YYYY-MM-DD" />

            <Text style={styles.label}>Payment Mode</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.partySelectChip, advMode === m && styles.partySelectChipActive, { flex: 1, alignItems: 'center' }]}
                  onPress={() => setAdvMode(m)}
                >
                  <Text style={[styles.partySelectText, advMode === m && styles.partySelectTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput style={styles.input} value={advNotes} onChangeText={setAdvNotes} placeholder="Remarks..." />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdvanceModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveAdvance}><Text style={styles.submitText}>{editingAdvance ? 'Save Changes' : 'Record Advance'}</Text></TouchableOpacity>
            </View>
          </ScrollView>
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
  tabScroll: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 50,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  refreshIconBtn: {
    padding: 7,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 40,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 7,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
  },
  partySelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  partySelectChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  partySelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  partySelectTextActive: {
    color: COLORS.white,
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
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  submitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
});
