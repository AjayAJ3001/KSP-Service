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
  Truck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Calendar,
  FileCheck,
  Shield,
  CreditCard,
  RefreshCw,
  Edit2,
} from 'lucide-react-native';
import { adminVehicleService } from '../../services/adminService';
import { Vehicle } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

type VehicleFilter = 'ALL' | 'EXPIRING' | 'ACTIVE' | 'INACTIVE';

export const AdminVehiclesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<VehicleFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [lorryNumber, setLorryNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('10 Wheeler');
  const [capacityTons, setCapacityTons] = useState('');
  const [goodshedExpense, setGoodshedExpense] = useState('');
  const [fcNumber, setFcNumber] = useState('');
  const [fcExpiryDate, setFcExpiryDate] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [permitExpiryDate, setPermitExpiryDate] = useState('');
  const [taxExpiryDate, setTaxExpiryDate] = useState('');
  const [rcNumber, setRcNumber] = useState('');
  const [rcExpiryDate, setRcExpiryDate] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const loadVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminVehicleService.getVehicles({ limit: 100 });
      setVehicles(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load vehicles', err);
      Alert.alert('Error', err.message || 'Could not fetch vehicles.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const getDaysLeft = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const getDocAlerts = (v: Vehicle) => {
    const docs = [
      { name: 'FC', date: v.fc_expiry_date },
      { name: 'Insurance', date: v.insurance_expiry_date },
      { name: 'Permit', date: v.permit_expiry_date },
      { name: 'Road Tax', date: v.tax_expiry_date },
    ];
    return docs
      .map((d) => {
        const days = getDaysLeft(d.date);
        if (days === null || days > 30) return null;
        return { name: d.name, date: d.date, days, isExpired: days < 0 };
      })
      .filter(Boolean) as { name: string; date: string; days: number; isExpired: boolean }[];
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (search && !v.lorry_number.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterType === 'ACTIVE') return v.status === 'ACTIVE';
    if (filterType === 'INACTIVE') return v.status === 'INACTIVE';
    if (filterType === 'EXPIRING') {
      return getDocAlerts(v).length > 0;
    }
    return true;
  });

  const expiringCount = vehicles.filter((v) => getDocAlerts(v).length > 0).length;

  const openAddModal = () => {
    setEditingVehicle(null);
    setLorryNumber('');
    setVehicleType('10 Wheeler');
    setCapacityTons('');
    setGoodshedExpense('');
    setFcNumber('');
    setFcExpiryDate('');
    setInsuranceNumber('');
    setInsuranceExpiryDate('');
    setPermitNumber('');
    setPermitExpiryDate('');
    setTaxExpiryDate('');
    setRcNumber('');
    setRcExpiryDate('');
    setPanNumber('');
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setLorryNumber(v.lorry_number);
    setVehicleType(v.vehicle_type || '10 Wheeler');
    setCapacityTons(String(v.capacity_tons || ''));
    setGoodshedExpense(String(v.goodshed_loading_expense || ''));
    setFcNumber(v.fc_number || '');
    setFcExpiryDate(v.fc_expiry_date ? v.fc_expiry_date.split('T')[0] : '');
    setInsuranceNumber(v.insurance_policy_number || '');
    setInsuranceExpiryDate(v.insurance_expiry_date ? v.insurance_expiry_date.split('T')[0] : '');
    setPermitNumber(v.permit_number || '');
    setPermitExpiryDate(v.permit_expiry_date ? v.permit_expiry_date.split('T')[0] : '');
    setTaxExpiryDate(v.tax_expiry_date ? v.tax_expiry_date.split('T')[0] : '');
    setRcNumber(v.rc_number || '');
    setRcExpiryDate(v.rc_expiry_date ? v.rc_expiry_date.split('T')[0] : '');
    setPanNumber(v.pan_number || '');
    setBankName(v.bank_name || '');
    setAccountNumber(v.account_number || '');
    setIfscCode(v.ifsc_code || '');
    setIsModalOpen(true);
  };

  const handleSaveVehicle = async () => {
    if (!lorryNumber.trim()) {
      Alert.alert('Validation', 'Lorry Number is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Vehicle> = {
        lorry_number: lorryNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
        capacity_tons: parseFloat(capacityTons) || undefined,
        goodshed_loading_expense: parseFloat(goodshedExpense) || undefined,
        fc_number: fcNumber || undefined,
        fc_expiry_date: fcExpiryDate || undefined,
        insurance_policy_number: insuranceNumber || undefined,
        insurance_expiry_date: insuranceExpiryDate || undefined,
        permit_number: permitNumber || undefined,
        permit_expiry_date: permitExpiryDate || undefined,
        tax_expiry_date: taxExpiryDate || undefined,
        rc_number: rcNumber || undefined,
        rc_expiry_date: rcExpiryDate || undefined,
        pan_number: panNumber || undefined,
        bank_name: bankName || undefined,
        account_number: accountNumber || undefined,
        ifsc_code: ifscCode || undefined,
      };

      if (editingVehicle) {
        await adminVehicleService.updateVehicle(editingVehicle.id, payload);
        Alert.alert('Updated', 'Vehicle details updated successfully.');
      } else {
        await adminVehicleService.createVehicle(payload);
        Alert.alert('Created', `Vehicle ${lorryNumber} registered successfully.`);
      }

      setIsModalOpen(false);
      loadVehicles();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (v: Vehicle) => {
    const nextStatus = v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Status Change',
      `Mark lorry ${v.lorry_number} as ${nextStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await adminVehicleService.updateStatus(v.id, nextStatus);
              loadVehicles();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header & Search */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Lorry No (e.g. TN28...)"
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
            <Text style={styles.addBtnText}>Add Truck</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.pill, filterType === 'ALL' && styles.pillActive]}
            onPress={() => setFilterType('ALL')}
          >
            <Text style={[styles.pillText, filterType === 'ALL' && styles.pillTextActive]}>
              All ({vehicles.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, filterType === 'EXPIRING' && styles.pillActiveExpiring]}
            onPress={() => setFilterType('EXPIRING')}
          >
            <AlertTriangle size={13} color={filterType === 'EXPIRING' ? '#b91c1c' : '#ea580c'} />
            <Text style={[styles.pillText, filterType === 'EXPIRING' && { color: '#b91c1c', fontWeight: '800' }]}>
              Expiring &lt;30d ({expiringCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, filterType === 'ACTIVE' && styles.pillActive]}
            onPress={() => setFilterType('ACTIVE')}
          >
            <Text style={[styles.pillText, filterType === 'ACTIVE' && styles.pillTextActive]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, filterType === 'INACTIVE' && styles.pillActive]}
            onPress={() => setFilterType('INACTIVE')}
          >
            <Text style={[styles.pillText, filterType === 'INACTIVE' && styles.pillTextActive]}>
              Inactive
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Vehicle List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Fleet Lorries...</Text>
        </View>
      ) : filteredVehicles.length === 0 ? (
        <View style={styles.centerBox}>
          <Truck size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No vehicles found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredVehicles.map((v) => {
            const alerts = getDocAlerts(v);
            const isActive = v.status === 'ACTIVE';

            return (
              <View key={v.id} style={styles.vehicleCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.lorryTag}>
                    <Truck size={16} color={COLORS.primary} />
                    <Text style={styles.lorryTitle}>{v.lorry_number}</Text>
                  </View>
                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                        {v.status}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(v)}>
                      <Edit2 size={14} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Specs row */}
                <View style={styles.specsRow}>
                  <Text style={styles.specText}>Type: {v.vehicle_type || 'N/A'}</Text>
                  {v.capacity_tons ? <Text style={styles.specText}>• Capacity: {v.capacity_tons} Tons</Text> : null}
                  {v.goodshed_loading_expense ? (
                    <Text style={styles.specText}>• Goodshed: ₹{v.goodshed_loading_expense}</Text>
                  ) : null}
                </View>

                {/* Compliance Expiry Alerts */}
                {alerts.length > 0 ? (
                  <View style={styles.alertBox}>
                    <View style={styles.alertBoxTitleRow}>
                      <AlertTriangle size={14} color="#c2410c" />
                      <Text style={styles.alertBoxTitle}>Documents Expiring Soon / Expired:</Text>
                    </View>
                    <View style={styles.badgeWrap}>
                      {alerts.map((doc, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.docBadge,
                            { backgroundColor: doc.isExpired ? '#fef2f2' : '#fffbeb', borderColor: doc.isExpired ? '#fca5a5' : '#fcd34d' }
                          ]}
                        >
                          <Text style={[styles.docBadgeText, { color: doc.isExpired ? '#b91c1c' : '#92400e' }]}>
                            {doc.isExpired ? '❌' : '⚠️'} {doc.name}: {formatDateDMY(doc.date)} ({doc.isExpired ? `${Math.abs(doc.days)}d ago` : `${doc.days}d left`})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Document details preview */}
                <View style={styles.docsPreview}>
                  <Text style={styles.docItem}>FC: {v.fc_expiry_date ? formatDateDMY(v.fc_expiry_date) : 'N/A'}</Text>
                  <Text style={styles.docItem}>Ins: {v.insurance_expiry_date ? formatDateDMY(v.insurance_expiry_date) : 'N/A'}</Text>
                  <Text style={styles.docItem}>Permit: {v.permit_expiry_date ? formatDateDMY(v.permit_expiry_date) : 'N/A'}</Text>
                  <Text style={styles.docItem}>Tax: {v.tax_expiry_date ? formatDateDMY(v.tax_expiry_date) : 'N/A'}</Text>
                </View>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: isActive ? '#fef2f2' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(v)}
                  >
                    <Text style={[styles.toggleBtnText, { color: isActive ? '#dc2626' : '#16a34a' }]}>
                      {isActive ? 'Mark Inactive' : 'Mark Active'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add / Edit Vehicle Modal */}
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
                {editingVehicle ? `Edit Lorry ${editingVehicle.lorry_number}` : 'Register New Vehicle'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Basic Vehicle Details</Text>
            <Text style={styles.label}>Lorry Number * (e.g. TN28AA1234)</Text>
            <TextInput
              style={styles.input}
              value={lorryNumber}
              onChangeText={setLorryNumber}
              placeholder="TN28AA1234"
              autoCapitalize="characters"
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Vehicle Type</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleType}
                  onChangeText={setVehicleType}
                  placeholder="10 Wheeler"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Capacity (Tons)</Text>
                <TextInput
                  style={styles.input}
                  value={capacityTons}
                  onChangeText={setCapacityTons}
                  placeholder="16"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>Goodshed Loading Expense (₹)</Text>
            <TextInput
              style={styles.input}
              value={goodshedExpense}
              onChangeText={setGoodshedExpense}
              placeholder="0.00"
              keyboardType="numeric"
            />

            <Text style={styles.sectionHeader}>Compliance & Document Dates (YYYY-MM-DD)</Text>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>FC Number</Text>
                <TextInput style={styles.input} value={fcNumber} onChangeText={setFcNumber} placeholder="FC-..." />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>FC Expiry Date</Text>
                <TextInput style={styles.input} value={fcExpiryDate} onChangeText={setFcExpiryDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Insurance Policy</Text>
                <TextInput style={styles.input} value={insuranceNumber} onChangeText={setInsuranceNumber} placeholder="POL-..." />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Insurance Expiry</Text>
                <TextInput style={styles.input} value={insuranceExpiryDate} onChangeText={setInsuranceExpiryDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Permit Number</Text>
                <TextInput style={styles.input} value={permitNumber} onChangeText={setPermitNumber} placeholder="PER-..." />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Permit Expiry</Text>
                <TextInput style={styles.input} value={permitExpiryDate} onChangeText={setPermitExpiryDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Road Tax Expiry</Text>
                <TextInput style={styles.input} value={taxExpiryDate} onChangeText={setTaxExpiryDate} placeholder="YYYY-MM-DD" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>RC Expiry Date</Text>
                <TextInput style={styles.input} value={rcExpiryDate} onChangeText={setRcExpiryDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveVehicle} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Vehicle</Text>
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
    marginBottom: 8,
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
  filterPills: {
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
  },
  pillActiveExpiring: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: COLORS.white,
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
  vehicleCard: {
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
  lorryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lorryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusInactive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#047857',
  },
  statusInactiveText: {
    color: '#b91c1c',
  },
  editBtn: {
    padding: 6,
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.sm,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  specText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  alertBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
  },
  alertBoxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alertBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c2410c',
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  docBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  docsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: RADIUS.md,
    marginVertical: 4,
  },
  docItem: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  toggleBtnText: {
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accentDark,
    marginTop: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 6,
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
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
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
