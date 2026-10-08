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
} from 'lucide-react-native';
import { adminOwnerAdvanceService, adminOwnerService, adminUserService } from '../../services/adminService';
import { OwnerAdvance, Owner, User } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

export const AdminOwnerAdvancesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [advances, setAdvances] = useState<OwnerAdvance[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<OwnerAdvance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [notes, setNotes] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [oRes, uRes] = await Promise.all([
        adminOwnerService.getOwners({ limit: 100 }),
        adminUserService.getUsers({ limit: 100, status: 'ACTIVE' }),
      ]);
      setOwners(oRes.data.items || []);
      const managerList = (uRes.data.items || []).filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN');
      setManagers(managerList);
    } catch (err) {
      console.error('Failed to load owners/managers', err);
    }
  }, []);

  const loadAdvances = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminOwnerAdvanceService.getOwnerAdvances({
        limit: 100,
        search: search || undefined,
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
  }, [search]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const formatCurrency = (val: number | string) => {
    const num = parseFloat(String(val)) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const openAddModal = () => {
    setEditingAdvance(null);
    setSelectedOwnerId(owners.length > 0 ? owners[0].id : null);
    setSelectedManagerId(managers.length > 0 ? managers[0].id : null);
    setAmount('');
    setAdvanceDate(getTodayISO());
    setPaymentMode('CASH');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (adv: OwnerAdvance) => {
    setEditingAdvance(adv);
    setSelectedOwnerId(adv.owner_id);
    setSelectedManagerId(adv.manager_id);
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
    if (!selectedManagerId) {
      Alert.alert('Required', 'Please select a manager.');
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
        manager_id: selectedManagerId,
        amount: numAmount,
        advance_date: getFullAdvanceIsoTimestamp(advanceDate),
        payment_mode: paymentMode,
        notes: notes.trim() || undefined,
      };

      if (editingAdvance) {
        await adminOwnerAdvanceService.updateOwnerAdvance(editingAdvance.id, payload);
        Alert.alert('Updated', 'Advance given to manager updated successfully.');
      } else {
        await adminOwnerAdvanceService.createOwnerAdvance(payload);
        Alert.alert('Saved', 'Advance given to manager recorded successfully.');
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

  return (
    <View style={styles.container}>
      {/* Search & Top Action Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search owner, manager, notes..."
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Give Advance</Text>
          </TouchableOpacity>
        </View>

        {/* Total Summary Banner */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL ADVANCE GIVEN TO MANAGERS</Text>
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
          {advances.map((adv) => (
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

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <UserCheck size={13} color={COLORS.accentDark} />
                  <Text style={styles.infoText}>
                    Manager: <Text style={{ fontWeight: '700', color: COLORS.text }}>{adv.manager_name || `Manager #${adv.manager_id}`}</Text>
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
          ))}
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
                {editingAdvance ? `Edit Advance Entry #${editingAdvance.id}` : 'Give Advance to Manager'}
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

            {/* Select Manager */}
            <Text style={styles.label}>Select Receiving Manager *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {managers.map((m) => (
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
            <Text style={styles.label}>Advance Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={advanceDate}
              onChangeText={setAdvanceDate}
              placeholder="YYYY-MM-DD"
            />

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
    gap: 10,
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
});
