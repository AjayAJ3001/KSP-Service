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
import { ArrowLeft, ArrowRight, FileText, Share2, Download, Printer } from 'lucide-react-native';
import api from '../services/api';
import { Trip } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatDateDMY } from '../utils/dateUtils';
import { printTripPdf, shareTripPdf, downloadTripPdf } from '../utils/pdfGenerator';

export const PartyPaymentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip } = route.params as { trip: Trip };

  const [ownerName, setOwnerName] = useState<string>(trip.owner_name || '');
  const [ownerMobile, setOwnerMobile] = useState<string>(trip.owner_mobile || '');
  const [pdfAction, setPdfAction] = useState<'print' | 'share' | 'download' | null>(null);

  useEffect(() => {
    if (!ownerName && trip.id) {
      api.get(`/trips/${trip.id}`).then((res) => {
        const t = res.data?.data || res.data;
        if (t?.owner_name) {
          setOwnerName(t.owner_name);
          if (t.owner_mobile) setOwnerMobile(t.owner_mobile);
        }
      }).catch(() => {});
    }
  }, [trip.id, ownerName]);

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = parseFloat(String(val || 0)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const weight = parseFloat(String(trip.goods_weight)) || 0;
  const rate = parseFloat(String(trip.freight_rate)) || 0;
  const totalFreight = Math.round(parseFloat(String(trip.total_freight)) || (weight * rate));

  const handlePrintTrip = async () => {
    try {
      setPdfAction('print');
      await printTripPdf(trip);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not print trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  const handleShareTrip = async () => {
    try {
      setPdfAction('share');
      await shareTripPdf(trip);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  const handleDownloadTrip = async () => {
    try {
      setPdfAction('download');
      const result = await downloadTripPdf(trip);
      if (result.savedDirectly) {
        Alert.alert('Download Successful', `Trip PDF saved as:\n${result.filename}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not download trip PDF.');
    } finally {
      setPdfAction(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeading}>Payment Details</Text>
      <Text style={styles.screenSub}>Review calculated freight details</Text>

      <View style={styles.pdfActionRow}>
        <TouchableOpacity
          style={[styles.pdfActionBtn, { backgroundColor: '#1d4ed8' }, pdfAction === 'print' && { opacity: 0.7 }]}
          onPress={handlePrintTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'print' ? <ActivityIndicator color="#fff" size="small" /> : <Printer size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfActionBtn, { backgroundColor: '#047857' }, pdfAction === 'share' && { opacity: 0.7 }]}
          onPress={handleShareTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'share' ? <ActivityIndicator color="#fff" size="small" /> : <Share2 size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfActionBtn, { backgroundColor: '#0f172a' }, pdfAction === 'download' && { opacity: 0.7 }]}
          onPress={handleDownloadTrip}
          disabled={pdfAction !== null}
          activeOpacity={0.8}
        >
          {pdfAction === 'download' ? <ActivityIndicator color="#fff" size="small" /> : <Download size={15} color="#fff" />}
          <Text style={styles.pdfActionBtnText}>Download</Text>
        </TouchableOpacity>
      </View>

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

        {ownerName ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Truck Owner:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.infoValueBold, { color: '#6d28d9' }]}>👤 {ownerName}</Text>
              {ownerMobile ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted }}>({ownerMobile})</Text>
              ) : null}
            </View>
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
          <Text style={styles.infoLabel}>Unit:</Text>
          <Text style={styles.infoValue}>
            {trip.to_location || trip.from_location}
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
  pdfActionBtnText: {
    color: '#fff',
    fontSize: 12,
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
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    flexShrink: 1,
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
