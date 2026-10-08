import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Truck,
  Building2,
  Share2,
  Check,
  ChevronDown,
  X,
} from 'lucide-react-native';
import {
  adminReportService,
  adminPartyService,
  adminVehicleService,
  adminUnitService,
} from '../../services/adminService';
import { Party, Vehicle, Unit } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { exportCSV } from '../../utils/exportUtils';

type Tab = 'trips' | 'payments' | 'settlements';

export const AdminReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<Tab>('trips');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickDateFilter, setQuickDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [selectedPartyId, setSelectedPartyId] = useState<number | undefined>(undefined);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Dropdown options
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Picker Modal
  const [pickerModalType, setPickerModalType] = useState<'party' | 'vehicle' | 'unit' | 'status' | null>(null);

  // Data
  const [tripData, setTripData] = useState<{ trips: any[]; summary: any }>({ trips: [], summary: {} });
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [settlementData, setSettlementData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [pRes, vRes, uRes] = await Promise.all([
        adminPartyService.getParties({ limit: 100 }),
        adminVehicleService.getVehicles({ limit: 100 }),
        adminUnitService.getUnits('ACTIVE'),
      ]);
      setParties(pRes.data.items || []);
      setVehicles(vRes.data.items || []);
      setUnits(uRes.data || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  const setQuickRange = (type: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    setQuickDateFilter(type);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const today = new Date();
    if (type === 'all') {
      setFromDate('');
      setToDate('');
    } else if (type === 'today') {
      const d = fmt(today);
      setFromDate(d);
      setToDate(d);
    } else if (type === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const d = fmt(y);
      setFromDate(d);
      setToDate(d);
    } else if (type === 'week') {
      const day = today.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const start = new Date(today);
      start.setDate(today.getDate() + diffToMonday);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setFromDate(fmt(start));
      setToDate(fmt(end));
    } else if (type === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(fmt(start));
      setToDate(fmt(end));
    }
  };

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        party_id: selectedPartyId || undefined,
        vehicle_id: selectedVehicleId || undefined,
        unit_id: selectedUnitId || undefined,
        status: selectedStatus || undefined,
      };

      if (activeTab === 'trips') {
        const res = await adminReportService.getTripReport(params);
        setTripData(res.data);
      } else if (activeTab === 'payments') {
        const res = await adminReportService.getPaymentReport(params);
        setPaymentData(res.data || []);
      } else {
        const res = await adminReportService.getSettlementReport(params);
        setSettlementData(res.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load report', err);
      Alert.alert('Report Error', err.message || 'Failed to fetch report.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, fromDate, toDate, selectedPartyId, selectedVehicleId, selectedUnitId, selectedStatus]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Full Report Download
  const handleExportFullReport = async () => {
    try {
      setIsExporting(true);
      if (activeTab === 'trips') {
        const headers = ['ID', 'Date', 'Lorry No', 'Party', 'Route', 'Unit', 'Weight', 'Rate', 'Total Freight', 'Advance', 'Received', 'Balance', 'Status'];
        const rows = (tripData.trips || []).map((t) => [
          t.id,
          formatDateDMY(t.trip_date),
          t.lorry_number,
          t.party_name,
          `${t.from_location} -> ${t.to_location}`,
          t.unit_name,
          t.goods_weight,
          t.freight_rate,
          t.total_freight,
          t.advance_paid,
          t.total_received,
          t.balance_due,
          t.status,
        ]);
        await exportCSV(`KSP_Trips_Report_${Date.now()}`, headers, rows);
      } else if (activeTab === 'payments') {
        const headers = ['Payment ID', 'Trip ID', 'Date', 'Party', 'Lorry No', 'Amount Received', 'Trip Total', 'Balance Due', 'Status'];
        const rows = paymentData.map((p) => [
          p.id,
          p.trip_id,
          formatDateDMY(p.payment_date),
          p.party_name,
          p.lorry_number,
          p.received_amount,
          p.total_freight,
          p.balance_due,
          p.payment_status,
        ]);
        await exportCSV(`KSP_Payments_Report_${Date.now()}`, headers, rows);
      } else {
        const headers = ['Settlement ID', 'Trip ID', 'Date', 'Lorry No', 'Driver', 'Party', 'Total Freight', 'Expenses', 'Advance', 'Balance to Driver', 'Status'];
        const rows = settlementData.map((s) => [
          s.id,
          s.trip_id,
          formatDateDMY(s.created_at || s.trip_date),
          s.lorry_number,
          s.driver_name,
          s.party_name,
          s.total_freight,
          s.total_expenses,
          s.advance_paid,
          s.balance_to_driver,
          s.settlement_status,
        ]);
        await exportCSV(`KSP_Settlements_Report_${Date.now()}`, headers, rows);
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Could not export report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Single Row Download
  const handleExportSingleTrip = async (trip: any) => {
    const headers = ['Trip ID', 'Date', 'Lorry Number', 'Party', 'Driver', 'Route', 'Unit', 'Weight', 'Rate', 'Total Freight', 'Advance', 'Received', 'Balance', 'Status'];
    const rows = [[
      trip.id,
      formatDateDMY(trip.trip_date),
      trip.lorry_number,
      trip.party_name,
      trip.driver_name,
      `${trip.from_location} -> ${trip.to_location}`,
      trip.unit_name,
      trip.goods_weight,
      trip.freight_rate,
      trip.total_freight,
      trip.advance_paid,
      trip.total_received,
      trip.balance_due,
      trip.status,
    ]];
    await exportCSV(`Trip_${trip.lorry_number}_${trip.id}`, headers, rows);
  };

  const handleExportSinglePayment = async (p: any) => {
    const headers = ['Payment ID', 'Trip ID', 'Date', 'Party', 'Lorry Number', 'Received Amount', 'Balance Due', 'Status'];
    const rows = [[
      p.id,
      p.trip_id,
      formatDateDMY(p.payment_date),
      p.party_name,
      p.lorry_number,
      p.received_amount,
      p.balance_due,
      p.payment_status,
    ]];
    await exportCSV(`Payment_${p.trip_id}_${p.id}`, headers, rows);
  };

  const handleExportSingleSettlement = async (s: any) => {
    const headers = ['Settlement ID', 'Trip ID', 'Date', 'Lorry', 'Driver', 'Party', 'Total Freight', 'Expenses', 'Advance', 'Balance to Driver', 'Status'];
    const rows = [[
      s.id,
      s.trip_id,
      formatDateDMY(s.created_at || s.trip_date),
      s.lorry_number,
      s.driver_name,
      s.party_name,
      s.total_freight,
      s.total_expenses,
      s.advance_paid,
      s.balance_to_driver,
      s.settlement_status,
    ]];
    await exportCSV(`Settlement_Trip_${s.trip_id}`, headers, rows);
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'trips' && styles.tabBtnActive]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, activeTab === 'trips' && styles.tabTextActive]}>Trips Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'payments' && styles.tabBtnActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>Party Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'settlements' && styles.tabBtnActive]}
          onPress={() => setActiveTab('settlements')}
        >
          <Text style={[styles.tabText, activeTab === 'settlements' && styles.tabTextActive]}>Driver Settlements</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick Date Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickDateRow}>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'all' && styles.quickPillActive]}
            onPress={() => setQuickRange('all')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'all' && styles.quickPillTextActive]}>All Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'today' && styles.quickPillActive]}
            onPress={() => setQuickRange('today')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'today' && styles.quickPillTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'yesterday' && styles.quickPillActive]}
            onPress={() => setQuickRange('yesterday')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'yesterday' && styles.quickPillTextActive]}>Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'week' && styles.quickPillActive]}
            onPress={() => setQuickRange('week')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'week' && styles.quickPillTextActive]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickPill, quickDateFilter === 'month' && styles.quickPillActive]}
            onPress={() => setQuickRange('month')}
          >
            <Text style={[styles.quickPillText, quickDateFilter === 'month' && styles.quickPillTextActive]}>This Month</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Filter Selectors Bar */}
        <View style={styles.filtersCard}>
          <Text style={styles.filterCardTitle}>Granular Filters</Text>

          {/* Truck Selector */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setPickerModalType('vehicle')}
            >
              <Truck size={16} color={COLORS.textMuted} />
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedVehicle ? selectedVehicle.lorry_number : 'All Trucks / Lorries'}
              </Text>
              <ChevronDown size={14} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Party Selector */}
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setPickerModalType('party')}
            >
              <Building2 size={16} color={COLORS.textMuted} />
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedParty ? selectedParty.name : 'All Parties'}
              </Text>
              <ChevronDown size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {/* Unit Selector */}
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setPickerModalType('unit')}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedUnit ? selectedUnit.name : 'All Units'}
              </Text>
              <ChevronDown size={14} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Status Selector (for Trips) */}
            {activeTab === 'trips' && (
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setPickerModalType('status')}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {selectedStatus ? selectedStatus : 'All Statuses'}
                </Text>
                <ChevronDown size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Custom Date inputs */}
          <View style={styles.customDateRow}>
            <View style={styles.dateInputBox}>
              <Text style={styles.dateLabel}>From (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.dateInput}
                value={fromDate}
                onChangeText={(v) => {
                  setFromDate(v);
                  setQuickDateFilter('all');
                }}
                placeholder="2026-10-01"
              />
            </View>
            <View style={styles.dateInputBox}>
              <Text style={styles.dateLabel}>To (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.dateInput}
                value={toDate}
                onChangeText={(v) => {
                  setToDate(v);
                  setQuickDateFilter('all');
                }}
                placeholder="2026-10-31"
              />
            </View>
          </View>

          {/* Action buttons (Clear & Apply) */}
          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setFromDate('');
                setToDate('');
                setSelectedPartyId(undefined);
                setSelectedVehicleId(undefined);
                setSelectedUnitId(undefined);
                setSelectedStatus('');
                setQuickDateFilter('all');
              }}
            >
              <Text style={styles.clearBtnText}>Reset Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={loadReport}>
              <RefreshCw size={14} color={COLORS.white} />
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Banner & Full Export Button */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryStats}>
            {activeTab === 'trips' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Trips</Text>
                  <Text style={styles.summaryValue}>{tripData.summary?.total_trips || tripData.trips?.length || 0}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Freight</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(tripData.summary?.total_freight || 0)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Collected</Text>
                  <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                    {formatCurrency(tripData.summary?.total_received || 0)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Balance</Text>
                  <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                    {formatCurrency(tripData.summary?.total_balance || 0)}
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'payments' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Payments</Text>
                  <Text style={styles.summaryValue}>{paymentData.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Received</Text>
                  <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                    {formatCurrency(paymentData.reduce((acc, p) => acc + (parseFloat(p.received_amount) || 0), 0))}
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'settlements' && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Settlements</Text>
                  <Text style={styles.summaryValue}>{settlementData.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Driver Balance</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.accent }]}>
                    {formatCurrency(settlementData.reduce((acc, s) => acc + (parseFloat(s.balance_to_driver) || 0), 0))}
                  </Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.exportFullBtn}
            onPress={handleExportFullReport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Download size={16} color={COLORS.white} />
                <Text style={styles.exportFullBtnText}>Export CSV</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Data Cards List */}
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.centerText}>Loading Report Data...</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {/* TRIPS TAB LIST */}
            {activeTab === 'trips' && (
              tripData.trips?.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No trips found for selected filters</Text>
                </View>
              ) : (
                tripData.trips?.map((trip: any) => (
                  <View key={trip.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBadgeLorry}>
                        <Truck size={14} color={COLORS.primary} />
                        <Text style={styles.cardLorryText}>{trip.lorry_number}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <View style={[styles.cardStatus, getStatusStyle(trip.status)]}>
                          <Text style={[styles.cardStatusText, getStatusTextStyle(trip.status)]}>
                            {trip.status}
                          </Text>
                        </View>
                        {/* Single-in-grid download option */}
                        <TouchableOpacity
                          style={styles.singleDownloadBtn}
                          onPress={() => handleExportSingleTrip(trip)}
                        >
                          <Download size={14} color="#1d4ed8" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.cardPartyText}>{trip.party_name}</Text>
                    <Text style={styles.cardRouteText}>
                      {trip.from_location} → {trip.to_location} • {trip.goods_weight} {trip.unit_name || 'Ton'}
                    </Text>

                    <View style={styles.cardMetricsGrid}>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Freight</Text>
                        <Text style={styles.metricVal}>{formatCurrency(trip.total_freight)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Advance</Text>
                        <Text style={styles.metricVal}>{formatCurrency(trip.advance_paid)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Received</Text>
                        <Text style={[styles.metricVal, { color: '#10b981' }]}>
                          {formatCurrency(trip.total_received)}
                        </Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Balance</Text>
                        <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                          {formatCurrency(trip.balance_due)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardDate}>{formatDateDMY(trip.trip_date)}</Text>
                      <Text style={styles.cardDriver}>Driver: {trip.driver_name || 'N/A'}</Text>
                    </View>
                  </View>
                ))
              )
            )}

            {/* PAYMENTS TAB LIST */}
            {activeTab === 'payments' && (
              paymentData.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No payment records found</Text>
                </View>
              ) : (
                paymentData.map((p: any) => (
                  <View key={p.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardPartyText}>{p.party_name}</Text>
                      <View style={styles.cardActions}>
                        <Text style={[styles.metricVal, { color: '#10b981', fontSize: 16 }]}>
                          +{formatCurrency(p.received_amount)}
                        </Text>
                        {/* Single-in-grid download option */}
                        <TouchableOpacity
                          style={styles.singleDownloadBtn}
                          onPress={() => handleExportSinglePayment(p)}
                        >
                          <Download size={14} color="#1d4ed8" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.cardRowDetails}>
                      <Text style={styles.cardLorryText}>🚛 {p.lorry_number}</Text>
                      <Text style={styles.cardDate}>{formatDateDMY(p.payment_date)}</Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.metricLabel}>Trip #{p.trip_id} Balance Due:</Text>
                      <Text style={[styles.metricVal, { color: '#ef4444' }]}>
                        {formatCurrency(p.balance_due)}
                      </Text>
                    </View>
                  </View>
                ))
              )
            )}

            {/* SETTLEMENTS TAB LIST */}
            {activeTab === 'settlements' && (
              settlementData.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.centerText}>No settlement records found</Text>
                </View>
              ) : (
                settlementData.map((s: any) => (
                  <View key={s.id} style={styles.dataCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBadgeLorry}>
                        <Truck size={14} color={COLORS.primary} />
                        <Text style={styles.cardLorryText}>{s.lorry_number}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <View style={[styles.cardStatus, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                          <Text style={[styles.cardStatusText, { color: '#047857' }]}>
                            {s.settlement_status}
                          </Text>
                        </View>
                        {/* Single-in-grid download option */}
                        <TouchableOpacity
                          style={styles.singleDownloadBtn}
                          onPress={() => handleExportSingleSettlement(s)}
                        >
                          <Download size={14} color="#1d4ed8" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.cardPartyText}>Driver: {s.driver_name}</Text>
                    <Text style={styles.cardRouteText}>Party: {s.party_name}</Text>

                    <View style={styles.cardMetricsGrid}>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Total Freight</Text>
                        <Text style={styles.metricVal}>{formatCurrency(s.total_freight)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Expenses</Text>
                        <Text style={styles.metricVal}>{formatCurrency(s.total_expenses)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>Advance</Text>
                        <Text style={styles.metricVal}>{formatCurrency(s.advance_paid)}</Text>
                      </View>
                      <View style={styles.cardMetric}>
                        <Text style={styles.metricLabel}>To Driver</Text>
                        <Text style={[styles.metricVal, { color: COLORS.accentDark }]}>
                          {formatCurrency(s.balance_to_driver)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardDate}>{formatDateDMY(s.created_at || s.trip_date)}</Text>
                      <Text style={styles.cardDriver}>Trip #{s.trip_id}</Text>
                    </View>
                  </View>
                ))
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* Picker Modal for Truck / Party / Unit / Status */}
      <Modal
        visible={pickerModalType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPickerModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerModalType === 'vehicle' && 'Select Truck / Lorry'}
                {pickerModalType === 'party' && 'Select Party'}
                {pickerModalType === 'unit' && 'Select Unit'}
                {pickerModalType === 'status' && 'Select Trip Status'}
              </Text>
              <TouchableOpacity onPress={() => setPickerModalType(null)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* All Options list */}
            <FlatList
              data={
                pickerModalType === 'vehicle'
                  ? [{ id: 0, lorry_number: 'All Trucks / Lorries' }, ...vehicles]
                  : pickerModalType === 'party'
                  ? [{ id: 0, name: 'All Parties' }, ...parties]
                  : pickerModalType === 'unit'
                  ? [{ id: 0, name: 'All Units' }, ...units]
                  : [
                      { id: 0, label: 'All Statuses', value: '' },
                      { id: 1, label: 'NEW', value: 'NEW' },
                      { id: 2, label: 'PAYMENT_PENDING', value: 'PAYMENT_PENDING' },
                      { id: 3, label: 'PARTIALLY_PAID', value: 'PARTIALLY_PAID' },
                      { id: 4, label: 'SETTLED', value: 'SETTLED' },
                      { id: 5, label: 'CANCELLED', value: 'CANCELLED' },
                    ]
              }
              keyExtractor={(item: any) => String(item.id || item.value)}
              renderItem={({ item }: { item: any }) => {
                let isSelected = false;
                let title = '';

                if (pickerModalType === 'vehicle') {
                  isSelected = (item.id === 0 && !selectedVehicleId) || selectedVehicleId === item.id;
                  title = item.lorry_number;
                } else if (pickerModalType === 'party') {
                  isSelected = (item.id === 0 && !selectedPartyId) || selectedPartyId === item.id;
                  title = item.name;
                } else if (pickerModalType === 'unit') {
                  isSelected = (item.id === 0 && !selectedUnitId) || selectedUnitId === item.id;
                  title = item.name;
                } else {
                  isSelected = selectedStatus === item.value;
                  title = item.label;
                }

                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (pickerModalType === 'vehicle') {
                        setSelectedVehicleId(item.id === 0 ? undefined : item.id);
                      } else if (pickerModalType === 'party') {
                        setSelectedPartyId(item.id === 0 ? undefined : item.id);
                      } else if (pickerModalType === 'unit') {
                        setSelectedUnitId(item.id === 0 ? undefined : item.id);
                      } else {
                        setSelectedStatus(item.value);
                      }
                      setPickerModalType(null);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {title}
                    </Text>
                    {isSelected && <Check size={18} color={COLORS.accentDark} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'SETTLED':
      return { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' };
    case 'PARTIALLY_PAID':
      return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
    case 'PAYMENT_PENDING':
      return { backgroundColor: '#fffbeb', borderColor: '#fde68a' };
    case 'CANCELLED':
      return { backgroundColor: '#fef2f2', borderColor: '#fca5a5' };
    default:
      return { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' };
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'SETTLED':
      return { color: '#047857' };
    case 'PARTIALLY_PAID':
      return { color: '#1d4ed8' };
    case 'PAYMENT_PENDING':
      return { color: '#b45309' };
    case 'CANCELLED':
      return { color: '#b91c1c' };
    default:
      return { color: '#475569' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  quickDateRow: {
    marginBottom: SPACING.sm,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  quickPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  quickPillTextActive: {
    color: COLORS.white,
  },
  filtersCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  filterCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginHorizontal: 6,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  dateInputBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.text,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  clearBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  summaryBar: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.md,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },
  summaryItem: {
    minWidth: 70,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  exportFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginLeft: 8,
  },
  exportFullBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  listContainer: {
    gap: 10,
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  dataCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardBadgeLorry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  cardLorryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  singleDownloadBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cardPartyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  cardRouteText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
  },
  cardMetric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  cardDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  cardDriver: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  cardRowDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: '#fffbeb',
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalItemTextSelected: {
    color: COLORS.accentDark,
    fontWeight: '800',
  },
});
