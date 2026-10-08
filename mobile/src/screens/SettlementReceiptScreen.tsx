import React, { useState, useEffect } from 'react';
import { formatDateDMY } from '../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Share2,
  Download,
  Printer,
  Check,
  Truck,
  ArrowDownCircle,
  UserCheck,
  Sparkles,
  Receipt,
  FileText,
} from 'lucide-react-native';
import { mobileSettlementService, mobileExpenseService } from '../services/mobileService';
import { Trip, Settlement } from '../types';
import {
  printSettlementPdf,
  shareSettlementPdf,
  downloadSettlementPdf,
} from '../utils/pdfGenerator';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const SettlementReceiptScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip, settlement: initialSettlement } = route.params as {
    trip: Trip;
    settlement?: Settlement;
  };

  const [settlement, setSettlement] = useState<Settlement | null>(initialSettlement || null);
  const [expenseItems, setExpenseItems] = useState<any[]>(
    initialSettlement?.expense_items || []
  );
  const [isLoading, setIsLoading] = useState(!initialSettlement);
  const [actionLoading, setActionLoading] = useState<'print' | 'share' | 'download' | null>(null);

  useEffect(() => {
    loadSettlement();
  }, []);

  const loadSettlement = async () => {
    try {
      setIsLoading(true);
      const [settleRes, expRes] = await Promise.all([
        mobileSettlementService.getSettlementByTripId(trip.id).catch(() => null),
        mobileExpenseService.getTripExpenses(trip.id).catch(() => null),
      ]);

      if (settleRes?.data) {
        setSettlement(settleRes.data);
        if (settleRes.data.expense_items && settleRes.data.expense_items.length > 0) {
          setExpenseItems(settleRes.data.expense_items);
        } else if (expRes?.data?.expenses) {
          setExpenseItems(expRes.data.expenses);
        }
      } else if (expRes?.data?.expenses) {
        setExpenseItems(expRes.data.expenses);
      }
    } catch (err) {
      console.error('Failed to load settlement details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFullSettlement = (): Settlement | null => {
    if (!settlement) return null;
    return {
      ...settlement,
      expense_items: expenseItems.length > 0 ? expenseItems : settlement.expense_items || [],
    };
  };

  // Print Action
  const handlePrint = async () => {
    const fullSettlement = getFullSettlement();
    if (!fullSettlement) return;
    try {
      setActionLoading('print');
      await printSettlementPdf(trip, fullSettlement);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Unable to print PDF slip.');
    } finally {
      setActionLoading(null);
    }
  };

  // Share Action
  const handleShare = async () => {
    const fullSettlement = getFullSettlement();
    if (!fullSettlement) return;
    try {
      setActionLoading('share');
      await shareSettlementPdf(trip, fullSettlement);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share PDF slip.');
    } finally {
      setActionLoading(null);
    }
  };

  // Download / Save to Device Action
  const handleDownload = async () => {
    const fullSettlement = getFullSettlement();
    if (!fullSettlement) return;
    try {
      setActionLoading('download');
      const result = await downloadSettlementPdf(trip, fullSettlement);
      if (result.savedDirectly) {
        Alert.alert(
          'Download Successful! 📥',
          `Settlement slip PDF has been downloaded directly to your local device storage:\n\n${result.filename}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'File Ready! 📥',
          `Settlement slip PDF saved to device:\n${result.filename}`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Unable to download PDF slip.');
    } finally {
      setActionLoading(null);
    }
  };

  // Step 1: Loading
  const loadingItems = expenseItems.filter((e) => e.expense_type === 'LOADING');
  const loadingTotal = loadingItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // Step 2: Unloading
  const unloadingItems = expenseItems.filter((e) => e.expense_type === 'UNLOADING');
  const unloadingTotal = unloadingItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // Step 3: Driver Bata
  const bataItems = expenseItems.filter(
    (e) => e.expense_type === 'DRIVER_BATA' || e.expense_type === 'DRIVER_BETA'
  );
  const bataTotal = bataItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // Step 4: Cleaning Charge
  const cleaningItems = expenseItems.filter(
    (e) => e.expense_type === 'CLEANING_CHARGE' || e.expense_type === 'CLEANING'
  );
  const cleaningTotal = cleaningItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // Step 5: Other Expenses
  const otherItems = expenseItems.filter(
    (e) =>
      !['LOADING', 'UNLOADING', 'DRIVER_BATA', 'DRIVER_BETA', 'CLEANING_CHARGE', 'CLEANING'].includes(
        e.expense_type
      )
  );
  const otherTotal = otherItems.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);

  // 5 Step definitions
  const EXPENSE_STEPS = [
    {
      step: '1',
      title: 'Loading Charge',
      total: loadingTotal,
      items: loadingItems,
      defaultDesc: 'Fixed from truck loading expense',
      icon: Truck,
    },
    {
      step: '2',
      title: 'Unloading Charge',
      total: unloadingTotal,
      items: unloadingItems,
      defaultDesc: unloadingTotal > 0 ? 'Krishi unit unloading rate' : 'Non-Krishi (₹0 / Not applicable)',
      icon: ArrowDownCircle,
    },
    {
      step: '3',
      title: 'Driver Bata',
      total: bataTotal,
      items: bataItems,
      defaultDesc: '15% of Total Freight Amount',
      icon: UserCheck,
    },
    {
      step: '4',
      title: 'Cleaning Charge',
      total: cleaningTotal,
      items: cleaningItems,
      defaultDesc: 'Truck cleaning charge from master',
      icon: Sparkles,
    },
    {
      step: '5',
      title: 'Other Expenses',
      total: otherTotal,
      items: otherItems,
      defaultDesc: 'Minor trip expenses (Max limit configured)',
      icon: Receipt,
    },
  ];

  if (isLoading || !settlement) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Settlement Slip...</Text>
      </View>
    );
  }

  const goodsWeight = parseFloat(String(trip.goods_weight || 0));
  const freightRate = parseFloat(String(trip.freight_rate || 0));
  const totalFreight = parseFloat(String(settlement.total_freight || 0));
  const totalExpenses = parseFloat(String(settlement.total_expenses || 0));
  const advancePaid = parseFloat(String(settlement.advance_paid || 0));
  const balanceToDriver = parseFloat(String(settlement.balance_to_driver || 0));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={styles.topStatusBanner}>
        <View style={styles.verifiedBadge}>
          <Check size={16} color={COLORS.white} />
          <Text style={styles.verifiedText}>SETTLEMENT VERIFIED</Text>
        </View>
        <Text style={styles.voucherNo}>Voucher #{settlement.id} • Trip #{trip.id}</Text>
      </View>

      {/* Slip Body Container */}
      <View style={styles.slipCard}>
        {/* Slip Header */}
        <View style={styles.slipHeader}>
          <Text style={styles.slipBrandName}>KSP TRANSPORT</Text>
          <Text style={styles.slipTagline}>Logistics & Fleet Transport Services</Text>
          <Text style={styles.slipDocumentTitle}>TRIP SETTLEMENT SLIP</Text>
        </View>

        {/* Trip Context Grid */}
        <View style={styles.gridBox}>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Date:</Text>
            <Text style={styles.gridValue}>
              {formatDateDMY(trip.trip_date)}
            </Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Party:</Text>
            <Text style={styles.gridValueBold}>{trip.party_name || '—'}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Route:</Text>
            <Text style={styles.gridValue}>
              {trip.from_location} → {trip.to_location}
            </Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Lorry Number:</Text>
            <Text style={styles.gridValueBold}>{trip.lorry_number || '—'}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Driver Name:</Text>
            <Text style={styles.gridValue}>{trip.driver_name || '—'}</Text>
          </View>
        </View>

        {/* 1. TOTAL FREIGHT AMOUNT (Displayed above Driver Expenses) */}
        <View style={styles.freightCard}>
          <View style={styles.freightHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.freightCardTitle}>TOTAL FREIGHT AMOUNT</Text>
              {goodsWeight > 0 && freightRate > 0 ? (
                <Text style={styles.freightFormula}>
                  {goodsWeight} Tons × ₹{freightRate}/Ton
                </Text>
              ) : null}
            </View>
            <Text style={styles.freightCardAmount}>{formatCurrency(totalFreight)}</Text>
          </View>
        </View>

        {/* 2. DRIVER EXPENSES: STEP-BY-STEP BREAKDOWN */}
        <View style={styles.stepSection}>
          <View style={styles.stepSectionHeaderRow}>
            <FileText size={16} color={COLORS.primary} />
            <Text style={styles.stepSectionTitle}>DRIVER EXPENSES (STEP-BY-STEP)</Text>
          </View>
          <Text style={styles.stepSectionSub}>
            Itemized breakdown of all 5 expense categories
          </Text>

          {EXPENSE_STEPS.map((stepItem) => {
            const hasItems = stepItem.items.length > 0;
            return (
              <View key={stepItem.step} style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>Step {stepItem.step}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.stepCardTitle}>{stepItem.title}</Text>
                    <Text style={styles.stepCardDesc}>
                      {hasItems && stepItem.items[0].description
                        ? stepItem.items.map((it) => it.description).filter(Boolean).join('; ')
                        : stepItem.defaultDesc}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stepCardAmount,
                      stepItem.total === 0 && { color: COLORS.textMuted },
                    ]}
                  >
                    {formatCurrency(stepItem.total)}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Subtotal of Driver Expenses */}
          <View style={styles.expenseSubtotalRow}>
            <Text style={styles.expenseSubtotalLabel}>TOTAL DRIVER EXPENSES:</Text>
            <Text style={styles.expenseSubtotalValue}>{formatCurrency(totalExpenses)}</Text>
          </View>
        </View>

        {/* 3. SETTLEMENT CALCULATION SUMMARY (No Total Freight down here — only Expenses, Advance & Net Balance) */}
        <View style={styles.financialSection}>
          <Text style={styles.finSectionTitle}>SETTLEMENT CALCULATION SUMMARY</Text>

          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Total Driver Expenses:</Text>
            <Text style={[styles.finVal, { color: COLORS.accent }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </View>

          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Less: Advance Paid to Driver:</Text>
            <Text style={styles.finVal}>(-) {formatCurrency(advancePaid)}</Text>
          </View>

          <View style={styles.finHighlightRow}>
            <View>
              <Text style={styles.finHighlightLabel}>Net Balance to Driver:</Text>
              <Text style={styles.finHighlightSub}>
                {balanceToDriver >= 0 ? '✓ Payable to Driver' : '⚠️ Recoverable from Driver'}
              </Text>
            </View>
            <Text
              style={[
                styles.finHighlightValue,
                { color: balanceToDriver >= 0 ? COLORS.successDark : COLORS.dangerDark },
              ]}
            >
              {balanceToDriver >= 0 ? '+' : ''}{formatCurrency(balanceToDriver)}
            </Text>
          </View>
        </View>

        {/* Signatures Row */}
        <View style={styles.signaturesRow}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Driver Signature</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Authorized Signatory (KSP)</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons Toolbar: Print, Share, Download */}
      <View style={styles.actionButtonsGrid}>
        {/* Print Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.printBtn, actionLoading === 'print' && { opacity: 0.7 }]}
          onPress={handlePrint}
          disabled={actionLoading !== null}
          activeOpacity={0.8}
        >
          {actionLoading === 'print' ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Printer size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>PRINT</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.shareBtn, actionLoading === 'share' && { opacity: 0.7 }]}
          onPress={handleShare}
          disabled={actionLoading !== null}
          activeOpacity={0.8}
        >
          {actionLoading === 'share' ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Share2 size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>SHARE</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Download Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.downloadBtn,
            actionLoading === 'download' && { opacity: 0.7 },
          ]}
          onPress={handleDownload}
          disabled={actionLoading !== null}
          activeOpacity={0.8}
        >
          {actionLoading === 'download' ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Download size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>DOWNLOAD</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Return to Dashboard */}
      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.navigate('MainTabs')}
        activeOpacity={0.8}
      >
        <Text style={styles.doneBtnText}>RETURN TO DASHBOARD</Text>
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
  topStatusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  verifiedText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  voucherNo: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  slipCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    ...SHADOWS.md,
  },
  slipHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  slipBrandName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  slipTagline: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  slipDocumentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 6,
  },
  gridBox: {
    marginBottom: SPACING.md,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  gridLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  gridValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  gridValueBold: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '800',
  },
  // Total Freight Card styles (Above Driver Expenses)
  freightCard: {
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  freightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  freightCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
    letterSpacing: 0.5,
  },
  freightFormula: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 2,
  },
  freightCardAmount: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1e3a8a',
  },
  // Step-by-Step Driver Expenses styles
  stepSection: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  stepSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stepSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  stepSectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  stepCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  stepBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  stepCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stepCardDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  stepCardAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 6,
  },
  expenseSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: '#cbd5e1',
    marginTop: 6,
    paddingTop: 8,
  },
  expenseSubtotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  expenseSubtotalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.accent,
  },
  // Financial Summary styles (Expenses, Advance, Net Balance)
  financialSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  finSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  finLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  finVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  finHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    marginTop: 8,
    paddingTop: 10,
  },
  finHighlightLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  finHighlightSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  finHighlightValue: {
    fontSize: 19,
    fontWeight: '900',
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  sigLine: {
    width: 120,
    height: 1,
    backgroundColor: COLORS.borderDark,
    marginBottom: 4,
  },
  sigLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  // 3 Action Buttons Grid
  actionButtonsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...SHADOWS.sm,
  },
  printBtn: {
    backgroundColor: '#334155', // Slate
  },
  shareBtn: {
    backgroundColor: COLORS.accent, // Gold/Amber
  },
  downloadBtn: {
    backgroundColor: '#059669', // Emerald Green
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
