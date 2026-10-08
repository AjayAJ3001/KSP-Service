import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Truck,
  ArrowDownCircle,
  UserCheck,
  Sparkles,
  Receipt,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  ArrowLeft,
  ArrowRight,
  X,
  RotateCcw,
  Building2,
} from 'lucide-react-native';
import { mobileExpenseService, mobileSettlementService, mobileLookupService } from '../services/mobileService';
import { Trip, DriverExpense, Settlement } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export interface KrishiUnit {
  unitNumber: number; // 1 to 9
  name: string;
  routeId: number;
  ratePerTon: number; // fallback default; overridden by admin panel at runtime
  keywords: string[];
}

// Fallback defaults — actual rates are fetched from admin panel's unloading_rates table at runtime
export const KRISHI_UNITS: KrishiUnit[] = [
  { unitNumber: 1, name: 'SIPCOT', routeId: 7, ratePerTon: 50, keywords: ['SIPCOT'] },
  { unitNumber: 2, name: 'RGS - VAVIKADAI', routeId: 8, ratePerTon: 50, keywords: ['RGS', 'VAVIKADAI'] },
  { unitNumber: 3, name: 'GOBI - SAKTHI FEEDS', routeId: 9, ratePerTon: 50, keywords: ['GOBI', 'SAKTHI'] },
  { unitNumber: 4, name: 'PALLADAM - PPK HATCHERIES', routeId: 10, ratePerTon: 50, keywords: ['PALLADAM', 'PPK'] },
  { unitNumber: 5, name: 'PAPPAMPATTI - VALARMATHI FEEDS', routeId: 11, ratePerTon: 60, keywords: ['PAPPAMPATTI', 'VALARMATHI'] },
  { unitNumber: 6, name: 'NACHIPALAYAM - SUGUNA FEEDS', routeId: 12, ratePerTon: 60, keywords: ['NACHIPALAYAM', 'SUGUNA'] },
  { unitNumber: 7, name: 'NAMAKKAL', routeId: 13, ratePerTon: 60, keywords: ['NAMAKKAL'] },
  { unitNumber: 8, name: 'PUDHUCHATHRAM', routeId: 14, ratePerTon: 60, keywords: ['PUDHUCHATHARAM', 'PUDHUCHATHRAM'] },
  { unitNumber: 9, name: 'VENNANTHUR', routeId: 15, ratePerTon: 60, keywords: ['VENNANTHUR'] },
];

interface CategoryConfig {
  key: string;
  label: string;
  shortName: string;
  icon: any;
  placeholder: string;
  matchingTypes: string[];
  singleEntry?: boolean; // if true, only 1 entry allowed per trip
}

const EXPENSE_CATEGORIES: CategoryConfig[] = [
  {
    key: 'LOADING',
    label: '1. Loading',
    shortName: 'Loading',
    icon: Truck,
    placeholder: 'e.g. Warehouse loading, labour charge',
    matchingTypes: ['LOADING'],
    singleEntry: true,
  },
  {
    key: 'UNLOADING',
    label: '2. Unloading',
    shortName: 'Unloading',
    icon: ArrowDownCircle,
    placeholder: 'e.g. Destination unloading labour',
    matchingTypes: ['UNLOADING'],
    singleEntry: true,
  },
  {
    key: 'DRIVER_BATA',
    label: '3. Driver Bata',
    shortName: 'Driver Bata',
    icon: UserCheck,
    placeholder: 'e.g. Driver daily bata / allowance',
    matchingTypes: ['DRIVER_BATA', 'DRIVER_BETA'],
    singleEntry: true,
  },
  {
    key: 'CLEANING_CHARGE',
    label: '4. Cleaning Charge',
    shortName: 'Cleaning Charge',
    icon: Sparkles,
    placeholder: 'e.g. Truck water wash, container cleaning',
    matchingTypes: ['CLEANING_CHARGE', 'CLEANING'],
    singleEntry: true,
  },
  {
    key: 'OTHER',
    label: '5. Other Expense',
    shortName: 'Other Expense',
    icon: Receipt,
    placeholder: 'e.g. Toll, puncture repair, weighbridge, misc',
    matchingTypes: ['OTHER', 'TOLL', 'FOOD', 'REPAIR', 'FREIGHT_BASED'],
    singleEntry: false,
  },
];

