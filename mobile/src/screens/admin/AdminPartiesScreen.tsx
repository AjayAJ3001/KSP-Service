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
  Building2,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  X,
  Phone,
  MapPin,
  User,
  Edit2,
  RefreshCw,
} from 'lucide-react-native';
import { adminPartyService } from '../../services/adminService';
import { Party } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AdminPartiesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');

  const loadParties = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminPartyService.getParties({ limit: 100 });
      setParties(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load parties', err);
      Alert.alert('Error', err.message || 'Could not fetch parties.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const filteredParties = parties.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchContact = p.contact_person && p.contact_person.toLowerCase().includes(q);
      const matchPhone = p.mobile_number && p.mobile_number.includes(q);
      if (!matchName && !matchContact && !matchPhone) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const openAddModal = () => {
    setEditingParty(null);
    setName('');
    setContactPerson('');
    setMobileNumber('');
    setAddress('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Party) => {
    setEditingParty(p);
    setName(p.name);
    setContactPerson(p.contact_person || '');
    setMobileNumber(p.mobile_number || '');
    setAddress(p.address || '');
    setIsModalOpen(true);
  };

  const handleSaveParty = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Party Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Party> = {
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        mobile_number: mobileNumber.trim() || undefined,
        address: address.trim() || undefined,
      };

      if (editingParty) {
        await adminPartyService.updateParty(editingParty.id, payload);
        Alert.alert('Updated', 'Party details updated.');
      } else {
        await adminPartyService.createParty(payload);
        Alert.alert('Created', `Party ${name} created.`);
      }

      setIsModalOpen(false);
      loadParties();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (p: Party) => {
    const nextStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert('Status Change', `Mark party ${p.name} as ${nextStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await adminPartyService.updateStatus(p.id, nextStatus);
            loadParties();
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
              placeholder="Search party by name, contact, phone..."
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
            <Text style={styles.addBtnText}>Add Party</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filters */}
        <View style={styles.filterRow}>
          {['', 'ACTIVE', 'INACTIVE'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, statusFilter === s && styles.pillActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.pillText, statusFilter === s && styles.pillTextActive]}>
                {s === '' ? 'All Parties' : s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Parties...</Text>
        </View>
      ) : filteredParties.length === 0 ? (
        <View style={styles.centerBox}>
          <Building2 size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No parties found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredParties.map((p) => {
            const isActive = p.status === 'ACTIVE';
            return (
              <View key={p.id} style={styles.partyCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.partyTag}>
                    <Building2 size={16} color={COLORS.primary} />
                    <Text style={styles.partyName}>{p.name}</Text>
                  </View>
                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                        {p.status}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(p)}>
                      <Edit2 size={14} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.infoRow}>
                  {p.contact_person ? (
                    <View style={styles.infoItem}>
                      <User size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>{p.contact_person}</Text>
                    </View>
                  ) : null}
                  {p.mobile_number ? (
                    <View style={styles.infoItem}>
                      <Phone size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>{p.mobile_number}</Text>
                    </View>
                  ) : null}
                </View>

                {p.address ? (
                  <View style={styles.addressRow}>
                    <MapPin size={12} color={COLORS.textLight} />
                    <Text style={styles.addressText} numberOfLines={2}>{p.address}</Text>
                  </View>
                ) : null}

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: isActive ? '#fef2f2' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(p)}
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

      {/* Add / Edit Modal */}
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
                {editingParty ? `Edit ${editingParty.name}` : 'Register New Party'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Party / Company Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. ABC Cement Agencies"
            />

            <Text style={styles.label}>Contact Person Name</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="e.g. Suresh Kumar"
            />

            <Text style={styles.label}>Mobile Phone Number</Text>
            <TextInput
              style={styles.input}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Office / Delivery Address</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Full address..."
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveParty} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Party</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: COLORS.primary,
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
  partyCard: {
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
  partyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  partyName: {
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 11,
    color: COLORS.textLight,
    flex: 1,
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
