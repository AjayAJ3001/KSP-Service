import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CreditCard, CheckCircle2, ArrowRight, AlertCircle, Check } from 'lucide-react-native';
import { mobilePaymentService, mobileTripService } from '../services/mobileService';
import { Trip } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const PartyPaymentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip: initialTrip } = route.params as { trip: Trip };
  const [trip, setTrip] = useState<Trip>(initialTrip);

  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const freightDue = parseFloat(String(trip.balance_due ?? trip.total_freight));
  const enteredReceived = parseFloat(receivedAmount) || 0;
  const calculatedBalanceDue = Math.max(0, freightDue - enteredReceived);
  const isFullPayment = enteredReceived >= freightDue && freightDue > 0;

  const handleConfirmPayment = async () => {
    if (enteredReceived <= 0) {
      setError('Please enter a valid payment amount > 0.');
      return;
    }
    if (enteredReceived > freightDue) {
      setError(`Payment cannot exceed freight due of ₹${freightDue.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await mobilePaymentService.addPayment(trip.id, {
        received_amount: enteredReceived,
        payment_date: paymentDate,
        notes: notes || undefined,
      });

      // Reload fresh trip state
      const freshTrip = await mobileTripService.getTripById(trip.id);
      setTrip(freshTrip.data);
      setPaymentSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to record party payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeading}>Party Freight Payment</Text>
      <Text style={styles.screenSub}>Collect customer payment & verify outstanding dues</Text>

      {error ? (
        <View style={styles.errorBox}>
          <AlertCircle size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Trip Information Card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Party Name:</Text>
          <Text style={styles.infoValueBold}>{trip.party_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trip Date:</Text>
          <Text style={styles.infoValue}>
            {new Date(trip.trip_date).toLocaleDateString('en-IN')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Route:</Text>
          <Text style={styles.infoValue}>
            {trip.from_location} → {trip.to_location}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Goods Weight:</Text>
          <Text style={styles.infoValue}>
            {trip.goods_weight} {trip.unit_abbreviation || 'Tons'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Freight Rate:</Text>
          <Text style={styles.infoValue}>
            {formatCurrency(trip.freight_rate)}/{trip.unit_abbreviation || 'T'}
          </Text>
        </View>
        <View style={[styles.infoRow, styles.dueHighlightRow]}>
          <Text style={styles.dueHighlightLabel}>Total Freight Due:</Text>
          <Text style={styles.dueHighlightValue}>{formatCurrency(freightDue)}</Text>
        </View>
      </View>

      {/* Payment Entry Form if not already fully paid */}
      {!paymentSuccess ? (
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Received Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 15000"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={receivedAmount}
              onChangeText={setReceivedAmount}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Payment Date</Text>
            <TextInput
              style={styles.input}
              value={paymentDate}
              onChangeText={setPaymentDate}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Payment Notes / Reference (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cash, NEFT, Cheque No"
              placeholderTextColor={COLORS.textLight}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Live Balance Due Calculation Box */}
          <View
            style={[
              styles.calcBox,
              isFullPayment ? styles.calcBoxSuccess : styles.calcBoxWarning,
            ]}
          >
            <View>
              <Text style={styles.calcBoxTitle}>
                {isFullPayment ? 'FULL PAYMENT TALLIED' : 'REMAINING BALANCE DUE'}
              </Text>
              <Text style={styles.calcBoxSub}>
                Freight {formatCurrency(freightDue)} - Received {formatCurrency(enteredReceived)}
              </Text>
            </View>
            <Text
              style={[
                styles.calcBoxAmount,
                isFullPayment ? { color: COLORS.successDark } : { color: COLORS.dangerDark },
              ]}
            >
              {formatCurrency(calculatedBalanceDue)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleConfirmPayment}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <CheckCircle2 size={20} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>CONFIRM PAYMENT</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Payment Success Confirmation View */
        <View style={[styles.card, { alignItems: 'center', padding: SPACING.xl }]}>
          <View style={styles.successIconBadge}>
            <Check size={36} color={COLORS.white} />
          </View>
          <Text style={styles.successHeading}>Payment Recorded Successfully!</Text>
          <Text style={styles.successSub}>
            Received {formatCurrency(enteredReceived)} from {trip.party_name}
          </Text>

          <View style={styles.balanceSummaryBox}>
            <Text style={styles.balanceSummaryText}>
              Remaining Balance Due: {formatCurrency(trip.balance_due || 0)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.expensesNextBtn}
            onPress={() => navigation.navigate('DriverExpenses', { trip })}
          >
            <Text style={styles.expensesNextBtnText}>PROCEED TO DRIVER EXPENSES</Text>
            <ArrowRight size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Skip / Proceed Directly to Expenses */}
      {!paymentSuccess && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.navigate('DriverExpenses', { trip })}
        >
          <Text style={styles.skipBtnText}>Continue to Driver Expenses →</Text>
        </TouchableOpacity>
      )}
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoValueBold: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '800',
  },
  dueHighlightRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
  },
  dueHighlightLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dueHighlightValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.accent,
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
  calcBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.md,
    borderWidth: 1,
  },
  calcBoxSuccess: {
    backgroundColor: COLORS.successLight,
    borderColor: '#a7f3d0',
  },
  calcBoxWarning: {
    backgroundColor: COLORS.warningLight,
    borderColor: '#fde68a',
  },
  calcBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  calcBoxSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  calcBoxAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  confirmBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  balanceSummaryBox: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },
  balanceSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  expensesNextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  expensesNextBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
  },
});