export const DriverExpensesScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip } = route.params as { trip: Trip };

  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(trip.advance_paid || 0);
  const [balanceToDriver, setBalanceToDriver] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Loading amount auto-retrieved based on selected truck
  const [truckLoadingAmount, setTruckLoadingAmount] = useState<number>(0);
  const [truckCleaningAmount, setTruckCleaningAmount] = useState<number>(0);

  // Krishi party detection & units calculation (Unloading is ONLY for Krishi Nutrition Company)
  const isKrishiParty = Boolean(
    (trip.party_name && trip.party_name.toUpperCase().includes('KRISHI')) ||
    trip.party_id === 5
  );
  const goodsWeight = parseFloat(String(trip.goods_weight || 0)) || 0;

  // Dynamic unloading rates fetched from admin panel (updated at loadExpenses time)
  const [dynamicKrishiUnits, setDynamicKrishiUnits] = useState<KrishiUnit[]>(KRISHI_UNITS);

  // Auto-detected Krishi unit (1 to 9) strictly from Step 1 (via route_id or to_location)
  const activeKrishiUnit = (() => {
    if (isKrishiParty) {
      const units = dynamicKrishiUnits;
      let matched = units.find((u) => u.routeId === trip.route_id);
      if (!matched && trip.to_location) {
        const locUpper = trip.to_location.toUpperCase();
        matched = units.find((u) =>
          u.keywords.some((kw) => locUpper.includes(kw.toUpperCase()))
        );
      }
      return matched || units[0];
    }
    return null;
  })();

  const krishiUnloadingRate = activeKrishiUnit ? activeKrishiUnit.ratePerTon : 0;
  // If not Krishi party, unloading is strictly 0
  const krishiUnloadingAmount = isKrishiParty && activeKrishiUnit
    ? Math.round(goodsWeight * krishiUnloadingRate * 100) / 100
    : 0;

  // Total Freight Amount from Step 1
  const totalFreight = (() => {
    const tf = parseFloat(String(trip.total_freight || 0)) || 0;
    if (tf > 0) return tf;
    const gw = parseFloat(String(trip.goods_weight || 0)) || 0;
    const fr = parseFloat(String(trip.freight_rate || 0)) || 0;
    return Math.round(gw * fr * 100) / 100;
  })();

  // Driver Bata Rate Configuration (Default 15% / 0.1500 Multiplier, configurable in Admin Master)
  const [driverBataPercentage, setDriverBataPercentage] = useState<number>(15);
  const [driverBataMultiplier, setDriverBataMultiplier] = useState<number>(0.15);
  const driverBataAmount = Math.round(totalFreight * driverBataMultiplier * 100) / 100;

  // Other Expense Maximum Limit (Default 200, configurable in Admin Master)
  const [maxOtherExpenseLimit, setMaxOtherExpenseLimit] = useState<number>(200);

  // Accordion open/close state: starts closed; user taps to open one at a time
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Track which categories have been prefilled with truck data (for Loading)
  const [autoFilledCategories, setAutoFilledCategories] = useState<Set<string>>(new Set());

  // Input states per category so drafts are preserved
  const [categoryInputs, setCategoryInputs] = useState<
    Record<string, { amount: string; description: string }>
  >({
    LOADING: { amount: '', description: '' },
    UNLOADING: { amount: '', description: '' },
    DRIVER_BATA: { amount: '', description: '' },
    CLEANING_CHARGE: { amount: '', description: '' },
    OTHER: { amount: '', description: '' },
  });

  const [isAddingKey, setIsAddingKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await mobileExpenseService.getTripExpenses(trip.id);
      const fetchedExpenses = res.data.expenses || [];
      setExpenses(fetchedExpenses);
      setTotalExpenses(res.data.total_expenses || 0);
      setAdvancePaid(res.data.advance_paid || 0);
      setBalanceToDriver(res.data.balance_to_driver || 0);

      // 2. Resolve cleaning charge from admin panel per destination unit
      //    Matched by active Krishi unit keywords or trip's to_location.
      let cleaningExp = 0;
      try {
        const cleaningRates = await mobileLookupService.getCleaningExpenseRates();
        if (cleaningRates.data && cleaningRates.data.length > 0) {
          let matched: typeof cleaningRates.data[0] | undefined;

          // Priority 1: match using all keywords of the active Krishi unit
          if (activeKrishiUnit) {
            matched = cleaningRates.data.find((cr) =>
              cr.unit_name &&
              activeKrishiUnit.keywords.some((kw) =>
                cr.unit_name.toUpperCase().includes(kw.toUpperCase()) ||
                kw.toUpperCase().includes(cr.unit_name.toUpperCase())
              )
            );
          }

          // Priority 2: match by trip's to_location against unit_name
          if (!matched && trip.to_location) {
            const locUpper = trip.to_location.toUpperCase();
            matched = cleaningRates.data.find((cr) =>
              cr.unit_name &&
              (locUpper.includes(cr.unit_name.toUpperCase()) ||
               cr.unit_name.toUpperCase().split(/[\s\-–]+/).some((word: string) => locUpper.includes(word)))
            );
          }

          if (matched) {
            cleaningExp = parseFloat(String(matched.cleaning_charge)) || 0;
          }
        }
      } catch (e) {
        console.log('Could not fetch cleaning expense rates:', e);
      }
      setTruckCleaningAmount(cleaningExp);

      // 1. Resolve truck loading amount — ALWAYS from the selected truck's goodshed_loading_expense
      //    Loading is truck-specific. cleaning_expense_rates.loading_expense is NOT used here.
      let loadingExp = 0;
      if (trip.vehicle_id) {
        // Primary: fetch the selected truck's loading expense directly
        try {
          const vRes = await mobileLookupService.getVehicles();
          const vehicle = vRes.data.items.find((v) => v.id === trip.vehicle_id);
          if (vehicle && vehicle.goodshed_loading_expense) {
            loadingExp = parseFloat(String(vehicle.goodshed_loading_expense)) || 0;
          }
        } catch (e) {
          console.log('Could not fetch vehicle lookup:', e);
        }
      }
      // Fallback: trip-level loading expense (if vehicle lookup failed)
      if (loadingExp <= 0) {
        loadingExp = parseFloat(String(trip.goodshed_loading_expense || 0)) || 0;
      }

      setTruckLoadingAmount(loadingExp);

      // 3b. Fetch unloading rates from admin panel and override KRISHI_UNITS ratePerTon
      if (isKrishiParty) {
        try {
          const unloadingRes = await mobileLookupService.getUnloadingRates(trip.party_id);
          if (unloadingRes.data && unloadingRes.data.length > 0) {
            // Merge fetched rates into KRISHI_UNITS by matching route_id or unit_name keywords
            const updatedUnits = KRISHI_UNITS.map((ku) => {
              // Try to match by route_id first
              let fetched = unloadingRes.data.find(
                (ur) => ur.route_id !== null && ur.route_id === ku.routeId
              );
              // Fallback: match by unit_name keyword
              if (!fetched) {
                fetched = unloadingRes.data.find((ur) =>
                  ur.unit_name &&
                  ku.keywords.some((kw) =>
                    ur.unit_name.toUpperCase().includes(kw.toUpperCase()) ||
                    kw.toUpperCase().includes(ur.unit_name.toUpperCase())
                  )
                );
              }
              if (fetched && fetched.rate_per_ton !== undefined) {
                return { ...ku, ratePerTon: parseFloat(String(fetched.rate_per_ton)) || ku.ratePerTon };
              }
              return ku;
            });
            setDynamicKrishiUnits(updatedUnits);
          }
        } catch (e) {
          console.log('Could not fetch unloading rates from admin panel, using defaults:', e);
        }
      }

      // 3. Resolve Driver Bata rate from master (default 15% / 0.1500)
      let bataMultiplier = 0.15;
      let bataPct = 15;
      try {
        const bataRes = await mobileLookupService.getEffectiveDriverBataRate(trip.party_id);
        if (bataRes.data) {
          bataMultiplier = parseFloat(String(bataRes.data.rate_multiplier)) || 0.15;
          bataPct = parseFloat(String(bataRes.data.rate_percentage)) || (bataMultiplier * 100);
        }
      } catch (e) {
        console.log('Using default 15% bata rate:', e);
      }
      setDriverBataMultiplier(bataMultiplier);
      setDriverBataPercentage(bataPct);

      const calculatedBata = Math.round(totalFreight * bataMultiplier * 100) / 100;

      // 4. Fetch effective Other Expense Limit from Master
      try {
        const limitRes = await mobileLookupService.getEffectiveOtherExpenseLimit(trip.party_id);
        if (limitRes.data && limitRes.data.max_amount !== undefined) {
          setMaxOtherExpenseLimit(parseFloat(String(limitRes.data.max_amount)) || 200);
        }
      } catch (e) {
        console.log('Using default other expense limit 200:', e);
      }

      // 4. Pre-fill Loading, Driver Bata and Cleaning Charge drafts immediately
      const existingLoading = fetchedExpenses.filter((e: any) => e.expense_type === 'LOADING');
      const existingCleaning = fetchedExpenses.filter((e: any) =>
        e.expense_type === 'CLEANING_CHARGE' || e.expense_type === 'CLEANING'
      );
      const existingBata = fetchedExpenses.filter((e: any) =>
        e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
      );
      setCategoryInputs((prev) => ({
        ...prev,
        LOADING: {
          amount:
            existingLoading.length === 0 && loadingExp > 0
              ? String(loadingExp)
              : prev.LOADING.amount,
          description:
            existingLoading.length === 0 && loadingExp > 0
              ? `Loading charge for ${trip.lorry_number || 'truck'}`
              : prev.LOADING.description,
        },
        DRIVER_BATA: {
          amount:
            existingBata.length === 0 && calculatedBata > 0
              ? String(calculatedBata)
              : prev.DRIVER_BATA?.amount || '',
          description:
            existingBata.length === 0 && calculatedBata > 0
              ? `Driver Bata (${bataPct}% of Total Freight ₹${totalFreight})`
              : prev.DRIVER_BATA?.description || '',
        },
        CLEANING_CHARGE: {
          amount:
            existingCleaning.length === 0 && prev.CLEANING_CHARGE.amount === '' && cleaningExp > 0
              ? String(cleaningExp)
              : prev.CLEANING_CHARGE.amount,
          description:
            existingCleaning.length === 0 && prev.CLEANING_CHARGE.description === '' && cleaningExp > 0
              ? activeKrishiUnit
                ? `Cleaning charge: Unit ${activeKrishiUnit.unitNumber} - ${activeKrishiUnit.name}`
                : `Cleaning charge for ${trip.to_location || trip.lorry_number || 'truck'}`
              : prev.CLEANING_CHARGE.description,
        },
      }));
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (catKey: string) => {
    setError('');
    setOpenCategory((prev) => {
      if (prev === catKey) return null; // close if already open

      // When opening LOADING, auto-fill amount from truck if not already set and no entry yet
      if (catKey === 'LOADING' && truckLoadingAmount > 0) {
        const existingLoading = expenses.filter((e) => e.expense_type === 'LOADING');
        if (existingLoading.length === 0) {
          setCategoryInputs((inputs) => ({
            ...inputs,
            LOADING: {
              amount: String(truckLoadingAmount),
              description:
                inputs.LOADING.description ||
                `Loading charge for ${trip.lorry_number || 'truck'}`,
            },
          }));
          setAutoFilledCategories((s) => new Set(s).add('LOADING'));
        }
      }

      // When opening UNLOADING, auto-fill for Krishi party based on weight * unit rate
      if (catKey === 'UNLOADING' && isKrishiParty && activeKrishiUnit && krishiUnloadingAmount > 0) {
        const existingUnloading = expenses.filter((e) => e.expense_type === 'UNLOADING');
        if (existingUnloading.length === 0) {
          setCategoryInputs((inputs) => ({
            ...inputs,
            UNLOADING: {
              amount: inputs.UNLOADING.amount || String(krishiUnloadingAmount),
              description:
                inputs.UNLOADING.description ||
                `Unloading Unit ${activeKrishiUnit.unitNumber}: ${activeKrishiUnit.name} (${goodsWeight} T @ ₹${activeKrishiUnit.ratePerTon}/T)`,
            },
          }));
          setAutoFilledCategories((s) => new Set(s).add('UNLOADING'));
        }
      }

      // When opening CLEANING_CHARGE, auto-fill amount and unit-specific description
      if (catKey === 'CLEANING_CHARGE' && truckCleaningAmount > 0) {
        const existingCleaning = expenses.filter(
          (e) => e.expense_type === 'CLEANING_CHARGE' || e.expense_type === 'CLEANING'
        );
        if (existingCleaning.length === 0) {
          setCategoryInputs((inputs) => ({
            ...inputs,
            CLEANING_CHARGE: {
              amount: inputs.CLEANING_CHARGE.amount || String(truckCleaningAmount),
              description:
                inputs.CLEANING_CHARGE.description ||
                (activeKrishiUnit
                  ? `Cleaning charge: Unit ${activeKrishiUnit.unitNumber} - ${activeKrishiUnit.name}`
                  : `Cleaning charge for ${trip.to_location || trip.lorry_number || 'truck'}`),
            },
          }));
          setAutoFilledCategories((s) => new Set(s).add('CLEANING_CHARGE'));
        }
      }

      // When opening DRIVER_BATA, auto-fill calculated amount from freight
      if (catKey === 'DRIVER_BATA' && driverBataAmount > 0) {
        const existingBata = expenses.filter(
          (e) => e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
        );
        if (existingBata.length === 0) {
          setCategoryInputs((inputs) => ({
            ...inputs,
            DRIVER_BATA: {
              amount: String(driverBataAmount),
              description:
                inputs.DRIVER_BATA?.description ||
                `Driver Bata (${driverBataPercentage}% of Total Freight ₹${totalFreight})`,
            },
          }));
          setAutoFilledCategories((s) => new Set(s).add('DRIVER_BATA'));
        }
      }

      return catKey;
    });
  };

  // Key order for auto-advance after save
  const CATEGORY_KEYS = EXPENSE_CATEGORIES.map((c) => c.key);

  const handleInputChange = (catKey: string, field: 'amount' | 'description', value: string) => {
    setCategoryInputs((prev) => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        [field]: value,
      },
    }));
  };

  const handleAddExpense = async (catKey: string) => {
    const input = categoryInputs[catKey] || { amount: '', description: '' };
    let amt = parseFloat(input.amount);
    let desc = input.description.trim();

    // If Loading and truck rate exists, strictly enforce the truck loading rate
    if (catKey === 'LOADING' && truckLoadingAmount > 0) {
      amt = truckLoadingAmount;
    }

    // If Driver Bata and calculated rate exists, strictly enforce the Driver Bata rate
    if (catKey === 'DRIVER_BATA' && driverBataAmount > 0) {
      amt = driverBataAmount;
      if (!desc) {
        desc = `Driver Bata (${driverBataPercentage}% of Total Freight ₹${totalFreight})`;
      }
    }

    // If Cleaning Charge and truck cleaning rate exists, strictly enforce it
    if (catKey === 'CLEANING_CHARGE' && truckCleaningAmount > 0) {
      amt = truckCleaningAmount;
      if (!desc) {
        desc = `Cleaning charge for ${trip.lorry_number || 'truck'}`;
      }
    }

    // If Other Expense, enforce maximum allowed limit from Admin Master
    if (catKey === 'OTHER' && !isNaN(amt) && amt > maxOtherExpenseLimit) {
      Alert.alert(
        'Amount Exceeds Allowed Limit',
        `Maximum allowed amount for Other Expenses is ₹${maxOtherExpenseLimit} (as configured in Admin Master). You entered ₹${amt}.\n\nPlease enter an amount less than or equal to ₹${maxOtherExpenseLimit}.`
      );
      setError(`Other expense amount cannot exceed the master table limit of ₹${maxOtherExpenseLimit}.`);
      return;
    }

    if (isNaN(amt) || amt <= 0) {
      setError(`Please enter a valid amount > 0 for ${catKey.replace(/_/g, ' ')}.`);
      return;
    }

    try {
      setIsAddingKey(catKey);
      setError('');
      await mobileExpenseService.addExpense(trip.id, {
        expense_type: catKey,
        description: desc || undefined,
        amount: amt,
      });

      // Clear input for this category
      setCategoryInputs((prev) => ({
        ...prev,
        [catKey]: { amount: '', description: '' },
      }));

      await loadExpenses();

      // Auto-advance: open the next category after saving
      const currentIndex = CATEGORY_KEYS.indexOf(catKey);
      let nextKey: string | null = null;
      if (currentIndex >= 0 && currentIndex < CATEGORY_KEYS.length - 1) {
        nextKey = CATEGORY_KEYS[currentIndex + 1];
        // If advancing from LOADING into UNLOADING, but party is NOT Krishi, skip UNLOADING directly to DRIVER_BATA
        if (nextKey === 'UNLOADING' && !isKrishiParty) {
          nextKey = 'DRIVER_BATA';
        }
      }

      if (nextKey) {
        // Auto-fill LOADING amount if advancing INTO it
        if (nextKey === 'LOADING' && truckLoadingAmount > 0) {
          setCategoryInputs((inputs) => ({
            ...inputs,
            LOADING: {
              amount: String(truckLoadingAmount),
              description: inputs.LOADING.description || `Loading charge for ${trip.lorry_number || 'truck'}`,
            },
          }));
          setAutoFilledCategories((s) => new Set(s).add('LOADING'));
        }

        // Auto-fill UNLOADING if advancing INTO it for Krishi
        if (nextKey === 'UNLOADING' && isKrishiParty && activeKrishiUnit && krishiUnloadingAmount > 0) {
          const existingUnloading = expenses.filter((e) => e.expense_type === 'UNLOADING');
          if (existingUnloading.length === 0) {
            setCategoryInputs((inputs) => ({
              ...inputs,
              UNLOADING: {
                amount: inputs.UNLOADING.amount || String(krishiUnloadingAmount),
                description:
                  inputs.UNLOADING.description ||
                  `Unloading Unit ${activeKrishiUnit.unitNumber}: ${activeKrishiUnit.name} (${goodsWeight} T @ ₹${activeKrishiUnit.ratePerTon}/T)`,
              },
            }));
          }
        }

        // Auto-fill DRIVER_BATA if advancing INTO it
        if (nextKey === 'DRIVER_BATA' && driverBataAmount > 0) {
          const existingBata = expenses.filter(
            (e) => e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
          );
          if (existingBata.length === 0) {
            setCategoryInputs((inputs) => ({
              ...inputs,
              DRIVER_BATA: {
                amount: String(driverBataAmount),
                description:
                  inputs.DRIVER_BATA?.description ||
                  `Driver Bata (${driverBataPercentage}% of Total Freight ₹${totalFreight})`,
              },
            }));
            setAutoFilledCategories((s) => new Set(s).add('DRIVER_BATA'));
          }
        }

        setOpenCategory(nextKey);
      } else {
        // Last category saved — close accordion
        setOpenCategory(null);
      }
    } catch (err: any) {
      setError(err.message || `Failed to add ${catKey.replace(/_/g, ' ')} expense.`);
    } finally {
      setIsAddingKey(null);
    }
  };

  const handleDeleteExpense = (id: number, label: string) => {
    Alert.alert('Delete Expense', `Are you sure you want to remove this ${label} entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await mobileExpenseService.deleteExpense(id);
            await loadExpenses();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete expense.');
          }
        },
      },
    ]);
  };

  const handleVerifyAndGenerate = async () => {
    try {
      setIsGenerating(true);
      setError('');

      let settlement: Settlement;
      try {
        const genRes = await mobileSettlementService.generateSettlement(trip.id);
        settlement = genRes.data;
      } catch (e: any) {
        const existRes = await mobileSettlementService.getSettlementByTripId(trip.id);
        settlement = existRes.data;
      }

      navigation.navigate('SettlementReceipt', { trip, settlement });
    } catch (err: any) {
      setError(err.message || 'Failed to generate settlement slip.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryItems = (cat: CategoryConfig) => {
    return expenses.filter((exp) => cat.matchingTypes.includes(exp.expense_type));
  };

  const getCategoryTotal = (cat: CategoryConfig) => {
    return getCategoryItems(cat).reduce((sum, exp) => sum + (parseFloat(String(exp.amount)) || 0), 0);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Expenses...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeading}>Driver Expenses Entry</Text>
      <Text style={styles.screenSub}>
        Trip #{trip.id} • Driver: {trip.driver_name || 'Driver'} ({trip.lorry_number || ''})
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <AlertCircle size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Summary KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL EXPENSES</Text>
          <Text style={styles.kpiValue}>{formatCurrency(totalExpenses)}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ADVANCE GIVEN</Text>
          <Text style={styles.kpiValue}>{formatCurrency(advancePaid)}</Text>
        </View>
      </View>

      {/* Balance to Driver Banner */}
      <View
        style={[
          styles.balanceBanner,
          balanceToDriver >= 0 ? styles.balanceBannerPositive : styles.balanceBannerNegative,
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.balanceBannerTitle}>
            {balanceToDriver >= 0 ? 'BALANCE TO PAY DRIVER' : 'DRIVER ADVANCE RETURN DUE'}
          </Text>
          <Text style={styles.balanceBannerSub}>
            Expenses {formatCurrency(totalExpenses)} - Advance {formatCurrency(advancePaid)}
          </Text>
        </View>
        <Text
          style={[
            styles.balanceBannerAmount,
            { color: balanceToDriver >= 0 ? COLORS.successDark : COLORS.dangerDark },
          ]}
        >
          {formatCurrency(Math.abs(balanceToDriver))}
        </Text>
      </View>

      {/* 5-Category Expense Breakdown: Loading + Unloading + Driver Bata + Cleaning + Other */}
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownHeaderRow}>
          <Text style={styles.breakdownCardTitle}>EXPENSES CALCULATION BREAKDOWN</Text>
          <Text style={styles.breakdownCardSub}>Loading + Unloading + Driver Bata + Cleaning + Other</Text>
        </View>

        <View style={styles.breakdownItemsRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownItemLabel}>1. Loading</Text>
            <Text style={styles.breakdownItemVal}>{formatCurrency(getCategoryTotal(EXPENSE_CATEGORIES[0]))}</Text>
          </View>
          <Text style={styles.breakdownPlus}>+</Text>

          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownItemLabel}>2. Unloading</Text>
            <Text style={[styles.breakdownItemVal, !isKrishiParty && { color: COLORS.textMuted }]}>
              {isKrishiParty ? formatCurrency(getCategoryTotal(EXPENSE_CATEGORIES[1])) : '₹0'}
            </Text>
            {!isKrishiParty && <Text style={styles.breakdownZeroTag}>Non-Krishi</Text>}
          </View>
          <Text style={styles.breakdownPlus}>+</Text>

          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownItemLabel}>3. Driver Bata</Text>
            <Text style={styles.breakdownItemVal}>{formatCurrency(getCategoryTotal(EXPENSE_CATEGORIES[2]))}</Text>
          </View>
          <Text style={styles.breakdownPlus}>+</Text>

          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownItemLabel}>4. Cleaning</Text>
            <Text style={styles.breakdownItemVal}>{formatCurrency(getCategoryTotal(EXPENSE_CATEGORIES[3]))}</Text>
          </View>
          <Text style={styles.breakdownPlus}>+</Text>

          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownItemLabel}>5. Other</Text>
            <Text style={styles.breakdownItemVal}>{formatCurrency(getCategoryTotal(EXPENSE_CATEGORIES[4]))}</Text>
          </View>
        </View>

        <View style={styles.breakdownTotalBar}>
          <Text style={styles.breakdownTotalBarLabel}>TOTAL EXPENSES:</Text>
          <Text style={styles.breakdownTotalBarValue}>{formatCurrency(totalExpenses)}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeaderTitle}>EXPENSE CATEGORIES</Text>
      <Text style={styles.sectionHeaderSub}>
        Tap any category to open, enter details, and close
      </Text>

      {/* Accordion Categories */}
      {EXPENSE_CATEGORIES.map((cat) => {
        const isOpen = openCategory === cat.key;
        const catItems = getCategoryItems(cat);
        const catTotal = getCategoryTotal(cat);
        const IconComponent = cat.icon;
        const currentDraft = categoryInputs[cat.key] || { amount: '', description: '' };
        const isAdding = isAddingKey === cat.key;

        return (
          <View
            key={cat.key}
            style={[styles.accordionCard, isOpen && styles.accordionCardOpen]}
          >
            {/* Header: Click to Open / Close */}
            <TouchableOpacity
              style={[styles.accordionHeader, isOpen && styles.accordionHeaderOpen]}
              onPress={() => toggleCategory(cat.key)}
              activeOpacity={0.7}
            >
              <View style={styles.headerLeft}>
                <View style={[styles.categoryIconBadge, isOpen && styles.categoryIconBadgeActive]}>
                  <IconComponent size={18} color={isOpen ? COLORS.white : COLORS.primary} />
                </View>
                <View>
                  <Text style={[styles.categoryTitle, isOpen && styles.categoryTitleActive]}>
                    {cat.label}
                  </Text>
                  {catItems.length > 0 ? (
                    <Text style={styles.entryCountText}>
                      {catItems.length} {catItems.length === 1 ? 'entry recorded' : 'entries recorded'}
                    </Text>
                  ) : cat.key === 'LOADING' && truckLoadingAmount > 0 ? (
                    <Text style={styles.autoRateHintText}>
                      Truck rate: {formatCurrency(truckLoadingAmount)}
                    </Text>
                  ) : cat.key === 'UNLOADING' ? (
                    isKrishiParty && activeKrishiUnit ? (
                      <Text style={styles.autoRateHintText}>
                        Unit {activeKrishiUnit.unitNumber} ({activeKrishiUnit.name}): {formatCurrency(krishiUnloadingAmount)}
                      </Text>
                    ) : (
                      <Text style={[styles.autoRateHintText, { color: COLORS.textMuted }]}>
                        Not applicable (Krishi only)
                      </Text>
                    )
                  ) : cat.key === 'DRIVER_BATA' && driverBataAmount > 0 ? (
                    <Text style={styles.autoRateHintText}>
                      Auto ({driverBataPercentage}% of Freight): {formatCurrency(driverBataAmount)}
                    </Text>
                  ) : cat.key === 'OTHER' ? (
                    <Text style={[styles.autoRateHintText, { color: COLORS.textMuted }]}>
                      Manual (Max: {formatCurrency(maxOtherExpenseLimit)})
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.headerRight}>
                {catTotal > 0 ? (
                  <View style={styles.totalBadgeActive}>
                    <Text style={styles.totalBadgeActiveText}>{formatCurrency(catTotal)}</Text>
                  </View>
                ) : cat.key === 'LOADING' && truckLoadingAmount > 0 ? (
                  <View style={styles.totalBadgeAuto}>
                    <Text style={styles.totalBadgeAutoText}>Rate: {formatCurrency(truckLoadingAmount)}</Text>
                  </View>
                ) : cat.key === 'UNLOADING' ? (
                  isKrishiParty && activeKrishiUnit && krishiUnloadingAmount > 0 ? (
                    <View style={styles.totalBadgeAuto}>
                      <Text style={styles.totalBadgeAutoText}>Rate: {formatCurrency(krishiUnloadingAmount)}</Text>
                    </View>
                  ) : (
                    <View style={styles.totalBadgeMuted}>
                      <Text style={styles.totalBadgeMutedText}>{isKrishiParty ? '₹0' : 'N/A'}</Text>
                    </View>
                  )
                ) : cat.key === 'DRIVER_BATA' && driverBataAmount > 0 ? (
                  <View style={styles.totalBadgeAuto}>
                    <Text style={styles.totalBadgeAutoText}>Rate: {formatCurrency(driverBataAmount)}</Text>
                  </View>
                ) : cat.key === 'OTHER' ? (
                  <View style={[styles.totalBadgeAuto, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                    <Text style={[styles.totalBadgeAutoText, { color: '#b45309' }]}>Max: {formatCurrency(maxOtherExpenseLimit)}</Text>
                  </View>
                ) : (
                  <View style={styles.totalBadgeMuted}>
                    <Text style={styles.totalBadgeMutedText}>₹0</Text>
                  </View>
                )}
                {isOpen ? (
                  <ChevronUp size={20} color={COLORS.primary} />
                ) : (
                  <ChevronDown size={20} color={COLORS.textMuted} />
                )}
              </View>
            </TouchableOpacity>

            {/* Collapsible Body: Put Entry & View Items */}
            {isOpen && (
              <View style={styles.accordionBody}>
                {/* Auto-detected truck rate callout for Loading */}
                {cat.key === 'LOADING' && truckLoadingAmount > 0 && (
                  <View style={styles.autoRateCallout}>
                    <View style={styles.autoRateCalloutLeft}>
                      <Truck size={16} color={COLORS.accent} />
                      <Text style={styles.autoRateCalloutText}>
                        Auto-detected from truck ({trip.lorry_number || 'Truck'}):{' '}
                        <Text style={styles.autoRateBold}>{formatCurrency(truckLoadingAmount)}</Text>
                      </Text>
                    </View>
                    <View style={styles.lockedBadgeSmall}>
                      <Text style={styles.lockedBadgeSmallText}>🔒 Fixed Rate</Text>
                    </View>
                  </View>
                )}

                {/* Krishi Nutrition Company Unloading Section */}
                {cat.key === 'UNLOADING' && (
                  isKrishiParty ? (
                    <View style={styles.krishiUnloadingBox}>
                      <View style={styles.krishiHeaderRow}>
                        <View style={styles.krishiIconBadge}>
                          <Building2 size={16} color={COLORS.white} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.krishiCompanyTitle}>KRISHI NUTRITION COMPANY</Text>
                          <Text style={styles.krishiUnitSub}>
                            Unit {activeKrishiUnit?.unitNumber}: {activeKrishiUnit?.name}
                          </Text>
                        </View>
                        <View style={styles.krishiRateTag}>
                          <Text style={styles.krishiRateTagText}>
                            ₹{activeKrishiUnit?.ratePerTon}/Ton
                          </Text>
                        </View>
                      </View>

                      {/* Formula display: Weight × Rate = Amount (Auto from Step 1) */}
                      <View style={styles.krishiFormulaRow}>
                        <View style={styles.formulaItem}>
                          <Text style={styles.formulaLabel}>GOODS WEIGHT (STEP 1)</Text>
                          <Text style={styles.formulaValue}>{goodsWeight} Tons</Text>
                        </View>
                        <Text style={styles.formulaOp}>×</Text>
                        <View style={styles.formulaItem}>
                          <Text style={styles.formulaLabel}>UNIT RATE</Text>
                          <Text style={styles.formulaValue}>₹{activeKrishiUnit?.ratePerTon}/T</Text>
                        </View>
                        <Text style={styles.formulaOp}>=</Text>
                        <View style={styles.formulaItemResult}>
                          <Text style={styles.formulaLabelResult}>UNLOADING TOTAL</Text>
                          <Text style={styles.formulaValueResult}>{formatCurrency(krishiUnloadingAmount)}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null
                )}

                {/* Driver Bata Section */}
                {cat.key === 'DRIVER_BATA' && (
                  <View style={styles.bataCalloutBox}>
                    <View style={styles.bataHeaderRow}>
                      <View style={styles.bataIconBadge}>
                        <UserCheck size={16} color={COLORS.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bataTitle}>DRIVER BATA (ALLOWANCE)</Text>
                        <Text style={styles.bataSub}>
                          {driverBataPercentage}% of Total Freight Amount ({formatCurrency(totalFreight)})
                        </Text>
                      </View>
                      <View style={styles.lockedBadgeSmall}>
                        <Text style={styles.lockedBadgeSmallText}>🔒 {driverBataPercentage}% Fixed Rate</Text>
                      </View>
                    </View>

                    {/* Formula display: Total Freight × Rate = Driver Bata */}
                    <View style={styles.bataFormulaRow}>
                      <View style={styles.formulaItem}>
                        <Text style={styles.formulaLabel}>TOTAL FREIGHT</Text>
                        <Text style={styles.formulaValue}>{formatCurrency(totalFreight)}</Text>
                      </View>
                      <Text style={styles.formulaOp}>×</Text>
                      <View style={styles.formulaItem}>
                        <Text style={styles.formulaLabel}>BATA RATE</Text>
                        <Text style={styles.formulaValue}>{driverBataPercentage}% ({driverBataMultiplier})</Text>
                      </View>
                      <Text style={styles.formulaOp}>=</Text>
                      <View style={styles.formulaItemResult}>
                        <Text style={styles.formulaLabelResult}>DRIVER BATA</Text>
                        <Text style={styles.formulaValueResult}>{formatCurrency(driverBataAmount)}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Auto-detected mapped rate callout for Cleaning Charge */}
                {cat.key === 'CLEANING_CHARGE' && truckCleaningAmount > 0 && (
                  <View style={styles.autoRateCallout}>
                    <View style={styles.autoRateCalloutLeft}>
                      <Sparkles size={16} color={COLORS.accent} />
                      <Text style={styles.autoRateCalloutText}>
                        Truck Cleaning Charge:{' '}
                        <Text style={styles.autoRateBold}>{formatCurrency(truckCleaningAmount)}</Text>
                      </Text>
                    </View>
                    {currentDraft.amount !== String(truckCleaningAmount) && (
                      <TouchableOpacity
                        style={styles.resetRatePill}
                        onPress={() => handleInputChange('CLEANING_CHARGE', 'amount', String(truckCleaningAmount))}
                        activeOpacity={0.7}
                      >
                        <RotateCcw size={12} color={COLORS.accent} />
                        <Text style={styles.resetRatePillText}>Auto-fill</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Existing entries for this category */}
                {catItems.length > 0 && (
                  <View style={styles.itemsList}>
                    <Text style={styles.itemsListTitle}>Recorded Entries:</Text>
                    {catItems.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                          {item.description ? (
                            <Text style={styles.itemDescription}>{item.description}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteExpense(item.id, cat.shortName)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Entry Form — hidden for single-entry categories that already have 1 entry */}
                {cat.singleEntry && catItems.length >= 1 ? (
                  // Done state: entry already saved, cannot add another
                  <View style={styles.doneState}>
                    <View style={styles.doneStateIconRow}>
                      <View style={styles.doneStateIcon}>
                        <Text style={styles.doneStateIconText}>✓</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.doneStateTitle}>
                          {cat.shortName} entry saved
                        </Text>
                        <Text style={styles.doneStateSub}>
                          {formatCurrency(catItems[0].amount)}
                          {catItems[0].description ? ` — ${catItems[0].description}` : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.closeCardBtn}
                      onPress={() => setOpenCategory(null)}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={COLORS.textMuted} />
                      <Text style={styles.closeCardBtnText}>CLOSE</Text>
                    </TouchableOpacity>
                  </View>
                ) : cat.key === 'UNLOADING' && !isKrishiParty ? (
                  // Non-Krishi Party notice: unloading is not applicable
                  <View style={styles.nonKrishiNoticeBox}>
                    <View style={styles.nonKrishiIconRow}>
                      <AlertCircle size={20} color={COLORS.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nonKrishiNoticeTitle}>
                          Unloading is only for Krishi Nutrition Company units
                        </Text>
                        <Text style={styles.nonKrishiNoticeSub}>
                          This trip is for "{trip.party_name || 'other party'}". Unloading charges are only applicable for Krishi parties and their 9 units.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.nonKrishiActionRow}>
                      <TouchableOpacity
                        style={styles.closeCardBtn}
                        onPress={() => setOpenCategory(null)}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={COLORS.textMuted} />
                        <Text style={styles.closeCardBtnText}>CLOSE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.skipToNextBtn}
                        onPress={() => setOpenCategory('DRIVER_BATA')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.skipToNextBtnText}>GO TO DRIVER BATA</Text>
                        <ArrowRight size={16} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : cat.key === 'UNLOADING' && isKrishiParty ? (
                  // Krishi unloading: read-only confirmed amount, no editable input
                  <View style={styles.entryFormContainer}>
                    <View style={styles.unloadingLockedBox}>
                      <View style={styles.unloadingLockedLeft}>
                        <Text style={styles.unloadingLockedLabel}>CALCULATED AMOUNT</Text>
                        <Text style={styles.unloadingLockedAmount}>{formatCurrency(krishiUnloadingAmount)}</Text>
                        <Text style={styles.unloadingLockedFormula}>
                          {goodsWeight} Tons × ₹{activeKrishiUnit?.ratePerTon}/T
                        </Text>
                      </View>
                      <View style={styles.unloadingLockedBadge}>
                        <Text style={styles.unloadingLockedBadgeText}>🔒 Auto</Text>
                      </View>
                    </View>

                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.closeCardBtn}
                        onPress={() => setOpenCategory(null)}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={COLORS.textMuted} />
                        <Text style={styles.closeCardBtnText}>CLOSE</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.addEntryBtn, isAdding && { opacity: 0.7 }]}
                        onPress={() => {
                          // Save unloading with the auto-calculated amount and description
                          setCategoryInputs((prev) => ({
                            ...prev,
                            UNLOADING: {
                              amount: String(krishiUnloadingAmount),
                              description: `Unloading ${activeKrishiUnit?.name || ''} (${goodsWeight}T × ₹${activeKrishiUnit?.ratePerTon}/T)`,
                            },
                          }));
                          handleAddExpense('UNLOADING');
                        }}
                        disabled={isAdding}
                        activeOpacity={0.8}
                      >
                        {isAdding ? (
                          <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                          <>
                            <Plus size={16} color={COLORS.white} />
                            <Text style={styles.addEntryBtnText}>SAVE ENTRY</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.entryFormContainer}>
                    <Text style={styles.entryFormTitle}>+ Add {cat.shortName} Entry</Text>

                    <View style={styles.formGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={styles.inputLabel}>Amount (₹) *</Text>
                        {cat.key === 'LOADING' && truckLoadingAmount > 0 && (
                          <View style={styles.lockedBadgeSmall}>
                            <Text style={styles.lockedBadgeSmallText}>🔒 Fixed from truck</Text>
                          </View>
                        )}
                        {cat.key === 'DRIVER_BATA' && driverBataAmount > 0 && (
                          <View style={styles.lockedBadgeSmall}>
                            <Text style={styles.lockedBadgeSmallText}>🔒 Auto ({driverBataPercentage}% of Freight)</Text>
                          </View>
                        )}
                        {cat.key === 'CLEANING_CHARGE' && truckCleaningAmount > 0 && (
                          <View style={styles.lockedBadgeSmall}>
                            <Text style={styles.lockedBadgeSmallText}>🔒 Fixed from truck</Text>
                          </View>
                        )}
                        {cat.key === 'OTHER' && (
                          <View style={[styles.lockedBadgeSmall, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                            <Text style={[styles.lockedBadgeSmallText, { color: '#b45309' }]}>
                              📌 Max Limit: ₹{maxOtherExpenseLimit}
                            </Text>
                          </View>
                        )}
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          cat.key === 'LOADING' && truckLoadingAmount > 0 && styles.inputDisabled,
                          cat.key === 'DRIVER_BATA' && driverBataAmount > 0 && styles.inputDisabled,
                          cat.key === 'CLEANING_CHARGE' && truckCleaningAmount > 0 && styles.inputDisabled,
                          cat.key === 'OTHER' &&
                            parseFloat(currentDraft.amount) > maxOtherExpenseLimit && {
                              borderColor: COLORS.danger,
                              borderWidth: 1.5,
                              backgroundColor: '#fff1f2',
                            },
                        ]}
                        placeholder="e.g. 200"
                        placeholderTextColor={COLORS.textLight}
                        keyboardType="decimal-pad"
                        value={
                          cat.key === 'LOADING' && truckLoadingAmount > 0
                            ? String(truckLoadingAmount)
                            : cat.key === 'DRIVER_BATA' && driverBataAmount > 0
                            ? String(driverBataAmount)
                            : cat.key === 'CLEANING_CHARGE' && truckCleaningAmount > 0
                            ? String(truckCleaningAmount)
                            : currentDraft.amount
                        }
                        editable={
                          (cat.key !== 'LOADING' || truckLoadingAmount <= 0) &&
                          (cat.key !== 'DRIVER_BATA' || driverBataAmount <= 0) &&
                          (cat.key !== 'CLEANING_CHARGE' || truckCleaningAmount <= 0)
                        }
                        onChangeText={(val) => handleInputChange(cat.key, 'amount', val)}
                        onBlur={() => {
                          if (cat.key === 'OTHER') {
                            const val = parseFloat(currentDraft.amount);
                            if (!isNaN(val) && val > maxOtherExpenseLimit) {
                              Alert.alert(
                                'Amount Exceeds Allowed Limit',
                                `Only allowed up to the master table value of ₹${maxOtherExpenseLimit}. You entered ₹${val}.\n\nPlease enter an amount less than or equal to ₹${maxOtherExpenseLimit}.`,
                                [
                                  {
                                    text: 'Set to Max Limit',
                                    onPress: () => handleInputChange('OTHER', 'amount', String(maxOtherExpenseLimit)),
                                  },
                                  {
                                    text: 'Clear',
                                    style: 'destructive',
                                    onPress: () => handleInputChange('OTHER', 'amount', ''),
                                  },
                                ]
                              );
                            }
                          }
                        }}
                      />
                      {cat.key === 'LOADING' && truckLoadingAmount > 0 && (
                        <Text style={styles.lockedHelperText}>
                          Amount is automatically assigned from the truck's goodshed rate and cannot be edited.
                        </Text>
                      )}
                      {cat.key === 'DRIVER_BATA' && driverBataAmount > 0 && (
                        <Text style={styles.lockedHelperText}>
                          Driver Bata is auto-calculated as {driverBataPercentage}% of Total Freight (₹{totalFreight}) and cannot be edited. Change the rate in Admin → Driver Bata Master.
                        </Text>
                      )}
                      {cat.key === 'CLEANING_CHARGE' && truckCleaningAmount > 0 && (
                        <Text style={styles.lockedHelperText}>
                          Cleaning charge is automatically assigned from the truck master and cannot be edited.
                        </Text>
                      )}
                      {cat.key === 'OTHER' && (
                        <Text
                          style={[
                            styles.lockedHelperText,
                            parseFloat(currentDraft.amount) > maxOtherExpenseLimit && {
                              color: COLORS.danger,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {parseFloat(currentDraft.amount) > maxOtherExpenseLimit
                            ? `⚠️ Amount ₹${currentDraft.amount} exceeds allowed limit of ₹${maxOtherExpenseLimit} (Admin Master).`
                            : `Type amount manually. Maximum allowed limit is ₹${maxOtherExpenseLimit} (configured in Admin Master).`}
                        </Text>
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Notes / Description (Optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={cat.placeholder}
                        placeholderTextColor={COLORS.textLight}
                        value={currentDraft.description}
                        onChangeText={(val) => handleInputChange(cat.key, 'description', val)}
                      />
                    </View>

                    {/* Action Buttons: Close and Save Entry */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.closeCardBtn}
                        onPress={() => setOpenCategory(null)}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={COLORS.textMuted} />
                        <Text style={styles.closeCardBtnText}>CLOSE</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.addEntryBtn, isAdding && { opacity: 0.7 }]}
                        onPress={() => handleAddExpense(cat.key)}
                        disabled={isAdding}
                        activeOpacity={0.8}
                      >
                        {isAdding ? (
                          <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                          <>
                            <Plus size={16} color={COLORS.white} />
                            <Text style={styles.addEntryBtnText}>SAVE ENTRY</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Screen Navigation Buttons: Previous & Generate PDF */}
      <View style={styles.bottomNavigationRow}>
        <TouchableOpacity
          style={styles.navPreviousBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={COLORS.primary} />
          <Text style={styles.navPreviousBtnText}>PREVIOUS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navGenerateBtn, isGenerating && { opacity: 0.7 }]}
          onPress={handleVerifyAndGenerate}
          disabled={isGenerating}
          activeOpacity={0.8}
        >
          {isGenerating ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <FileText size={18} color={COLORS.white} />
              <Text style={styles.navGenerateBtnText}>VERIFY & GENERATE SLIP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl * 1.5,
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
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  balanceBanner: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  balanceBannerPositive: {
    backgroundColor: COLORS.successLight,
    borderColor: '#a7f3d0',
  },
  balanceBannerNegative: {
    backgroundColor: COLORS.dangerLight,
    borderColor: '#fecaca',
  },
  balanceBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  balanceBannerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  balanceBannerAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  sectionHeaderSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  accordionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  accordionCardOpen: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
  },
  accordionHeaderOpen: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconBadgeActive: {
    backgroundColor: COLORS.accent,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  categoryTitleActive: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  entryCountText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  autoRateHintText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalBadgeActive: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  totalBadgeActiveText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.successDark,
  },
  totalBadgeAuto: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  totalBadgeAutoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  totalBadgeMuted: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  totalBadgeMutedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  accordionBody: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
  },
  autoRateCallout: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  autoRateCalloutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  autoRateCalloutText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  autoRateBold: {
    fontWeight: '800',
    color: COLORS.accent,
  },
  resetRatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  resetRatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  itemsList: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemsListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  itemDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  deleteButton: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dangerLight,
  },
  entryFormContainer: {
    marginTop: SPACING.xs,
  },
  // Done state: shown when a single-entry category already has 1 entry saved
  doneState: {
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: '#f0faf4',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#b7e4c7',
    gap: 10,
  },
  doneStateIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneStateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneStateIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  doneStateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1b4332',
  },
  doneStateSub: {
    fontSize: 12,
    color: '#2d6a4f',
    marginTop: 2,
  },
  entryFormTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  formGroup: {
    marginBottom: SPACING.sm,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  autoLoadedTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  input: {
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.sm,
  },
  closeCardBtn: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  closeCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  addEntryBtn: {
    flex: 1.5,
    height: 44,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...SHADOWS.sm,
  },
  addEntryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  bottomNavigationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.lg,
  },
  navPreviousBtn: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.sm,
  },
  navPreviousBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  navGenerateBtn: {
    flex: 1.8,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  navGenerateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  // Krishi Unloading specific styles
  krishiUnloadingBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 10,
  },
  krishiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  krishiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  krishiCompanyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  krishiUnitSub: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  krishiRateTag: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  krishiRateTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  krishiFormulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  formulaItem: {
    alignItems: 'center',
  },
  formulaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  formulaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  formulaOp: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  formulaItemResult: {
    alignItems: 'center',
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  formulaLabelResult: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0891b2',
    marginBottom: 2,
  },
  formulaValueResult: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0e7490',
  },
  krishiRuleBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  krishiRuleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  // Krishi unloading locked (read-only) display
  unloadingLockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  unloadingLockedLeft: {
    flex: 1,
  },
  unloadingLockedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  unloadingLockedAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803d',
    marginBottom: 2,
  },
  unloadingLockedFormula: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4ade80',
  },
  unloadingLockedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  unloadingLockedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  // Live Expenses Calculation Breakdown Card
  breakdownCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    ...SHADOWS.sm,
  },
  breakdownHeaderRow: {
    marginBottom: SPACING.sm,
  },
  breakdownCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  breakdownCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  breakdownItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownItemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 2,
    textAlign: 'center',
  },
  breakdownItemVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  breakdownZeroTag: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.danger,
    marginTop: 1,
  },
  breakdownPlus: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textLight,
    paddingHorizontal: 1,
  },
  breakdownTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  breakdownTotalBarLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  breakdownTotalBarValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
  },
  nonKrishiNoticeBox: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 12,
  },
  nonKrishiIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nonKrishiNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  nonKrishiNoticeSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  nonKrishiActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  skipToNextBtn: {
    flex: 1.5,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  skipToNextBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  lockedBadgeSmall: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm || 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  lockedBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#1e293b',
    borderColor: '#cbd5e1',
    fontWeight: '800',
  },
  lockedHelperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Driver Bata Callout styles
  bataCalloutBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  bataHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bataIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bataTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  bataSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  bataFormulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: SPACING.sm,
  },
});
