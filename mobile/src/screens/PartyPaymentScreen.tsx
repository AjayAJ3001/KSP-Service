import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react-native';
import { Trip } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatDateDMY } from '../utils/dateUtils';

export const PartyPaymentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip } = route.params as { trip: Trip };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = parseFloat(String(val || 0)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const weight = parseFloat(String(trip.goods_weight)) || 0;
  const rate = parseFloat(String(trip.freight_rate)) || 0;
  const totalFreight = parseFloat(String(trip.total_freight)) || (weight * rate);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeading}>Payment Details</Text>
      <Text style={styles.screenSub}>Review calculated freight details</Text>

      {/* Trip & Payment Information Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FileText size={20} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Freight Summary</Text>
        </View>

        {trip.lorry_number ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Truck Number:</Text>
            <Text style={styles.infoValueBold}>{trip.lorry_number}</Text>
          </View>
        ) : null}

        {trip.driver_name ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Driver Name:</Text>
            <Text style={styles.infoValue}>{trip.driver_name}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Party / Client:</Text>
          <Text style={styles.infoValueBold}>{trip.party_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trip Date:</Text>
          <Text style={styles.infoValue}>
            {formatDateDMY(trip.trip_date)}
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
            {formatCurrency(trip.freight_rate)} / {trip.unit_abbreviation || 'T'}
          </Text>
        </View>

        <View style={[styles.infoRow, styles.dueHighlightRow]}>
          <Text style={styles.dueHighlightLabel}>Total Freight:</Text>
          <Text style={styles.dueHighlightValue}>{formatCurrency(totalFreight)}</Text>
        </View>
      </View>

      {/* Navigation Buttons: Previous & Next */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.previousBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={COLORS.primary} />
          <Text style={styles.previousBtnText}>PREVIOUS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => navigation.navigate('DriverExpenses', { trip })}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>NEXT</Text>
          <ArrowRight size={18} color={COLORS.white} />
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.md,
  },
  previousBtn: {
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
  previousBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  nextBtn: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});
