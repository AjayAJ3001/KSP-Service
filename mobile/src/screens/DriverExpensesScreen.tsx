import React, { useState, useEffect, useRef } from 'react';
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
  Share2,
  Download,
  Printer,
} from 'lucide-react-native';
import { mobileExpenseService, mobileSettlementService } from '../services/mobileService';
import { Trip, DriverExpense, Settlement } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { printTripPdf, shareTripPdf, downloadTripPdf } from '../utils/pdfGenerator';

type ExpenseDefaults = {
  party_name: string;
  lorry_number: string | null;
  goods_weight: number;
  total_freight: number;
  driver_carry_forward: number;
  other_limit: number;
  unloading_applies: boolean;
  unloading_unit_name: string | null;
  unloading_unit_number: number | null;
  unloading_rate_per_ton: number;
  unloading_amount: number;
  loading_amount: number;
  cleaning_amount: number;
  cleaning_description: string;
  bata_percentage: number;
  bata_multiplier: number;
  bata_amount: number;
};

const EMPTY_DEFAULTS: ExpenseDefaults = {
  party_name: '',
  lorry_number: null,
  goods_weight: 0,
  total_freight: 0,
  driver_carry_forward: 0,
  other_limit: 200,
  unloading_applies: false,
  unloading_unit_name: null,
  unloading_unit_number: null,
  unloading_rate_per_ton: 0,
  unloading_amount: 0,
  loading_amount: 0,
  cleaning_amount: 0,
  cleaning_description: '',
  bata_percentage: 15,
  bata_multiplier: 0.15,
  bata_amount: 0,
};

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
  const { trip, viewOnly } = route.params as { trip: Trip; viewOnly?: boolean };

  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(trip.advance_paid || 0);
  const [balanceToDriver, setBalanceToDriver] = useState(0);
  const [isSettled, setIsSettled] = useState(trip.status === 'SETTLED');
  const [isLoading, setIsLoading] = useState(true);
  const [pdfAction, setPdfAction] = useState<'print' | 'share' | 'download' | null>(null);
  const [defaults, setDefaults] = useState<ExpenseDefaults>({
    ...EMPTY_DEFAULTS,
    party_name: trip.party_name || '',
    lorry_number: trip.lorry_number || null,
    goods_weight: parseFloat(String(trip.goods_weight || 0)) || 0,
    total_freight: Math.round(parseFloat(String(trip.total_freight || 0)) || 0),
  });

  const goodsWeight = defaults.goods_weight;
  const totalFreight = defaults.total_freight;
  const driverCarryForwardBalance = defaults.driver_carry_forward;
  const truckLoadingAmount = defaults.loading_amount;
  const truckCleaningAmount = defaults.cleaning_amount;
  const driverBataPercentage = defaults.bata_percentage;
  const driverBataMultiplier = defaults.bata_multiplier;
  const driverBataAmount = defaults.bata_amount;
  const maxOtherExpenseLimit = defaults.other_limit;
  const unloadingApplies = defaults.unloading_applies;
  const krishiUnloadingAmount = defaults.unloading_amount;
  const activeKrishiUnit = unloadingApplies
    ? {
        unitNumber: defaults.unloading_unit_number || 0,
        name: defaults.unloading_unit_name || trip.to_location || 'Unit',
        ratePerTon: defaults.unloading_rate_per_ton,
      }
    : null;

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
  const autoSavedRef = useRef(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const applyServerDefaults = (payload: any) => {
    const d = payload?.defaults;
    if (!d) return;
    setDefaults({
      party_name: d.party_name || trip.party_name || '',
      lorry_number: d.lorry_number || trip.lorry_number || null,
      goods_weight: Number(d.goods_weight) || 0,
      total_freight: Math.round(Number(d.total_freight) || 0),
      driver_carry_forward: Number(d.driver_carry_forward) || 0,
      other_limit: Number(d.other_limit) || 200,
      unloading_applies: Boolean(d.unloading_applies),
      unloading_unit_name: d.unloading_unit_name || null,
      unloading_unit_number: d.unloading_unit_number ?? null,
      unloading_rate_per_ton: Number(d.unloading_rate_per_ton) || 0,
      unloading_amount: Math.round(Number(d.unloading_amount) || 0),
      loading_amount: Math.round(Number(d.loading_amount) || 0),
      cleaning_amount: Math.round(Number(d.cleaning_amount) || 0),
      cleaning_description: d.cleaning_description || '',
      bata_percentage: Number(d.bata_percentage) || 15,
      bata_multiplier: Number(d.bata_multiplier) || 0.15,
      bata_amount: Math.round(Number(d.bata_amount) || 0),
    });
  };

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const [res, settleRes] = await Promise.all([
        viewOnly
          ? mobileExpenseService.getTripExpenses(trip.id)
          : mobileExpenseService.applyDefaultExpenses(trip.id),
        mobileSettlementService.getSettlementByTripId(trip.id).catch(() => null),
      ]);

      const fetchedExpenses = res.data.expenses || [];
      setExpenses(fetchedExpenses);
      setTotalExpenses(res.data.total_expenses || 0);
      setAdvancePaid(res.data.advance_paid || 0);
      setBalanceToDriver(res.data.balance_to_driver || 0);
      applyServerDefaults(res.data);
      autoSavedRef.current = true;

      if (settleRes?.data?.settlement_status === 'SETTLED') {
        setIsSettled(true);
      }
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save categories that have fixed/calculated amounts — no user button needed
  const AUTO_SAVE_CATEGORIES = ['LOADING', 'UNLOADING', 'DRIVER_BATA', 'CLEANING_CHARGE'];

  const toggleCategory = async (catKey: string) => {
    setError('');

    // Close if already open
    if (openCategory === catKey) {
      setOpenCategory(null);
      return;
    }

    // --- Auto-save logic when OPENING a fixed/calculated category (if no entry exists yet) ---
    if (AUTO_SAVE_CATEGORIES.includes(catKey)) {
      // LOADING
      if (catKey === 'LOADING' && truckLoadingAmount > 0) {
        const existingLoading = expenses.filter((e) => e.expense_type === 'LOADING');
        if (existingLoading.length === 0) {
          try {
            setIsAddingKey('LOADING');
            await mobileExpenseService.addExpense(trip.id, {
              expense_type: 'LOADING',
              description: `Loading charge for ${trip.lorry_number || 'truck'}`,
              amount: truckLoadingAmount,
            });
            await loadExpenses();
          } catch (err: any) {
            setError(err.message || 'Failed to auto-save Loading.');
          } finally {
            setIsAddingKey(null);
          }
        }
      }

      // UNLOADING (only when backend matched an unloading rate for this party/destination)
      if (catKey === 'UNLOADING' && unloadingApplies && activeKrishiUnit && krishiUnloadingAmount > 0) {
        const existingUnloading = expenses.filter((e) => e.expense_type === 'UNLOADING');
        if (existingUnloading.length === 0) {
          try {
            setIsAddingKey('UNLOADING');
            await mobileExpenseService.addExpense(trip.id, {
              expense_type: 'UNLOADING',
              description: `Unloading ${activeKrishiUnit.name} (${goodsWeight}T × ₹${activeKrishiUnit.ratePerTon}/T)`,
              amount: krishiUnloadingAmount,
            });
            await loadExpenses();
          } catch (err: any) {
            setError(err.message || 'Failed to auto-save Unloading.');
          } finally {
            setIsAddingKey(null);
          }
        }
      }

      // DRIVER_BATA
      if (catKey === 'DRIVER_BATA' && driverBataAmount > 0) {
        const existingBata = expenses.filter(
          (e) => e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
        );
        if (existingBata.length === 0) {
          try {
            setIsAddingKey('DRIVER_BATA');
            await mobileExpenseService.addExpense(trip.id, {
              expense_type: 'DRIVER_BATA',
              description: `Driver Bata (${driverBataPercentage}% of Total Freight ₹${totalFreight})`,
              amount: driverBataAmount,
            });
            await loadExpenses();
          } catch (err: any) {
            setError(err.message || 'Failed to auto-save Driver Bata.');
          } finally {
            setIsAddingKey(null);
          }
        }
      }

      // CLEANING_CHARGE
      if (catKey === 'CLEANING_CHARGE' && truckCleaningAmount > 0) {
        const existingCleaning = expenses.filter(
          (e) => e.expense_type === 'CLEANING_CHARGE' || e.expense_type === 'CLEANING'
        );
        if (existingCleaning.length === 0) {
          try {
            setIsAddingKey('CLEANING_CHARGE');
            await mobileExpenseService.addExpense(trip.id, {
              expense_type: 'CLEANING_CHARGE',
              description: defaults.cleaning_description || `Cleaning charge for ${trip.to_location || trip.lorry_number || 'truck'}`,
              amount: truckCleaningAmount,
            });
            await loadExpenses();
          } catch (err: any) {
            setError(err.message || 'Failed to auto-save Cleaning Charge.');
          } finally {
            setIsAddingKey(null);
          }
        }
      }
    }

    setOpenCategory(catKey);
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
    let amt = Math.round(parseFloat(input.amount));
    let desc = input.description.trim();

    // If Loading and truck rate exists, strictly enforce the truck loading rate
    if (catKey === 'LOADING' && truckLoadingAmount > 0) {
      amt = Math.round(truckLoadingAmount);
    }

    // If Driver Bata and calculated rate exists, strictly enforce the Driver Bata rate
    if (catKey === 'DRIVER_BATA' && driverBataAmount > 0) {
      amt = Math.round(driverBataAmount);
      if (!desc) {
        desc = `Driver Bata (${driverBataPercentage}% of Total Freight ₹${totalFreight})`;
      }
    }

    if (catKey === 'CLEANING_CHARGE' && truckCleaningAmount > 0) {
      amt = Math.round(truckCleaningAmount);
      if (!desc) {
        desc = defaults.cleaning_description || `Cleaning charge for ${trip.to_location || trip.lorry_number || 'truck'}`;
      }
    }

    // If Other Expense, enforce maximum allowed limit from Admin Master
    if (catKey === 'OTHER' && !isNaN(amt) && amt > maxOtherExpenseLimit) {
      Alert.alert(
        'Amount Exceeds Allowed Limit',
        `The other expense limit is ₹${maxOtherExpenseLimit}. Please contact admin to increase the limit.`
      );
      setError('Please contact admin to increase the other expense limit.');
      return;
    }

    if (isNaN(amt) || amt <= 0) {
      if (catKey === 'OTHER') {
        setError('');
        setOpenCategory(null);
        return;
      }
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
        if (nextKey === 'UNLOADING' && !unloadingApplies) {
          nextKey = 'DRIVER_BATA';
        }
      }

      if (nextKey === 'OTHER') {
        setOpenCategory(null);
      } else if (nextKey) {
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
        if (nextKey === 'UNLOADING' && unloadingApplies && activeKrishiUnit && krishiUnloadingAmount > 0) {
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

      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'SettlementReceipt', params: { trip, settlement, fromGenerate: true } },
        ],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate settlement slip.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const tripForPdf: Trip = {
    ...trip,
    advance_paid: advancePaid,
    total_expenses: totalExpenses,
    expense_items: expenses.map((e) => ({
      id: e.id,
      expense_type: e.expense_type,
      description: e.description,
      amount: e.amount,
    })),
  };

  const handlePrintTrip = async () => {
    try {
      setPdfAction('print');
      await printTripPdf(tripForPdf);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not print trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  const handleShareTrip = async () => {
    try {
      setPdfAction('share');
      await shareTripPdf(tripForPdf);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  const handleDownloadTrip = async () => {
    try {
      setPdfAction('download');
      const result = await downloadTripPdf(tripForPdf);
      if (result.savedDirectly) {
        Alert.alert('Download Successful', `Trip PDF saved as:\n${result.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not download trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  const getCategoryItems = (cat: CategoryConfig) => {
    return expenses.filter((exp) => cat.matchingTypes.includes(exp.expense_type));
  };

  const getCategoryTotal = (cat: CategoryConfig) => {
    return Math.round(getCategoryItems(cat).reduce((sum, exp) => sum + (parseFloat(String(exp.amount)) || 0), 0));
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
      <Text style={styles.screenHeading}>{viewOnly ? 'Driver Expenses' : 'Driver Expenses Entry'}</Text>
      <Text style={styles.screenSub}>
        Trip #{trip.id} • Driver: {trip.driver_name || 'Driver'} ({trip.lorry_number || ''})
      </Text>

      <View style={styles.pdfActionRow}>
        <TouchableOpacity
          style={[styles.pdfActionBtn, styles.pdfPrintBtn, pdfAction === 'print' && { opacity: 0.7 }]}
          onPress={handlePrintTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'print' ? <ActivityIndicator color="#fff" size="small" /> : <Printer size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfActionBtn, styles.pdfShareBtn, pdfAction === 'share' && { opacity: 0.7 }]}
          onPress={handleShareTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'share' ? <ActivityIndicator color="#fff" size="small" /> : <Share2 size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfActionBtn, styles.pdfDownloadBtn, pdfAction === 'download' && { opacity: 0.7 }]}
          onPress={handleDownloadTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'download' ? <ActivityIndicator color="#fff" size="small" /> : <Download size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Download</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.kpiLabel}>THIS TRIP ADVANCE</Text>
          <Text style={styles.kpiValue}>{formatCurrency(advancePaid)}</Text>
        </View>
      </View>

      {/* Driver Carry-Forward Advance Banner (Previous advance still in hand) */}
      {driverCarryForwardBalance > 0 && (
        <View
          style={{
            backgroundColor: '#eff6ff',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e40af', letterSpacing: 0.5, marginBottom: 2 }}>
              💰 PREVIOUS ADVANCE IN HAND
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#1d4ed8' }}>
              {formatCurrency(driverCarryForwardBalance)}
            </Text>
            <Text style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
              Driver already holds this from previous trips — deducted during settlement
            </Text>
          </View>
          <View
            style={{
              backgroundColor: '#dbeafe',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#1d4ed8' }}>CARRY{'\n'}FORWARD</Text>
          </View>
        </View>
      )}

      {/* Balance to Driver Banner */}
      <View
        style={[
          styles.balanceBanner,
          isSettled
            ? { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1.5 }
            : balanceToDriver > 0
            ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1.5 }
            : balanceToDriver < 0
            ? { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1.5 }
            : { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1 },
        ]}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text
              style={[
                styles.balanceBannerTitle,
                isSettled
                  ? { color: '#15803d' }
                  : balanceToDriver > 0
                  ? { color: '#dc2626' }
                  : balanceToDriver < 0
                  ? { color: '#15803d' }
                  : { color: '#64748b' },
              ]}
            >
              {isSettled
                ? '✓ SETTLED — BALANCE PAID TO DRIVER'
                : balanceToDriver > 0
                ? 'BALANCE NEED TO PAY TO DRIVER'
                : balanceToDriver < 0
                ? 'REMAINING ADVANCE IN DRIVER HAND'
                : 'ALL SETTLED (₹0 BALANCE)'}
            </Text>
            {isSettled ? (
              <View style={{ backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: '#15803d', fontSize: 10, fontWeight: '800' }}>SETTLED</Text>
              </View>
            ) : balanceToDriver > 0 ? (
              <View style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: '800' }}>NEED TO PAY</Text>
              </View>
            ) : balanceToDriver < 0 ? (
              <View style={{ backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: '#15803d', fontSize: 10, fontWeight: '800' }}>IN HAND</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[
              styles.balanceBannerSub,
              isSettled
                ? { color: '#166534' }
                : balanceToDriver > 0
                ? { color: '#991b1b' }
                : balanceToDriver < 0
                ? { color: '#166534' }
                : { color: '#64748b' },
            ]}
          >
            {isSettled
              ? `Trip settlement completed. Balance of ${formatCurrency(Math.abs(balanceToDriver))} settled with driver.`
              : balanceToDriver > 0
              ? `Expenses ${formatCurrency(totalExpenses)} - Advance ${formatCurrency(advancePaid)}${driverCarryForwardBalance > 0 ? ` - Previous Trip Balance ${formatCurrency(driverCarryForwardBalance)}` : ''} = Admin / Manager needs to pay ${formatCurrency(balanceToDriver)} to driver`
              : balanceToDriver < 0
              ? `Advance ${formatCurrency(advancePaid)} - Expenses ${formatCurrency(totalExpenses)} = ${formatCurrency(Math.abs(balanceToDriver))} cash remaining in driver hand for next trips`
              : 'Advance received and trip expenses are completely balanced.'}
          </Text>
        </View>
        <Text
          style={[
            styles.balanceBannerAmount,
            {
              color: isSettled
                ? '#15803d'
                : balanceToDriver > 0
                ? '#dc2626'
                : balanceToDriver < 0
                ? '#15803d'
                : '#64748b',
            },
          ]}
        >
          {formatCurrency(Math.abs(balanceToDriver))}
        </Text>
      </View>

      {viewOnly ? (
        <>
          <Text style={styles.sectionHeaderTitle}>DRIVER EXPENSES</Text>
          <Text style={styles.sectionHeaderSub}>Amounts recorded for this trip</Text>
          {EXPENSE_CATEGORIES.map((cat) => {
            const catItems = getCategoryItems(cat);
            const catTotal = getCategoryTotal(cat);
            const IconComponent = cat.icon;
            return (
              <View key={cat.key} style={styles.accordionCard}>
                <View style={styles.accordionHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.categoryIconBadge}>
                      <IconComponent size={18} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.categoryTitle}>{cat.shortName}</Text>
                      <Text style={styles.entryCountText}>
                        {catItems.length === 0 ? 'No entry' : `${catItems.length} ${catItems.length === 1 ? 'entry' : 'entries'}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.categoryTitle, { fontSize: 16 }]}>{formatCurrency(catTotal)}</Text>
                </View>
                {catItems.map((item) => (
                  <View key={item.id} style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>
                      {formatCurrency(item.amount)}
                    </Text>
                    {item.description ? (
                      <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{item.description}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}
        </>
      ) : (
        <>
      <Text style={styles.sectionHeaderTitle}>EXPENSE CATEGORIES</Text>
      <Text style={styles.sectionHeaderSub}>
        Tap any category to open — auto-save categories save instantly
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
                    unloadingApplies && activeKrishiUnit ? (
                      <Text style={styles.autoRateHintText}>
                        Unit {activeKrishiUnit.unitNumber} ({activeKrishiUnit.name}): {formatCurrency(krishiUnloadingAmount)}
                      </Text>
                    ) : (
                      <Text style={[styles.autoRateHintText, { color: COLORS.textMuted }]}>
                        Not applicable
                      </Text>
                    )
                  ) : cat.key === 'DRIVER_BATA' && driverBataAmount > 0 ? (
                    <Text style={styles.autoRateHintText}>
                      Auto ({driverBataPercentage}% of Freight): {formatCurrency(driverBataAmount)}
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
                  unloadingApplies && activeKrishiUnit && krishiUnloadingAmount > 0 ? (
                    <View style={styles.totalBadgeAuto}>
                      <Text style={styles.totalBadgeAutoText}>Rate: {formatCurrency(krishiUnloadingAmount)}</Text>
                    </View>
                  ) : (
                    <View style={styles.totalBadgeMuted}>
                      <Text style={styles.totalBadgeMutedText}>{unloadingApplies ? '₹0' : 'N/A'}</Text>
                    </View>
                  )
                ) : cat.key === 'DRIVER_BATA' && driverBataAmount > 0 ? (
                  <View style={styles.totalBadgeAuto}>
                    <Text style={styles.totalBadgeAutoText}>Rate: {formatCurrency(driverBataAmount)}</Text>
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
                  unloadingApplies ? (
                    <View style={styles.krishiUnloadingBox}>
                      <View style={styles.krishiHeaderRow}>
                        <View style={styles.krishiIconBadge}>
                          <Building2 size={16} color={COLORS.white} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.krishiCompanyTitle}>{defaults.party_name || trip.party_name || 'UNLOADING'}</Text>
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
                ) : cat.key === 'UNLOADING' && !unloadingApplies ? (
                  // Non-Krishi Party notice: unloading is not applicable
                  <View style={styles.nonKrishiNoticeBox}>
                    <View style={styles.nonKrishiIconRow}>
                      <AlertCircle size={20} color={COLORS.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nonKrishiNoticeTitle}>
                          Not applicable
                        </Text>
                        <Text style={styles.nonKrishiNoticeSub}>
                          Unloading is not applicable for this party.
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
                ) : cat.key === 'UNLOADING' && unloadingApplies ? (
                  // Krishi unloading: auto-saved, show confirmation
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
                        <Text style={styles.unloadingLockedBadgeText}>✓ Auto-Saved</Text>
                      </View>
                    </View>
                    {isAddingKey === 'UNLOADING' && (
                      <ActivityIndicator color={COLORS.accent} size="small" style={{ marginVertical: 8 }} />
                    )}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.closeCardBtn}
                        onPress={() => setOpenCategory(null)}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={COLORS.textMuted} />
                        <Text style={styles.closeCardBtnText}>CLOSE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // OTHER or categories without auto-save
                  <View style={styles.entryFormContainer}>
                    {/* Auto-saved categories: LOADING, DRIVER_BATA, CLEANING_CHARGE show saved state */}
                    {(cat.key === 'LOADING' || cat.key === 'DRIVER_BATA' || cat.key === 'CLEANING_CHARGE') && (
                      <>
                        {isAddingKey === cat.key ? (
                          <View style={styles.autoSavingRow}>
                            <ActivityIndicator color={COLORS.accent} size="small" />
                            <Text style={styles.autoSavingText}>Saving automatically…</Text>
                          </View>
                        ) : (
                          <View style={styles.autoSavedConfirmBox}>
                            <View style={styles.autoSavedCheckIcon}>
                              <Text style={styles.autoSavedCheckText}>✓</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.autoSavedTitle}>Saved Automatically</Text>
                              <Text style={styles.autoSavedSub}>
                                {cat.key === 'LOADING'
                                  ? `Loading charge: ${formatCurrency(truckLoadingAmount)} (from truck rate)`
                                  : cat.key === 'DRIVER_BATA'
                                  ? `Driver Bata: ${formatCurrency(driverBataAmount)} (${driverBataPercentage}% of freight)`
                                  : `Cleaning charge: ${formatCurrency(truckCleaningAmount)} (from truck master)`}
                              </Text>
                            </View>
                          </View>
                        )}
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            style={styles.closeCardBtn}
                            onPress={() => setOpenCategory(null)}
                            activeOpacity={0.7}
                          >
                            <X size={16} color={COLORS.textMuted} />
                            <Text style={styles.closeCardBtnText}>CLOSE</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {/* OTHER category: manual entry with SAVE ENTRY button */}
                    {cat.key === 'OTHER' && (
                      <>
                        <Text style={styles.entryFormTitle}>+ Add {cat.shortName}</Text>
                        <View style={styles.formGroup}>
                          <View style={styles.inputLabelRow}>
                            <Text style={styles.inputLabel}>Amount (₹)</Text>
                            <View style={[styles.lockedBadgeSmall, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                              <Text style={[styles.lockedBadgeSmallText, { color: '#b45309' }]}>
                                Max: ₹{maxOtherExpenseLimit}
                              </Text>
                            </View>
                          </View>
                          <TextInput
                            style={[
                              styles.input,
                              parseFloat(currentDraft.amount) > maxOtherExpenseLimit && {
                                borderColor: COLORS.danger,
                                borderWidth: 1.5,
                                backgroundColor: '#fff1f2',
                              },
                            ]}
                            placeholder="0"
                            placeholderTextColor={COLORS.textLight}
                            keyboardType="decimal-pad"
                            value={currentDraft.amount}
                            onChangeText={(val) => handleInputChange('OTHER', 'amount', val)}
                            onBlur={() => {
                              const val = parseFloat(currentDraft.amount);
                              if (!isNaN(val) && val > maxOtherExpenseLimit) {
                                Alert.alert(
                                  'Amount Exceeds Allowed Limit',
                                  `The other expense limit is ₹${maxOtherExpenseLimit}. Please contact admin to increase the limit.`
                                );
                              }
                            }}
                          />
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
                              ? `Amount exceeds the limit of ₹${maxOtherExpenseLimit}. Contact admin to increase the limit.`
                              : `Maximum allowed limit is ₹${maxOtherExpenseLimit}.`}
                          </Text>
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.inputLabel}>Notes / Description (Optional)</Text>
                          <TextInput
                            style={styles.input}
                            placeholder={cat.placeholder}
                            placeholderTextColor={COLORS.textLight}
                            value={currentDraft.description}
                            onChangeText={(val) => handleInputChange('OTHER', 'description', val)}
                          />
                        </View>

                        {/* Action Buttons: Close and Save Entry — only for OTHER */}
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
                            style={[
                              styles.addEntryBtn,
                              (isAdding || !currentDraft.amount || parseFloat(currentDraft.amount) <= 0) && { opacity: 0.45 },
                            ]}
                            onPress={() => handleAddExpense('OTHER')}
                            disabled={isAdding || !currentDraft.amount || parseFloat(currentDraft.amount) <= 0}
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
                      </>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
      </>
      )}

      {!viewOnly ? (
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
      ) : null}
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
    marginBottom: SPACING.sm,
  },
  pdfActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  pdfActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pdfPrintBtn: { backgroundColor: '#1d4ed8' },
  pdfShareBtn: { backgroundColor: '#047857' },
  pdfDownloadBtn: { backgroundColor: '#0f172a' },
  pdfActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
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
    minWidth: 0,
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
    flexShrink: 0,
    maxWidth: '48%',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  // Auto-save confirmation styles
  autoSavingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  autoSavingText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  autoSavedConfirmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  autoSavedCheckIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoSavedCheckText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  autoSavedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.3,
  },
  autoSavedSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
});
