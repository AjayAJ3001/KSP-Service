import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BookOpen, Building2, TrendingUp, AlertCircle } from 'lucide-react-native';
import { mobileLookupService, mobilePaymentService } from '../services/mobileService';
import { Party } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const LedgerScreen: React.FC = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    if (selectedPartyId) {
      loadLedger(selectedPartyId);
    }
  }, [selectedPartyId]);

  const loadParties = async () => {
    try {
      setIsLoading(true);
      const res = await mobileLookupService.getParties();
      setParties(res.data.items);
      if (res.data.items.length > 0) {
        setSelectedPartyId(res.data.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load parties', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLedger = async (partyId: number) => {
    try {
      setIsLoadingLedger(true);
      const res = await mobilePaymentService.getPartyLedger(partyId);
      setLedgerEntries(res.data);
    } catch (err) {
      console.error('Failed to load ledger', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalBilled = ledgerEntries.reduce((acc, curr) => acc + parseFloat(curr.freight || 0), 0);
  const totalReceived = ledgerEntries.reduce((acc, curr) => acc + parseFloat(curr.received_amount || 0), 0);
  const totalBalanceDue = ledgerEntries.reduce((acc, curr) => acc + parseFloat(curr.balance_due || 0), 0);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Parties...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeading}>Party Ledger Statement</Text>
      <Text style={styles.screenSub}>Track billed freights, collections & outstanding customer balances</Text>

      {/* Party Selector Chips */}
      <View style={styles.partySelectCard}>
        <Text style={styles.fieldLabel}>Select Party / Client Account</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {parties.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selectedPartyId === p.id && styles.chipActive]}
              onPress={() => setSelectedPartyId(p.id)}
            >
              <Text style={[styles.chipText, selectedPartyId === p.id && styles.chipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Account Statement Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>TOTAL BILLED</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBilled)}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>TOTAL COLLECTED</Text>
          <Text style={[styles.summaryValue, { color: COLORS.successDark }]}>
            {formatCurrency(totalReceived)}
          </Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>BALANCE DUE</Text>
          <Text style={[styles.summaryValue, { color: COLORS.dangerDark }]}>
            {formatCurrency(totalBalanceDue)}
          </Text>
        </View>
      </View>

      {/* Ledger Line Items List */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Transaction History ({ledgerEntries.length})</Text>

        {isLoadingLedger ? (
          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginVertical: 20 }} />
        ) : ledgerEntries.length === 0 ? (
          <Text style={styles.emptyText}>No transaction records found for this party.</Text>
        ) : (
          ledgerEntries.map((entry, idx) => (
            <View key={idx} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>
                  {new Date(entry.trip_date).toLocaleDateString('en-IN')}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    entry.payment_status === 'Settled'
                      ? styles.statusSettled
                      : entry.payment_status === 'Partial'
                      ? styles.statusPartial
                      : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{entry.payment_status}</Text>
                </View>
              </View>

              <Text style={styles.entryRoute}>
                {entry.from_location} → {entry.to_location}
              </Text>

              <View style={styles.entryFinGrid}>
                <View>
                  <Text style={styles.finSubLabel}>Freight</Text>
                  <Text style={styles.finMainVal}>{formatCurrency(entry.freight)}</Text>
                </View>
                <View>
                  <Text style={styles.finSubLabel}>Received</Text>
                  <Text style={[styles.finMainVal, { color: COLORS.successDark }]}>
                    {formatCurrency(entry.received_amount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.finSubLabel}>Balance</Text>
                  <Text
                    style={[
                      styles.finMainVal,
                      { color: entry.balance_due > 0 ? COLORS.dangerDark : COLORS.successDark },
                    ]}
                  >
                    {formatCurrency(entry.balance_due)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
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
  partySelectCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  summaryBanner: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  entryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusSettled: {
    backgroundColor: COLORS.successLight,
  },
  statusPartial: {
    backgroundColor: COLORS.warningLight,
  },
  statusPending: {
    backgroundColor: COLORS.dangerLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  entryRoute: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  entryFinGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  finSubLabel: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  finMainVal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
