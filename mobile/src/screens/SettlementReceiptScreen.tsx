import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  ArrowLeft,
  Truck,
  Check,
} from 'lucide-react-native';
import { mobileSettlementService } from '../services/mobileService';
import { Trip, Settlement } from '../types';
import { printOrShareSettlementPdf } from '../utils/pdfGenerator';
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
  const [isLoading, setIsLoading] = useState(!initialSettlement);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!initialSettlement) {
      loadSettlement();
    }
  }, []);

  const loadSettlement = async () => {
    try {
      setIsLoading(true);
      const res = await mobileSettlementService.getSettlementByTripId(trip.id);
      setSettlement(res.data);
    } catch (err) {
      console.error('Failed to load settlement', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePdfAction = async () => {
    if (!settlement) return;
    try {
      setIsExporting(true);
      await printOrShareSettlementPdf(trip, settlement);
    } catch (err: any) {
      Alert.alert('PDF Export Error', err.message || 'Unable to generate/share PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !settlement) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Settlement Slip...</Text>
      </View>
    );
  }

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
              {new Date(trip.trip_date).toLocaleDateString('en-IN')}
            </Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Party:</Text>
            <Text style={styles.gridValueBold}>{trip.party_name}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Route:</Text>
            <Text style={styles.gridValue}>
              {trip.from_location} → {trip.to_location}
            </Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Lorry Number:</Text>
            <Text style={styles.gridValueBold}>{trip.lorry_number}</Text>
          </View>
          <View style={styles.gridRow}>
            <Text style={styles.gridLabel}>Driver Name:</Text>
            <Text style={styles.gridValue}>{trip.driver_name}</Text>
          </View>
        </View>

        {/* Financial Line Items */}
        <View style={styles.financialSection}>
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Total Freight Billed:</Text>
            <Text style={styles.finVal}>{formatCurrency(settlement.total_freight)}</Text>
          </View>

          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Driver Expenses Incurred:</Text>
            <Text style={[styles.finVal, { color: COLORS.accent }]}>
              {formatCurrency(settlement.total_expenses)}
            </Text>
          </View>

          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Advance Paid to Driver:</Text>
            <Text style={styles.finVal}>{formatCurrency(settlement.advance_paid)}</Text>
          </View>

          <View style={styles.finHighlightRow}>
            <Text style={styles.finHighlightLabel}>Balance to Driver:</Text>
            <Text
              style={[
                styles.finHighlightValue,
                { color: settlement.balance_to_driver >= 0 ? COLORS.successDark : COLORS.dangerDark },
              ]}
            >
              {formatCurrency(settlement.balance_to_driver)}
            </Text>
          </View>
        </View>

        {/* Signatures placeholder */}
        <View style={styles.signaturesRow}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Driver Signature</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Authorized Signatory</Text>
          </View>
        </View>
      </View>

      {/* PDF Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.pdfBtn, isExporting && { opacity: 0.7 }]}
          onPress={handlePdfAction}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Share2 size={18} color={COLORS.white} />
              <Text style={styles.pdfBtnText}>SHARE / PREVIEW PDF</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.doneBtnText}>RETURN TO DASHBOARD</Text>
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
  financialSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  finLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  finVal: {
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  finHighlightValue: {
    fontSize: 18,
    fontWeight: '800',
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
  actionButtonsRow: {
    marginTop: SPACING.lg,
    gap: 10,
  },
  pdfBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  pdfBtnText: {
    color: COLORS.white,
    fontSize: 15,
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
