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
  Wallet,
  Plus,
  Trash2,
  FileCheck,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { mobileExpenseService, mobileSettlementService } from '../services/mobileService';
import { Trip, DriverExpense, Settlement } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

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

  // New Expense Entry Form
  const [expenseType, setExpenseType] = useState('LOADING');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await mobileExpenseService.getTripExpenses(trip.id);
      setExpenses(res.data.expenses);
      setTotalExpenses(res.data.total_expenses);
      setAdvancePaid(res.data.advance_paid);
      setBalanceToDriver(res.data.balance_to_driver);
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid expense amount > 0.');
      return;
    }

    try {
      setIsAdding(true);
      setError('');
      await mobileExpenseService.addExpense(trip.id, {
        expense_type: expenseType,
        description: description || undefined,
        amount: amt,
      });

      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      setError(err.message || 'Failed to add expense.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      await mobileExpenseService.deleteExpense(id);
      loadExpenses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete expense.');
    }
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
        // If already generated, fetch existing
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

  const categories = [
    { label: 'Loading', value: 'LOADING' },
    { label: 'Unloading', value: 'UNLOADING' },
    { label: 'Toll', value: 'TOLL' },
    { label: 'Food', value: 'FOOD' },
    { label: 'Repair', value: 'REPAIR' },
    { label: 'Freight Based', value: 'FREIGHT_BASED' },
    { label: 'Other', value: 'OTHER' },
  ];

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
        Trip #{trip.id} • Driver: {trip.driver_name} ({trip.lorry_number})
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
        <View>
          <Text style={styles.balanceBannerTitle}>
            {balanceToDriver >= 0 ? 'BALANCE TO PAY DRIVER' : 'DRIVER ADVANCE RETURN DUE'}
          </Text>
          <Text style={styles.balanceBannerSub}>
            Formula: Total Expenses {formatCurrency(totalExpenses)} - Advance {formatCurrency(advancePaid)}
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

      {/* Add New Expense Form Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>+ Add Expense Line Item</Text>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Expense Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, expenseType === c.value && styles.chipActive]}
                onPress={() => setExpenseType(c.value)}
              >
                <Text style={[styles.chipText, expenseType === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500"
            placeholderTextColor={COLORS.textLight}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Description (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Loading at warehouse, Fastag toll"
            placeholderTextColor={COLORS.textLight}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <TouchableOpacity
          style={[styles.addBtn, isAdding && { opacity: 0.7 }]}
          onPress={handleAddExpense}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Plus size={18} color={COLORS.white} />
              <Text style={styles.addBtnText}>ADD EXPENSE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Existing Line Items List */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Expense Line Items ({expenses.length})</Text>

        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses logged for this trip yet.</Text>
        ) : (
          expenses.map((exp) => (
            <View key={exp.id} style={styles.expenseItem}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.expenseCategory}>{exp.expense_type}</Text>
                  {exp.description ? (
                    <Text style={styles.expenseDesc}>• {exp.description}</Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.expenseAmount}>{formatCurrency(exp.amount)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteExpense(exp.id)}
                  style={{ padding: 4 }}
                >
                  <Trash2 size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Verify & Generate PDF Button */}
      <TouchableOpacity
        style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]}
        onPress={handleVerifyAndGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <FileText size={20} color={COLORS.white} />
            <Text style={styles.generateBtnText}>VERIFY & GENERATE PDF</Text>
          </>
        )}
      </TouchableOpacity>
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
    marginBottom: SPACING.md,
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  expenseCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  expenseDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  generateBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  generateBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
