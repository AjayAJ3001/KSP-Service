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
} from 'react-native';
import {
  HandCoins,
  Plus,
  Search,
  Calendar,
  UserCheck,
  Briefcase,
  Edit2,
  Trash2,
  X,
  CreditCard,
  RefreshCw,
  Clock,
  FileText,
  Printer,
  Download,
  Truck,
} from 'lucide-react-native';
import { printMastersPdf, downloadMastersPdf } from '../../utils/pdfGenerator';
import { adminOwnerAdvanceService, adminOwnerService, adminUserService, adminDriverService, adminVehicleService } from '../../services/adminService';
import { OwnerAdvance, Owner, User, Driver, Vehicle } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { DatePickerModal, toDisplayDate } from '../../components/DatePickerModal';

export const AdminOwnerAdvancesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [advances, setAdvances] = useState<OwnerAdvance[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'ALL' | 'MANAGER' | 'DRIVER'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | 'form' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<'print' | 'download' | null>(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<OwnerAdvance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [recipientType, setRecipientType] = useState<'MANAGER' | 'DRIVER'>('MANAGER');
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [notes, setNotes] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [oRes, uRes, dRes, vRes] = await Promise.all([
        adminOwnerService.getOwners({ limit: 100 }),
        adminUserService.getUsers({ limit: 200, status: 'ACTIVE', for_advance: true }),
        adminDriverService.getDrivers({ limit: 500, status: 'ACTIVE' }),
        adminVehicleService.getVehicles({ limit: 100 }),
      ]);
      setOwners(oRes.data.items || []);
      const managerList = (uRes.data.items || []).filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN');
      setManagers(managerList);
      setDrivers(dRes.data.items || []);
      setVehicles(vRes.data.items || []);
    } catch (err) {
      console.error('Failed to load owners/managers/drivers', err);
    }
  }, []);

  const loadAdvances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminOwnerAdvanceService.getOwnerAdvances({
        limit: 100,
        search: search || undefined,
        recipient_type: recipientFilter === 'ALL' ? undefined : recipientFilter,
        from_date: fromDate.trim() || undefined,
        to_date: toDate.trim() || undefined,
      });
      setAdvances(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (err: any) {
      console.error('Failed to load owner advances', err);
      Alert.alert('Error', err.message || 'Could not fetch owner advances.');
    } finally {
      setIsLoading(false);
    }
  }, [search, recipientFilter, fromDate, toDate]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const openAddModal = () => {
    setEditingAdvance(null);
    setSelectedOwnerId(owners.length > 0 ? owners[0].id : null);
    setRecipientType('MANAGER');
    setSelectedManagerId(managers.length > 0 ? managers[0].id : null);
    setSelectedDriverId(drivers.length > 0 ? drivers[0].id : null);
    setSelectedVehicleId(null);
    setAmount('');
    setAdvanceDate(getTodayISO());
    setPaymentMode('CASH');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (adv: OwnerAdvance) => {
    setEditingAdvance(adv);
    setSelectedOwnerId(adv.owner_id);
    const isDriverAdv = adv.recipient_type === 'DRIVER' || Boolean(!adv.manager_id && adv.driver_id);
    setRecipientType(isDriverAdv ? 'DRIVER' : 'MANAGER');
    setSelectedManagerId(adv.manager_id || null);
    setSelectedDriverId(adv.driver_id || null);
    setSelectedVehicleId(adv.vehicle_id || null);
    setAmount(String(adv.amount));
    setAdvanceDate(adv.advance_date ? adv.advance_date.split('T')[0] : getTodayISO());
    setPaymentMode((adv.payment_mode as any) || 'CASH');
    setNotes(adv.notes || '');
    setIsModalOpen(true);
  };

  const getFullAdvanceIsoTimestamp = (dateInput?: string) => {
    const now = new Date();
    if (!dateInput || !dateInput.trim()) return now.toISOString();
    const clean = dateInput.trim();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayUTC = now.toISOString().split('T')[0];
    if (clean === todayYMD || clean === todayUTC) {
      return now.toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      const combined = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      return combined.toISOString();
    }
    return clean;
  };

  const handleSaveAdvance = async () => {
    if (!selectedOwnerId) {
      Alert.alert('Required', 'Please select a vehicle owner.');
      return;
    }
    if (recipientType === 'MANAGER' && !selectedManagerId) {
      Alert.alert('Required', 'Please select a manager.');
      return;
    }
    if (recipientType === 'DRIVER' && !selectedDriverId) {
      Alert.alert('Required', 'Please select a driver.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Required', 'Please enter a valid advance amount greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        owner_id: selectedOwnerId,
        recipient_type: recipientType,
        manager_id: recipientType === 'MANAGER' ? selectedManagerId : null,
        driver_id: recipientType === 'DRIVER' ? selectedDriverId : null,
        vehicle_id: selectedVehicleId || null,
        amount: numAmount,
        advance_date: getFullAdvanceIsoTimestamp(advanceDate),
        payment_mode: paymentMode,
        notes: notes.trim() || undefined,
      };

      if (editingAdvance) {
        await adminOwnerAdvanceService.updateOwnerAdvance(editingAdvance.id, payload);
        Alert.alert('Updated', `Advance to ${recipientType === 'DRIVER' ? 'driver' : 'manager'} updated successfully.`);
      } else {
        await adminOwnerAdvanceService.createOwnerAdvance(payload);
        Alert.alert('Saved', `Advance to ${recipientType === 'DRIVER' ? 'driver' : 'manager'} recorded successfully.`);
      }

      setIsModalOpen(false);
      loadAdvances();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save advance record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdvance = (adv: OwnerAdvance) => {
    Alert.alert(
      'Delete Advance Entry',
      `Are you sure you want to delete advance entry #${adv.id} of ${formatCurrency(adv.amount)}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminOwnerAdvanceService.deleteOwnerAdvance(adv.id);
              Alert.alert('Deleted', 'Advance entry deleted.');
              loadAdvances();
            } catch (e: any) {
              Alert.alert('Delete Failed', e.message);
            }
          },
        },
      ]
    );
  };

  const handlePrintPdf = async () => {
    try {
      setPdfLoading('print');
      await printMastersPdf({
        tab: 'ADVANCES',
        tabLabel: 'Owner Advances Ledger',
        advances,
      });
    } catch (err: any) {
      console.error('Print advances PDF failed', err);
      Alert.alert('Print Error', err.message || 'Failed to print advances ledger.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setPdfLoading('download');
      const result = await downloadMastersPdf({
        tab: 'ADVANCES',
        tabLabel: 'Owner Advances Ledger',
        advances,
      });
      if (result.success && result.savedDirectly) {
        Alert.alert('PDF Saved', `Owner advances ledger saved:\n${result.filename}`);
      }
    } catch (err: any) {
      console.error('Download advances PDF failed', err);
      Alert.alert('Download Error', err.message || 'Failed to download PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search & Top Action Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search owner, manager, driver, notes..."
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.pdfBtn, styles.printBtn, pdfLoading === 'print' && { opacity: 0.7 }]}
            onPress={handlePrintPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'print' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Printer size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>Print</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pdfBtn, styles.downloadBtn, pdfLoading === 'download' && { opacity: 0.7 }]}
            onPress={handleDownloadPdf}
            disabled={pdfLoading !== null || isLoading}
            activeOpacity={0.8}
          >
            {pdfLoading === 'download' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Download size={13} color={COLORS.white} />
                <Text style={styles.pdfBtnText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Give Advance</Text>
          </TouchableOpacity>
        </View>

        {/* Recipient Filter Pills */}
        <View style={styles.filterChipRow}>
          {(['ALL', 'MANAGER', 'DRIVER'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterPill,
                recipientFilter === type && (type === 'DRIVER' ? styles.filterPillActiveDriver : styles.filterPillActive),
              ]}
              onPress={() => setRecipientFilter(type)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  recipientFilter === type && styles.filterPillTextActive,
                ]}
              >
                {type === 'ALL' ? 'All Recipient Types' : type === 'MANAGER' ? 'Managers' : 'Drivers Directly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Range Filter + Clear */}
        <View style={{ paddingHorizontal: SPACING.sm, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <View style={styles.dateRangeRow}>
            <TouchableOpacity
              style={[styles.datePickerBtn, fromDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('from')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={fromDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, fromDate ? styles.datePickerBtnTextActive : null]}>
                {fromDate ? toDisplayDate(fromDate) : 'From (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '700' }}>–</Text>
            <TouchableOpacity
              style={[styles.datePickerBtn, toDate ? styles.datePickerBtnActive : null]}
              onPress={() => setDatePickerTarget('to')}
              activeOpacity={0.7}
            >
              <Calendar size={12} color={toDate ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.datePickerBtnText, toDate ? styles.datePickerBtnTextActive : null]}>
                {toDate ? toDisplayDate(toDate) : 'To (DD-MM-YYYY)'}
              </Text>
            </TouchableOpacity>
            {(fromDate || toDate) && (
              <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {(search || fromDate || toDate || recipientFilter !== 'ALL') && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => { setSearch(''); setFromDate(''); setToDate(''); setRecipientFilter('ALL'); }}
              activeOpacity={0.7}
            >
              <RefreshCw size={11} color="#dc2626" />
              <Text style={styles.clearFiltersBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Total Summary Banner */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL OWNER ADVANCES GIVEN</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summarySub}>{total} Entries</Text>
            <TouchableOpacity onPress={loadAdvances} style={styles.reloadBtn}>
              <RefreshCw size={14} color={COLORS.primaryDark} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Advance Records List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Advance Entries...</Text>
        </View>
      ) : advances.length === 0 ? (
        <View style={styles.centerBox}>
          <HandCoins size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No advance entries recorded yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {advances.map((adv) => {
            const isDriver = adv.recipient_type === 'DRIVER' || Boolean(!adv.manager_id && adv.driver_id);
            return (
              <View key={adv.id} style={styles.advanceCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.ownerTag}>
                    <Briefcase size={16} color={COLORS.primary} />
                    <Text style={styles.ownerName}>{adv.owner_name || `Owner #${adv.owner_id}`}</Text>
                  </View>
                  <View style={styles.amountPill}>
                    <Text style={styles.amountText}>{formatCurrency(adv.amount)}</Text>
                  </View>
                </View>

                {/* Recipient Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                  {isDriver ? (
                    <View style={styles.driverDirectBadge}>
                      <Truck size={10} color="#7c3aed" />
                      <Text style={styles.driverDirectBadgeText}>DIRECT TO DRIVER</Text>
                    </View>
                  ) : (
                    <View style={styles.managerBadge}>
                      <UserCheck size={10} color="#0284c7" />
                      <Text style={styles.managerBadgeText}>TO MANAGER</Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    {isDriver ? (
                      <Truck size={13} color="#7c3aed" />
                    ) : (
                      <UserCheck size={13} color={COLORS.accentDark} />
                    )}
                    <Text style={styles.infoText}>
                      {isDriver ? 'Driver: ' : 'Manager: '}
                      <Text style={{ fontWeight: '700', color: COLORS.text }}>
                        {isDriver
                          ? (adv.driver_name || `Driver #${adv.driver_id}`)
                          : (adv.manager_name || `Manager #${adv.manager_id}`)}
                      </Text>
                      {isDriver && adv.lorry_number ? (
                        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                          {` (${adv.lorry_number})`}
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Calendar size={13} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>{formatDateDMY(adv.advance_date)}</Text>
                  </View>
                </View>

                <View style={styles.modeRow}>
                  <View style={styles.modeBadge}>
                    <CreditCard size={11} color="#047857" />
                    <Text style={styles.modeBadgeText}>{adv.payment_mode || 'CASH'}</Text>
                  </View>
                  {adv.notes ? (
                    <Text style={styles.notesText} numberOfLines={1}>
                      Note: {adv.notes}
                    </Text>
                  ) : null}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                    onPress={() => openEditModal(adv)}
                  >
                    <Edit2 size={13} color="#2563eb" />
                    <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                    onPress={() => handleDeleteAdvance(adv)}
                  >
                    <Trash2 size={13} color="#dc2626" />
                    <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Add / Edit Advance Modal ── */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAdvance ? `Edit Advance Entry #${editingAdvance.id}` : 'Give Advance to Manager / Driver'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Select Owner */}
            <Text style={styles.label}>Select Vehicle Owner *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {owners.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.chip, selectedOwnerId === o.id && styles.chipActive]}
                  onPress={() => setSelectedOwnerId(o.id)}
                >
                  <Text style={[styles.chipText, selectedOwnerId === o.id && styles.chipTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Recipient Segmented Selector */}
            <Text style={styles.label}>Advance Recipient *</Text>
            <View style={styles.recipientToggleRow}>
              <TouchableOpacity
                style={[
                  styles.recipientToggleBtn,
                  recipientType === 'MANAGER' && styles.recipientToggleBtnActive,
                ]}
                onPress={() => setRecipientType('MANAGER')}
              >
                <UserCheck size={14} color={recipientType === 'MANAGER' ? COLORS.white : COLORS.textMuted} />
                <Text
                  style={[
                    styles.recipientToggleText,
                    recipientType === 'MANAGER' && styles.recipientToggleTextActive,
                  ]}
                >
                  To Manager
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recipientToggleBtn,
                  recipientType === 'DRIVER' && styles.recipientToggleBtnActiveDriver,
                ]}
                onPress={() => setRecipientType('DRIVER')}
              >
                <Truck size={14} color={recipientType === 'DRIVER' ? COLORS.white : COLORS.textMuted} />
                <Text
                  style={[
                    styles.recipientToggleText,
                    recipientType === 'DRIVER' && styles.recipientToggleTextActive,
                  ]}
                >
                  Directly to Driver
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recipient Selection Dropdown / Chips */}
            {recipientType === 'MANAGER' ? (
              <>
                <Text style={styles.label}>Select Receiving Manager *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {managers.length === 0 ? (
                    <Text style={{ fontSize: 12, color: COLORS.textMuted, paddingVertical: 8 }}>No managers found</Text>
                  ) : managers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.chip, selectedManagerId === m.id && styles.chipActive]}
                      onPress={() => setSelectedManagerId(m.id)}
                    >
                      <Text style={[styles.chipText, selectedManagerId === m.id && styles.chipTextActive]}>
                        {m.name} ({m.username})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.label}>Select Receiving Driver *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {drivers.length === 0 ? (
                    <Text style={{ fontSize: 12, color: COLORS.textMuted, paddingVertical: 8 }}>No drivers found</Text>
                  ) : drivers.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.chip, selectedDriverId === d.id && styles.chipActiveDriver]}
                      onPress={() => setSelectedDriverId(d.id)}
                    >
                      <Text style={[styles.chipText, selectedDriverId === d.id && styles.chipTextActive]}>
                        {d.name} {d.mobile_number ? `(${d.mobile_number})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Associated Vehicle / Truck (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.chip, selectedVehicleId === null && styles.chipActive]}
                    onPress={() => setSelectedVehicleId(null)}
                  >
                    <Text style={[styles.chipText, selectedVehicleId === null && styles.chipTextActive]}>
                      None / Unassigned
                    </Text>
                  </TouchableOpacity>
                  {vehicles.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.chip, selectedVehicleId === v.id && styles.chipActive]}
                      onPress={() => setSelectedVehicleId(v.id)}
                    >
                      <Text style={[styles.chipText, selectedVehicleId === v.id && styles.chipTextActive]}>
                        {v.lorry_number}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Amount */}
            <Text style={styles.label}>Advance Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 25000"
              keyboardType="numeric"
            />

            {/* Date */}
            <Text style={styles.label}>Advance Date (DD-MM-YYYY) *</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setDatePickerTarget('form')}
            >
              <Text style={{ fontSize: 13, color: advanceDate ? COLORS.text : COLORS.textMuted, fontWeight: advanceDate ? '600' : '400' }}>
                {advanceDate ? toDisplayDate(advanceDate) : 'Select Date (DD-MM-YYYY)'}
              </Text>
              <Calendar size={15} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Payment Mode */}
            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.modePickerRow}>
              {(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, paymentMode === m && styles.modeBtnActive]}
                  onPress={() => setPaymentMode(m)}
                >
                  <Text style={[styles.modeBtnText, paymentMode === m && styles.modeBtnTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notes / Remarks (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Enter notes or remarks..."
              multiline
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAdvance} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingAdvance ? 'Save Changes' : 'Record Advance'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Calendar Date Picker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={
          datePickerTarget === 'from' ? fromDate :
          datePickerTarget === 'to' ? toDate :
          datePickerTarget === 'form' ? advanceDate : ''
        }
        title={
          datePickerTarget === 'from' ? 'Filter: From Date' :
          datePickerTarget === 'to' ? 'Filter: To Date' :
          'Select Advance Date'
        }
        onConfirm={(isoDate) => {
          if (datePickerTarget === 'from') setFromDate(isoDate);
          else if (datePickerTarget === 'to') setToDate(isoDate);
          else if (datePickerTarget === 'form') setAdvanceDate(isoDate);
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.accent,
    marginTop: 2,
  },
  summarySub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  reloadBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 6,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  advanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ownerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  amountPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#047857',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  notesText: {
    fontSize: 11,
    color: COLORS.textLight,
    flex: 1,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
  },
  modePickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modeBtnTextActive: {
    color: COLORS.white,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  printBtn: {
    backgroundColor: '#0284c7',
  },
  downloadBtn: {
    backgroundColor: '#059669',
  },
  pdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  clearFiltersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  datePickerBtnActive: {
    backgroundColor: '#eff6ff',
  },
  datePickerBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  datePickerBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dateInput: {
    fontSize: 11,
    color: COLORS.text,
    padding: 0,
    minWidth: 90,
    maxWidth: 110,
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillActiveDriver: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  recipientToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  recipientToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recipientToggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  recipientToggleBtnActiveDriver: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  recipientToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  recipientToggleTextActive: {
    color: COLORS.white,
  },
  chipActiveDriver: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  driverDirectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  driverDirectBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.3,
  },
  managerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  managerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.3,
  },
});
