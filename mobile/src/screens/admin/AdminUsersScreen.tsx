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
  Users,
  UserPlus,
  Search,
  Key,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
  X,
  Phone,
  Mail,
  Shield,
  RefreshCw,
} from 'lucide-react-native';
import { adminUserService } from '../../services/adminService';
import { User } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AdminUsersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'TRANSPORT_USER'>('MANAGER');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminUserService.getUsers({
        limit: 100,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load users', err);
      Alert.alert('Error', err.message || 'Could not fetch users.');
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAddModal = () => {
    setEditingUser(null);
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setName(u.name);
    setPassword('');
    setEmail(u.email || '');
    setMobileNumber(u.mobile_number || '');
    setRole(u.role as any);
    setIsAddModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!name.trim()) {
      Alert.alert('Required Fields', 'Full Name is required.');
      return;
    }
    if (!editingUser) {
      if (!username.trim() || !password.trim()) {
        Alert.alert('Required Fields', 'Username and Password are required.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (editingUser) {
        await adminUserService.updateUser(editingUser.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          mobile_number: mobileNumber.trim() || undefined,
          role,
        });
        Alert.alert('Success', `User ${editingUser.username} updated successfully.`);
      } else {
        await adminUserService.createUser({
          username: username.trim(),
          name: name.trim(),
          password: password.trim(),
          email: email.trim() || undefined,
          mobile_number: mobileNumber.trim() || undefined,
          role,
        });
        Alert.alert('Success', `User ${username} created successfully.`);
      }
      setIsAddModalOpen(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = (u: User) => {
    Alert.alert('Delete User', `Are you sure you want to delete user ${u.name} (@${u.username})? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminUserService.deleteUser(u.id);
            Alert.alert('Deleted', `User ${u.username} deleted.`);
            loadUsers();
          } catch (err: any) {
            Alert.alert('Delete Failed', err.message);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Confirm Status Change',
      `Are you sure you want to mark ${user.name} as ${nextStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await adminUserService.updateStatus(user.id, nextStatus);
              loadUsers();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !resetNewPassword || resetNewPassword.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await adminUserService.resetPassword(selectedUser.id, resetNewPassword);
      Alert.alert('Success', `Password reset for ${selectedUser.username}.`);
      setIsResetModalOpen(false);
      setResetNewPassword('');
      setSelectedUser(null);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setName('');
    setPassword('');
    setEmail('');
    setMobileNumber('');
    setRole('MANAGER');
  };

  return (
    <View style={styles.container}>
      {/* Search & Filter Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, username, phone..."
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
            style={styles.addBtn}
            onPress={openAddModal}
          >
            <UserPlus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add User</Text>
          </TouchableOpacity>
        </View>

        {/* Role Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {['', 'ADMIN', 'MANAGER', 'TRANSPORT_USER'].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, roleFilter === r && styles.chipActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>
                {r === '' ? 'All Roles' : r}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* User Count summary */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>Total Accounts: {total}</Text>
        <TouchableOpacity onPress={loadUsers}>
          <RefreshCw size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Users List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Users...</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerBox}>
          <Users size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No users found matching query</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {users.map((u) => {
            const isActive = u.status === 'ACTIVE';
            return (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userUsername}>@{u.username}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={[styles.roleBadge, getRoleBadgeStyle(u.role)]}>
                      <Text style={[styles.roleBadgeText, getRoleBadgeTextStyle(u.role)]}>
                        {u.role}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusBadgeText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                        {u.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.infoRow}>
                  {u.mobile_number ? (
                    <View style={styles.infoItem}>
                      <Phone size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>{u.mobile_number}</Text>
                    </View>
                  ) : null}
                  {u.email ? (
                    <View style={styles.infoItem}>
                      <Mail size={12} color={COLORS.textMuted} />
                      <Text style={styles.infoText}>{u.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                    onPress={() => openEditModal(u)}
                  >
                    <Edit2 size={13} color="#2563eb" />
                    <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isActive ? '#fff7ed' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(u)}
                  >
                    {isActive ? <XCircle size={13} color="#ea580c" /> : <CheckCircle size={13} color="#16a34a" />}
                    <Text style={[styles.actionBtnText, { color: isActive ? '#ea580c' : '#16a34a' }]}>
                      {isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                    onPress={() => {
                      setSelectedUser(u);
                      setResetNewPassword('');
                      setIsResetModalOpen(true);
                    }}
                  >
                    <Key size={13} color="#475569" />
                    <Text style={[styles.actionBtnText, { color: '#475569' }]}>Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                    onPress={() => handleDeleteUser(u)}
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

      {/* Add / Edit User Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? `Edit User (@${editingUser.username})` : 'Create New Account'}
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Role *</Text>
            <View style={styles.rolePickerRow}>
              {(['MANAGER', 'ADMIN', 'TRANSPORT_USER'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolePickBtn, role === r && styles.rolePickBtnActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.rolePickText, role === r && styles.rolePickTextActive]}>
                    {r === 'TRANSPORT_USER' ? 'Operator' : r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Username *</Text>
            <TextInput
              style={[styles.formInput, editingUser && { backgroundColor: '#f1f5f9', color: COLORS.textMuted }]}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. manager_ksp"
              autoCapitalize="none"
              editable={!editingUser}
            />

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.formInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ramesh Kumar"
            />

            {!editingUser && (
              <>
                <Text style={styles.inputLabel}>Initial Password (min 6 chars) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                />
              </>
            )}

            <Text style={styles.inputLabel}>Mobile Phone</Text>
            <TextInput
              style={styles.formInput}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="9876543210"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email (Optional)</Text>
            <TextInput
              style={styles.formInput}
              value={email}
              onChangeText={setEmail}
              placeholder="user@ksp.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {editingUser ? 'Save Changes' : 'Create Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={isResetModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsResetModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setIsResetModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Setting new password for {selectedUser?.name} (@{selectedUser?.username})
            </Text>

            <Text style={styles.inputLabel}>New Password *</Text>
            <TextInput
              style={styles.formInput}
              value={resetNewPassword}
              onChangeText={setResetNewPassword}
              placeholder="Enter new 6+ char password"
              secureTextEntry
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsResetModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleResetPassword}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return { backgroundColor: '#fef3c7', borderColor: '#fde68a' };
    case 'MANAGER':
      return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
    default:
      return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' };
  }
};

const getRoleBadgeTextStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return { color: '#b45309' };
    case 'MANAGER':
      return { color: '#1d4ed8' };
    default:
      return { color: '#475569' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchHeader: {
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
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
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
  userCard: {
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleWrap: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  userUsername: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
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
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#047857',
  },
  statusInactiveText: {
    color: '#b91c1c',
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    marginTop: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  rolePickBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rolePickBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rolePickText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  rolePickTextActive: {
    color: COLORS.white,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalSubmitText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
});
