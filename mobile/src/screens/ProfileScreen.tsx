import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { User, Key, LogOut, Shield, Phone, Mail, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { mobileAuthService } from '../services/mobileService';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      setError('Please enter your current and new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await mobileAuthService.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>

        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileUsername}>@{user?.username}</Text>

        <View style={styles.roleBadge}>
          <Shield size={14} color={COLORS.accent} />
          <Text style={styles.roleBadgeText}>{user?.role}</Text>
        </View>

        <View style={styles.infoList}>
          {user?.mobile_number ? (
            <View style={styles.infoRow}>
              <Phone size={16} color={COLORS.textLight} />
              <Text style={styles.infoText}>{user.mobile_number}</Text>
            </View>
          ) : null}
          {user?.email ? (
            <View style={styles.infoRow}>
              <Mail size={16} color={COLORS.textLight} />
              <Text style={styles.infoText}>{user.email}</Text>
            </View>
          ) : null}
          {user?.driver_name ? (
            <View style={styles.infoRow}>
              <User size={16} color={COLORS.textLight} />
              <Text style={styles.infoText}>Driver: {user.driver_name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Change Password Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={16} color={COLORS.successDark} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Current Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>New Password * (Min 6 characters)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Confirm New Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.updateBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handlePasswordChange}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Key size={18} color={COLORS.white} />
              <Text style={styles.updateBtnText}>UPDATE PASSWORD</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={20} color={COLORS.danger} />
        <Text style={styles.logoutBtnText}>LOGOUT</Text>
      </TouchableOpacity>
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
  profileCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  profileUsername: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
    marginTop: SPACING.sm,
  },
  roleBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  infoList: {
    width: '100%',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 13,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 13,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
  },
  successText: {
    color: COLORS.successDark,
    fontSize: 13,
    flex: 1,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  updateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  updateBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
