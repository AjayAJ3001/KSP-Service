import React, { useState, useEffect, useRef } from 'react';
import { formatDateDMY } from '../utils/dateUtils';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import {
  Truck,
  HandCoins,
  ChevronDown,
  Check,
  X,
  Search,
  IndianRupee,
  ArrowRight,
  AlertCircle,
  StickyNote,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  ArrowUpRight,
  FileText,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mobileLookupService, mobileTruckAdvanceService } from '../services/mobileService';
import { Vehicle, RootStackParamList } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { ComplianceAlertModal, ComplianceDoc } from '../components/ComplianceAlertModal';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveTruckAdvance'>;

export const GiveTruckAdvanceScreen: React.FC<Props> = ({ navigation, route }) => {
  const availableBalance = route.params?.availableBalance ?? 0;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Compliance Alert Modal State
  const [complianceModal, setComplianceModal] = useState<{
    visible: boolean;
    entityName: string;
    documents: ComplianceDoc[];
    notice?: string;
    onProceed: () => void;
    onCancel: () => void;
  }>({
    visible: false,
    entityName: '',
    documents: [],
    onProceed: () => {},
    onCancel: () => {},
  });

  // Modals state
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Technical Confirmation Modal
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTimestamp, setConfirmTimestamp] = useState('');

  // Colorful Success Modal & Toast
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [createdAdvance, setCreatedAdvance] = useState<{
    id?: number;
    amount: number;
    lorry_number: string;
    vehicle_id: number;
    remainingBalance: number;
    date: string;
  } | null>(null);

  // Animation Refs
  const confirmScale = useRef(new Animated.Value(0.85)).current;
  const confirmOpacity = useRef(new Animated.Value(0)).current;

  const successScale = useRef(new Animated.Value(0.4)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.8)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;

  const toastSlideY = useRef(new Animated.Value(-120)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const badgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadVehicles();

    // Ambient pulsing animation for technical tags
    const loopPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(badgePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loopPulse.start();

    return () => loopPulse.stop();
  }, []);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await mobileLookupService.getVehicles();
      setVehicles(res.data.items);
    } catch {
      setError('Failed to load vehicles. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `\u20B9${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getVehicleComplianceAlerts = (v?: Vehicle | null) => {
    if (!v) return [];
    const alerts: { name: string; date: string; days: number; isExpired: boolean }[] = [];
    const checkDoc = (name: string, dateStr?: string) => {
      if (!dateStr) return;
      try {
        const exp = new Date(dateStr);
        const td = new Date();
        exp.setHours(0, 0, 0, 0);
        td.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp.getTime() - td.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) {
          alerts.push({
            name,
            date: formatDateDMY(dateStr),
            days,
            isExpired: days < 0,
          });
        }
      } catch {}
    };

    checkDoc('Fitness Certificate (FC)', v.fc_expiry_date);
    checkDoc('Insurance Policy', v.insurance_expiry_date);
    checkDoc('Road Permit', v.permit_expiry_date);
    checkDoc('Yearly Road Tax', v.tax_expiry_date);
    checkDoc('RC (Registration)', v.rc_expiry_date);
    checkDoc('DTS Certificate', v.dts_expiry_date);

    return alerts;
  };

  const handleSelectTruck = (item: Vehicle) => {
    setSelectedVehicle(item);
    setVehicleModalVisible(false);
    setError('');
    const alerts = getVehicleComplianceAlerts(item);
    if (alerts.length > 0) {
      setComplianceModal({
        visible: true,
        entityName: item.lorry_number,
        documents: alerts,
        notice: 'Please verify document renewals before dispatching or authorizing truck advance.',
        onProceed: () => {
          setComplianceModal((prev) => ({ ...prev, visible: false }));
        },
        onCancel: () => {
          setSelectedVehicle(null);
          setComplianceModal((prev) => ({ ...prev, visible: false }));
        },
      });
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.lorry_number.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      (v.vehicle_type ?? '').toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  // Open Technical Confirmation Dialog
  const handleOpenConfirmation = () => {
    setError('');
    const numAmount = parseFloat(amount);

    if (!selectedVehicle) {
      setError('Please select a truck / vehicle.');
      return;
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid advance amount.');
      return;
    }
    if (numAmount > availableBalance) {
      setError(`Amount exceeds your available balance of ${formatCurrency(availableBalance)}.`);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = formatDateDMY(now);
    setConfirmTimestamp(`${dateStr} • ${timeStr}`);

    setConfirmModalVisible(true);
    confirmScale.setValue(0.85);
    confirmOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(confirmScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(confirmOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeConfirmation = () => {
    Animated.timing(confirmOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setConfirmModalVisible(false));
  };

  // Dispatch Confirmed Advance via API
  const handleConfirmDispatch = async () => {
    if (!selectedVehicle) return;
    const numAmount = parseFloat(amount);

    try {
      setIsSubmitting(true);
      setError('');

      const res = await mobileTruckAdvanceService.giveAdvance({
        vehicle_id: selectedVehicle.id,
        amount: numAmount,
        notes: notes.trim() || undefined,
      });

      const remainingBal = Math.max(0, availableBalance - numAmount);
      const advanceData = {
        id: res.data?.id,
        amount: numAmount,
        lorry_number: selectedVehicle.lorry_number,
        vehicle_id: selectedVehicle.id,
        remainingBalance: remainingBal,
        date: formatDateDMY(new Date()),
      };

      setCreatedAdvance(advanceData);

      // Close confirmation dialog & open colorful animated celebration modal
      setConfirmModalVisible(false);
      triggerSuccessCelebration();
    } catch (err: any) {
      setError(err?.message || 'Failed to record advance. Please try again.');
      setConfirmModalVisible(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Rich Colorful Animated Success UI & Toast
  const triggerSuccessCelebration = () => {
    setSuccessModalVisible(true);
    setToastVisible(true);

    // Reset animation values
    successScale.setValue(0.3);
    successOpacity.setValue(0);
    pulseRing1.setValue(1);
    ring1Opacity.setValue(0.8);
    pulseRing2.setValue(1);
    ring2Opacity.setValue(0.6);

    // Spring into view with high-energy bounce
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Start expanding concentric pulse rings
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseRing1, {
            toValue: 2.1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseRing1, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ring1Opacity, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(ring1Opacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseRing2, {
            toValue: 1.8,
            duration: 1600,
            delay: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseRing2, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 1600,
            delay: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Slide down colorful toast banner
    toastSlideY.setValue(-120);
    toastOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(toastSlideY, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleResetForm = () => {
    setSuccessModalVisible(false);
    setSelectedVehicle(null);
    setAmount('');
    setNotes('');
    setError('');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading fleet masters...</Text>
      </View>
    );
  }

  const remainingAfterAdvance = availableBalance - (parseFloat(amount) || 0);
  const numAmount = parseFloat(amount) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Dynamic Colorful Floating Toast (Notification Banner) */}
      {toastVisible && createdAdvance && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              transform: [{ translateY: toastSlideY }],
              opacity: toastOpacity,
            },
          ]}
        >
          <View style={styles.toastContent}>
            <View style={styles.toastIconBox}>
              <Zap size={18} color="#059669" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.toastTitle}>ADVANCE DISPATCHED!</Text>
              <Text style={styles.toastSub}>
                {formatCurrency(createdAdvance.amount)} allocated to {createdAdvance.lorry_number}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setToastVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color="#047857" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Balance Summary Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceIconCircle}>
              <HandCoins size={22} color="#15803d" />
            </View>
            <View style={styles.balanceTextBlock}>
              <Text style={styles.balanceLabel}>Manager Available Balance</Text>
              <Text style={styles.balanceValue}>{formatCurrency(availableBalance)}</Text>
            </View>
          </View>
          {numAmount > 0 && (
            <View style={styles.balanceDivider}>
              <View style={styles.balanceAfterRow}>
                <Text style={styles.balanceAfterLabel}>Balance after this advance</Text>
                <Text
                  style={[
                    styles.balanceAfterValue,
                    { color: remainingAfterAdvance < 0 ? COLORS.danger : '#15803d' },
                  ]}
                >
                  {formatCurrency(Math.max(remainingAfterAdvance, 0))}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.sectionTitle}>Truck Advance Allocation</Text>
            <View style={styles.techChip}>
              <View style={styles.techDot} />
              <Text style={styles.techChipText}>FLEET DISPATCH</Text>
            </View>
          </View>

          {/* Truck Selector */}
          <Text style={styles.fieldLabel}>Select Target Truck *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, !selectedVehicle && styles.dropdownBtnPlaceholder]}
            onPress={() => {
              setVehicleSearch('');
              setVehicleModalVisible(true);
            }}
          >
            <Truck size={18} color={selectedVehicle ? COLORS.primary : COLORS.textLight} />
            <Text style={[styles.dropdownText, !selectedVehicle && styles.dropdownPlaceholderText]}>
              {selectedVehicle
                ? `${selectedVehicle.lorry_number}${
                    selectedVehicle.vehicle_type ? ` — ${selectedVehicle.vehicle_type}` : ''
                  }`
                : 'Tap to select a truck'}
            </Text>
            <ChevronDown size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Selected Truck Compliance Alert Notice */}
          {selectedVehicle && (() => {
            const alerts = getVehicleComplianceAlerts(selectedVehicle);
            if (alerts.length === 0) return null;
            const hasExpired = alerts.some((a) => a.isExpired);
            return (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: hasExpired ? '#fef2f2' : '#fffbeb',
                  borderColor: hasExpired ? '#fca5a5' : '#fde68a',
                  borderWidth: 1.5,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={15} color={hasExpired ? '#dc2626' : '#d97706'} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: hasExpired ? '#991b1b' : '#92400e',
                    }}
                  >
                    {hasExpired ? '⚠️ Compliance Warning — Documents Expired' : '⚠️ Expiry Notice (Within 30 Days)'}
                  </Text>
                </View>
                {alerts.map((a, idx) => (
                  <Text
                    key={idx}
                    style={{
                      fontSize: 11,
                      color: a.isExpired ? '#b91c1c' : '#b45309',
                      marginLeft: 21,
                      lineHeight: 16,
                    }}
                  >
                    • <Text style={{ fontWeight: '600' }}>{a.name}:</Text>{' '}
                    {a.isExpired ? `EXPIRED (${a.date})` : `Expires in ${a.days}d (${a.date})`}
                  </Text>
                ))}
              </View>
            );
          })()}

          {/* Amount Field */}
          <Text style={styles.fieldLabel}>Advance Amount (₹) *</Text>
          <View style={styles.amountInputWrapper}>
            <IndianRupee size={20} color={COLORS.primary} style={{ marginLeft: 14 }} />
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setError('');
              }}
            />
          </View>

          {/* Notes Field */}
          <Text style={styles.fieldLabel}>Notes / Reason (Optional)</Text>
          <View style={styles.notesInputWrapper}>
            <StickyNote size={16} color={COLORS.textMuted} style={{ marginTop: 14, marginLeft: 14 }} />
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., Highway diesel, toll advance, trip pre-payment..."
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Error display */}
          {!!error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit Button to Trigger Technical Popup */}
          <TouchableOpacity
            style={[styles.submitBtn, (!selectedVehicle || !amount) && styles.submitBtnDisabled]}
            onPress={handleOpenConfirmation}
            activeOpacity={0.85}
          >
            <ShieldCheck size={20} color={COLORS.white} />
            <Text style={styles.submitBtnText}>Review & Authorize Advance</Text>
            <ArrowRight size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* 1. TECHNICAL CONFIRMATION POPUP MODAL (HIGH-TECH UI)                       */}
      {/* ========================================================================= */}
      <Modal visible={confirmModalVisible} transparent animationType="none" onRequestClose={closeConfirmation}>
        <View style={styles.techModalOverlay}>
          <Animated.View
            style={[
              styles.techModalContainer,
              {
                transform: [{ scale: confirmScale }],
                opacity: confirmOpacity,
              },
            ]}
          >
            {/* Cyber Header */}
            <View style={styles.cyberHeader}>
              <View style={styles.cyberHeaderLeft}>
                <Animated.View style={[styles.cyberStatusDot, { transform: [{ scale: badgePulse }] }]} />
                <Text style={styles.cyberBadgeText}>PROTOCOL // ADV-AUTH-01</Text>
              </View>
              <TouchableOpacity style={styles.cyberCloseBtn} onPress={closeConfirmation}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.cyberTitleBlock}>
              <View style={styles.cyberIconGlow}>
                <Zap size={22} color="#06b6d4" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cyberMainTitle}>Authorize Truck Advance</Text>
                <Text style={styles.cyberSubTitle}>Review dispatch ledger parameters</Text>
              </View>
            </View>

            {/* Technical Spec Card */}
            <View style={styles.techSpecCard}>
              {/* Asset Row */}
              <View style={styles.techSpecRow}>
                <Text style={styles.techSpecLabel}>TARGET FLEET ASSET</Text>
                <View style={styles.assetBadge}>
                  <Truck size={14} color="#38bdf8" />
                  <Text style={styles.assetBadgeText}>{selectedVehicle?.lorry_number}</Text>
                  {selectedVehicle?.vehicle_type ? (
                    <Text style={styles.assetSubText}>• {selectedVehicle.vehicle_type}</Text>
                  ) : null}
                </View>
              </View>

              {/* Big Amount Card */}
              <View style={styles.techAmountBox}>
                <Text style={styles.techAmountLabel}>DISPATCH AMOUNT</Text>
                <Text style={styles.techAmountValue}>{formatCurrency(numAmount)}</Text>
              </View>

              {/* Ledger Balance Flow Grid */}
              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryCol}>
                  <Text style={styles.telemetryLabel}>AVAILABLE CREDIT</Text>
                  <Text style={styles.telemetryVal}>{formatCurrency(availableBalance)}</Text>
                </View>
                <View style={styles.telemetryArrow}>
                  <ArrowRight size={14} color="#64748b" />
                </View>
                <View style={styles.telemetryCol}>
                  <Text style={[styles.telemetryLabel, { color: '#34d399' }]}>REMAINING BALANCE</Text>
                  <Text style={[styles.telemetryVal, { color: '#34d399' }]}>
                    {formatCurrency(Math.max(0, remainingAfterAdvance))}
                  </Text>
                </View>
              </View>

              {/* Metadata details */}
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Clock size={12} color="#64748b" />
                  <Text style={styles.metaText}>{confirmTimestamp}</Text>
                </View>
                <Text style={styles.secTag}>ENCRYPTED LEDGER</Text>
              </View>

              {notes ? (
                <View style={styles.terminalNotesBox}>
                  <Text style={styles.terminalNotesLabel}>REMARKS MEMO:</Text>
                  <Text style={styles.terminalNotesText}>"{notes}"</Text>
                </View>
              ) : null}
            </View>

            {/* Cyber Action Buttons */}
            <View style={styles.cyberActionsRow}>
              <TouchableOpacity
                style={styles.cyberCancelBtn}
                onPress={closeConfirmation}
                disabled={isSubmitting}
              >
                <Text style={styles.cyberCancelText}>ABORT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cyberConfirmBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleConfirmDispatch}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Zap size={16} color="#ffffff" />
                    <Text style={styles.cyberConfirmText}>CONFIRM & DISPATCH</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. COLORFUL ANIMATED CELEBRATION MODAL (WOW SUCCESS UI)                   */}
      {/* ========================================================================= */}
      <Modal visible={successModalVisible} transparent animationType="none" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.successModalOverlay}>
          <Animated.View
            style={[
              styles.successModalContainer,
              {
                transform: [{ scale: successScale }],
                opacity: successOpacity,
              },
            ]}
          >
            {/* Animated Concentric Glowing Rings Background */}
            <View style={styles.ringCenterContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseRing1 }],
                    opacity: ring1Opacity,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRingSecondary,
                  {
                    transform: [{ scale: pulseRing2 }],
                    opacity: ring2Opacity,
                  },
                ]}
              />
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={44} color="#ffffff" />
              </View>
            </View>

            {/* Colorful Banner Header */}
            <View style={styles.celebrationTagRow}>
              <View style={styles.celebrationPill}>
                <Sparkles size={14} color="#10b981" />
                <Text style={styles.celebrationPillText}>TRANSACTION SETTLED</Text>
              </View>
            </View>

            <Text style={styles.successMainTitle}>Advance Dispatched!</Text>
            <Text style={styles.successSubTitle}>
              Cash advance successfully allocated & logged to fleet ledger.
            </Text>

            {/* Colorful Receipt Voucher Card */}
            <View style={styles.receiptCard}>
              <View style={styles.receiptTopBar}>
                <Text style={styles.receiptRefText}>
                  REF: #{createdAdvance?.id ? `ADV-${createdAdvance.id}` : 'TRK-ADV-NEW'}
                </Text>
                <View style={styles.verifiedBadge}>
                  <BadgeCheck size={13} color="#059669" />
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>

              <View style={styles.receiptAmountBox}>
                <Text style={styles.receiptAmountLabel}>ALLOCATED ADVANCE</Text>
                <Text style={styles.receiptAmountBig}>
                  {formatCurrency(createdAdvance?.amount || 0)}
                </Text>
              </View>

              <View style={styles.receiptDetailsList}>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailKey}>Fleet Truck</Text>
                  <View style={styles.receiptTruckTag}>
                    <Truck size={13} color="#1d4ed8" />
                    <Text style={styles.receiptTruckText}>{createdAdvance?.lorry_number}</Text>
                  </View>
                </View>

                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailKey}>Remaining Balance</Text>
                  <Text style={styles.receiptBalText}>
                    {formatCurrency(createdAdvance?.remainingBalance || 0)}
                  </Text>
                </View>

                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailKey}>Dispatch Date</Text>
                  <Text style={styles.receiptDetailVal}>{createdAdvance?.date}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.successActionsCol}>
              <TouchableOpacity
                style={styles.createTripBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  if (createdAdvance) {
                    navigation.replace('NewTrip', {
                      preselectedVehicleId: createdAdvance.vehicle_id,
                      advancePaid: createdAdvance.amount,
                    });
                  }
                }}
                activeOpacity={0.85}
              >
                <Zap size={18} color="#ffffff" />
                <Text style={styles.createTripBtnText}>Create Trip Entry Now</Text>
                <ArrowUpRight size={18} color="#ffffff" />
              </TouchableOpacity>

              <View style={styles.secondaryActionsRow}>
                <TouchableOpacity
                  style={styles.anotherAdvanceBtn}
                  onPress={handleResetForm}
                >
                  <RotateCcw size={15} color={COLORS.primary} />
                  <Text style={styles.anotherAdvanceText}>Give Another</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => {
                    setSuccessModalVisible(false);
                    navigation.goBack();
                  }}
                >
                  <Check size={16} color={COLORS.primary} />
                  <Text style={styles.doneBtnText}>Dashboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. VEHICLE PICKER MODAL                                                   */}
      {/* ========================================================================= */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent onRequestClose={() => setVehicleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Fleet Truck</Text>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <X size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Search size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by lorry number..."
                placeholderTextColor={COLORS.textLight}
                value={vehicleSearch}
                onChangeText={setVehicleSearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredVehicles}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedVehicle?.id === item.id && styles.modalItemSelected,
                  ]}
                  onPress={() => handleSelectTruck(item)}
                >
                  <View style={styles.modalItemLeft}>
                    <View
                      style={[
                        styles.truckIconBadge,
                        selectedVehicle?.id === item.id && styles.truckIconBadgeSelected,
                      ]}
                    >
                      <Truck
                        size={18}
                        color={selectedVehicle?.id === item.id ? '#ffffff' : COLORS.primary}
                      />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.modalItemTitle}>{item.lorry_number}</Text>
                      {item.vehicle_type && (
                        <Text style={styles.modalItemSub}>{item.vehicle_type}</Text>
                      )}
                      {(() => {
                        const alerts = getVehicleComplianceAlerts(item);
                        if (alerts.length === 0) return null;
                        const hasExp = alerts.some((a) => a.isExpired);
                        return (
                          <Text
                            style={{
                              fontSize: 10.5,
                              color: hasExp ? '#dc2626' : '#d97706',
                              fontWeight: '700',
                              marginTop: 2,
                            }}
                          >
                            {hasExp ? `⚠️ ${alerts.length} Expired Doc(s)` : `⚠️ ${alerts.length} Expiring Soon (≤30d)`}
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                  {selectedVehicle?.id === item.id && (
                    <Check size={18} color={COLORS.accent} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No trucks found.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Professional Compliance Alert Modal */}
      <ComplianceAlertModal
        visible={complianceModal.visible}
        type="VEHICLE"
        entityName={complianceModal.entityName}
        documents={complianceModal.documents}
        notice={complianceModal.notice}
        onProceed={complianceModal.onProceed}
        onCancel={complianceModal.onCancel}
        proceedText="Acknowledge & Continue"
        cancelText="Choose Another Truck"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  // Floating Toast Notification
  floatingToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#064e3b',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#34d399',
    padding: SPACING.sm + 4,
    ...SHADOWS.lg,
    shadowColor: '#10b981',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#34d399',
    letterSpacing: 0.8,
  },
  toastSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },

  // Balance summary card
  balanceCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  balanceTextBlock: { flex: 1 },
  balanceLabel: { fontSize: 12, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 28, fontWeight: '900', color: '#15803d', marginTop: 2 },
  balanceDivider: { borderTopWidth: 1, borderTopColor: '#bbf7d0', marginTop: SPACING.md, paddingTop: SPACING.sm },
  balanceAfterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceAfterLabel: { fontSize: 13, color: '#166534', fontWeight: '600' },
  balanceAfterValue: { fontSize: 15, fontWeight: '800' },

  // Form card
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  techChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  techDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginRight: 5,
  },
  techChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: 6,
  },

  // Dropdown button
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  dropdownBtnPlaceholder: { borderColor: COLORS.border },
  dropdownText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.primary },
  dropdownPlaceholderText: { fontWeight: '500', color: COLORS.textLight },

  // Amount input
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },

  // Notes input
  notesInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 85,
  },
  notesInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 14,
    color: COLORS.primary,
    textAlignVertical: 'top',
  },

  // Error box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: { flex: 1, fontSize: 13, color: COLORS.danger, fontWeight: '600' },

  // Submit button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    marginTop: SPACING.xl,
    ...SHADOWS.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },

  // =========================================================================
  // TECHNICAL CONFIRMATION MODAL STYLES
  // =========================================================================
  techModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  techModalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    padding: SPACING.lg,
    ...SHADOWS.lg,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  cyberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
    marginBottom: 14,
  },
  cyberHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cyberStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  cyberBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  cyberCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  cyberTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cyberIconGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberMainTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  cyberSubTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  techSpecCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: SPACING.md,
    marginBottom: 18,
  },
  techSpecRow: {
    marginBottom: 12,
  },
  techSpecLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 6,
  },
  assetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    gap: 8,
  },
  assetBadgeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 0.8,
  },
  assetSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  techAmountBox: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#10b981',
    alignItems: 'center',
    marginVertical: 4,
  },
  techAmountLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#a7f3d0',
    letterSpacing: 1.2,
  },
  techAmountValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#34d399',
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  telemetryCol: { flex: 1 },
  telemetryArrow: { paddingHorizontal: 6 },
  telemetryLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 0.6 },
  telemetryVal: { fontSize: 13, fontWeight: '800', color: '#cbd5e1', marginTop: 2 },
  metaDivider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  secTag: { fontSize: 9, fontWeight: '800', color: '#10b981', letterSpacing: 0.8 },
  terminalNotesBox: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  terminalNotesLabel: { fontSize: 9, fontWeight: '800', color: '#38bdf8', letterSpacing: 0.6 },
  terminalNotesText: { fontSize: 12, color: '#e2e8f0', fontStyle: 'italic', marginTop: 2 },
  cyberActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cyberCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberCancelText: { fontSize: 13, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.8 },
  cyberConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10b981',
    ...SHADOWS.md,
    shadowColor: '#10b981',
    shadowOpacity: 0.5,
  },
  cyberConfirmText: { fontSize: 14, fontWeight: '900', color: '#ffffff', letterSpacing: 0.6 },

  // =========================================================================
  // COLORFUL CELEBRATION MODAL STYLES
  // =========================================================================
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  successModalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.lg,
    shadowColor: '#10b981',
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 24,
  },
  ringCenterContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  pulseRingSecondary: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
    shadowColor: '#10b981',
    shadowOpacity: 0.6,
  },
  celebrationTagRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  celebrationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  celebrationPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.8,
  },
  successMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  successSubTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginVertical: 18,
  },
  receiptTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 10,
  },
  receiptRefText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  receiptAmountBox: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 12,
  },
  receiptAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 1,
  },
  receiptAmountBig: {
    fontSize: 24,
    fontWeight: '900',
    color: '#15803d',
    marginTop: 2,
  },
  receiptDetailsList: {
    gap: 8,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptDetailKey: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  receiptTruckTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  receiptTruckText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
  },
  receiptBalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  receiptDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  successActionsCol: {
    width: '100%',
    gap: 10,
  },
  createTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    ...SHADOWS.md,
    shadowColor: '#10b981',
    shadowOpacity: 0.5,
  },
  createTripBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  anotherAdvanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  anotherAdvanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  doneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Modal Vehicle Picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.primary },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  modalItemSelected: { backgroundColor: '#f0f9ff' },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  truckIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  truckIconBadgeSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modalItemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  modalItemSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  modalEmpty: { padding: SPACING.xl, alignItems: 'center' },
  modalEmptyText: { fontSize: 14, color: COLORS.textMuted },
});
