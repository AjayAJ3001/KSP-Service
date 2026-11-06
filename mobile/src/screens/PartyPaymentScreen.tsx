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
import { adminPaymentService } from '../services/adminService';
import { Trip, TripPayment } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatDateDMY } from '../utils/dateUtils';
import { printTripPdf, shareTripPdf, downloadTripPdf } from '../utils/pdfGenerator';

export const PartyPaymentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { trip, viewOnly } = route.params as { trip: Trip; viewOnly?: boolean };

  const [ownerName, setOwnerName] = useState<string>(trip.owner_name || '');
  const [ownerMobile, setOwnerMobile] = useState<string>(trip.owner_mobile || '');
  const [pdfAction, setPdfAction] = useState<'print' | 'share' | 'download' | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [receivedTotal, setReceivedTotal] = useState(Number(trip.total_received || 0));
  const [balanceDue, setBalanceDue] = useState(
    Number(trip.balance_due ?? Math.max(0, Number(trip.total_freight || 0) - Number(trip.total_received || 0)))
  );

  useEffect(() => {
    if (!ownerName && trip.id) {
      api.get(`/trips/${trip.id}`).then((res) => {
        const t = res.data?.data || res.data;
        if (t?.owner_name) {
          setOwnerName(t.owner_name);
          if (t.owner_mobile) setOwnerMobile(t.owner_mobile);
        }
        if (t?.total_received != null) setReceivedTotal(Number(t.total_received) || 0);
        if (t?.balance_due != null) setBalanceDue(Number(t.balance_due) || 0);
      }).catch(() => {});
    }
  }, [trip.id, ownerName]);

  useEffect(() => {
    if (!trip.id) return;
    const freight = Math.round(parseFloat(String(trip.total_freight)) || 0);
    adminPaymentService.getTripPayments(trip.id).then((res) => {
      const items = Array.isArray(res.data) ? res.data : [];
      setPayments(items);
      const received = items.reduce((sum, p) => sum + (Number(p.received_amount) || 0), 0);
      if (received > 0 || items.length > 0) {
        setReceivedTotal(received);
        setBalanceDue(Math.max(0, freight - received));
      }
    }).catch(() => {});
  }, [trip.id, trip.total_freight]);

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
      <Text style={styles.screenHeading}>{viewOnly ? 'Party Payment Details' : 'Payment Details'}</Text>
      <Text style={styles.screenSub}>
        {viewOnly ? 'Freight billed, amount received and balance from the party' : 'Review calculated freight details'}
      </Text>

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

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: '#047857', fontWeight: '700' }]}>Received from Party:</Text>
          <Text style={[styles.infoValueBold, { color: '#047857' }]}>{formatCurrency(receivedTotal)}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.infoLabel, { color: '#b91c1c', fontWeight: '700' }]}>Balance Due:</Text>
          <Text style={[styles.infoValueBold, { color: '#b91c1c' }]}>{formatCurrency(balanceDue)}</Text>
        </View>
      </View>

      {viewOnly ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FileText size={20} color="#047857" />
            <Text style={styles.cardTitle}>Party Payments</Text>
          </View>
          {payments.length === 0 ? (
            <Text style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: '600' }}>
              No party payment recorded yet.
            </Text>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoValueBold}>{formatCurrency(p.received_amount)}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                    {formatDateDMY(p.payment_date)}{p.notes ? ` · ${p.notes}` : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857' }}>
                  {p.payment_status || 'RECEIVED'}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {!viewOnly ? (
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
