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
  User,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Phone,
  CreditCard,
  Edit2,
  RefreshCw,
} from 'lucide-react-native';
import { adminDriverService } from '../../services/adminService';
import { Driver } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';

type DriverFilter = 'ALL' | 'EXPIRING' | 'ACTIVE' | 'INACTIVE';

export const AdminDriversScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DriverFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState('HEAVY');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');

  const loadDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminDriverService.getDrivers({ limit: 100 });
      setDrivers(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load drivers', err);
      Alert.alert('Error', err.message || 'Could not fetch drivers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const getDaysLeft = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const filteredDrivers = drivers.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = d.name.toLowerCase().includes(q);
      const matchPhone = d.mobile_number && d.mobile_number.includes(q);
      const matchLic = d.license_number && d.license_number.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchLic) return false;
    }
    if (filterType === 'ACTIVE') return d.status === 'ACTIVE';
    if (filterType === 'INACTIVE') return d.status === 'INACTIVE';
    if (filterType === 'EXPIRING') {
      const days = getDaysLeft(d.license_expiry_date);
      return days !== null && days <= 30;
    }
    return true;
  });

  const expiringCount = drivers.filter((d) => {
    const days = getDaysLeft(d.license_expiry_date);
    return days !== null && days <= 30;
  }).length;

  const openAddModal = () => {
    setEditingDriver(null);
    setName('');
    setMobileNumber('');
    setLicenseNumber('');
    setLicenseType('HEAVY');
    setLicenseExpiryDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: Driver) => {
    setEditingDriver(d);
    setName(d.name);
    setMobileNumber(d.mobile_number || '');
    setLicenseNumber(d.license_number || '');
    setLicenseType(d.license_type || 'HEAVY');
    setLicenseExpiryDate(d.license_expiry_date ? d.license_expiry_date.split('T')[0] : '');
    setIsModalOpen(true);
  };

  const handleSaveDriver = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Driver Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Driver> = {
        name: name.trim(),
        mobile_number: mobileNumber.trim() || undefined,
        license_number: licenseNumber.trim() || undefined,
        license_type: licenseType,
        license_expiry_date: licenseExpiryDate.trim() || undefined,
      };

      if (editingDriver) {
        await adminDriverService.updateDriver(editingDriver.id, payload);
        Alert.alert('Updated', 'Driver details saved.');
      } else {
        await adminDriverService.createDriver(payload);
        Alert.alert('Created', `Driver ${name} registered.`);
      }

      setIsModalOpen(false);
      loadDrivers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (d: Driver) => {
    const nextStatus = d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert('Status Change', `Change ${d.name}'s status to ${nextStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await adminDriverService.updateStatus(d.id, nextStatus);
            loadDrivers();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search driver name, phone, license..."
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
            <Text style={styles.addBtnText}>Add Driver</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.pill, filterType === 'ALL' && styles.pillActive]}
            onPress={() => setFilterType('ALL')}
          >
            <Text style={[styles.pillText, filterType === 'ALL' && styles.pillTextActive]}>
              All ({drivers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, filterType === 'EXPIRING' && styles.pillActiveExpiring]}
            onPress={() => setFilterType('EXPIRING')}
          >
            <AlertTriangle size={13} color={filterType === 'EXPIRING' ? '#b91c1c' : '#ea580c'} />
            <Text style={[styles.pillText, filterType === 'EXPIRING' && { color: '#b91c1c', fontWeight: '800' }]}>
              License Expiring &lt;30d ({expiringCount})
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

      {/* Driver List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Drivers...</Text>
        </View>
      ) : filteredDrivers.length === 0 ? (
        <View style={styles.centerBox}>
          <User size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No drivers found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredDrivers.map((d) => {
            const isActive = d.status === 'ACTIVE';
            const daysLeft = getDaysLeft(d.license_expiry_date);
            const isLicenseExpiring = daysLeft !== null && daysLeft <= 30;

            return (
              <View key={d.id} style={styles.driverCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.driverTag}>
                    <User size={16} color={COLORS.primary} />
                    <Text style={styles.driverName}>{d.name}</Text>
                  </View>
                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                        {d.status}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(d)}>
                      <Edit2 size={14} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info rows */}
                <View style={styles.infoRow}>
                  {d.mobile_number ? (
                    <View style={styles.infoItem}>
                      <Phone size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>{d.mobile_number}</Text>
                    </View>
                  ) : null}
                  {d.license_number ? (
                    <View style={styles.infoItem}>
                      <CreditCard size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>Lic: {d.license_number} ({d.license_type || 'HEAVY'})</Text>
                    </View>
                  ) : null}
                </View>

                {/* Expiry Warning */}
                {isLicenseExpiring ? (
                  <View style={styles.alertBox}>
                    <AlertTriangle size={13} color="#ea580c" />
                    <Text style={styles.alertText}>
                      License Expiring: {formatDateDMY(d.license_expiry_date)} ({daysLeft < 0 ? `EXPIRED ${Math.abs(daysLeft)}d ago` : `${daysLeft} days left`})
                    </Text>
                  </View>
                ) : d.license_expiry_date ? (
                  <Text style={styles.normalExpiryText}>
                    License Valid Until: {formatDateDMY(d.license_expiry_date)}
                  </Text>
                ) : null}

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: isActive ? '#fef2f2' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(d)}
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

      {/* Add / Edit Driver Modal */}
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
                {editingDriver ? `Edit ${editingDriver.name}` : 'Register New Driver'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Driver Full Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. S. Murugan"
            />

            <Text style={styles.label}>Mobile Phone Number</Text>
            <TextInput
              style={styles.input}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Driving License Number</Text>
            <TextInput
              style={styles.input}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              placeholder="TN28 20180001234"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>License Type</Text>
            <View style={styles.row}>
              {['HEAVY', 'REGULAR'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, licenseType === t && styles.typeBtnActive]}
                  onPress={() => setLicenseType(t)}
                >
                  <Text style={[styles.typeBtnText, licenseType === t && styles.typeBtnTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>License Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={licenseExpiryDate}
              onChangeText={setLicenseExpiryDate}
              placeholder="2027-12-31"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDriver} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Driver</Text>
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
  driverCard: {
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
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
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
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 6,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  alertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  normalExpiryText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
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
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 8,
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
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  typeBtnTextActive: {
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
