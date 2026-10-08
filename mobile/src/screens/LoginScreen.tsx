import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Truck, Eye, EyeOff, Lock, User as UserIcon, AlertCircle, Server, CheckCircle2, XCircle, Wifi } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getServerBaseUrl, setServerBaseUrl, checkServerHealth, CURRENT_WIFI_IP } from '../services/api';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Server settings modal state
  const [currentServerUrl, setCurrentServerUrl] = useState(getServerBaseUrl());
  const [showServerModal, setShowServerModal] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getServerBaseUrl());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    setCurrentServerUrl(getServerBaseUrl());
    setCustomServerUrl(getServerBaseUrl());
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      await login(username.trim(), password);
      navigation.replace('MainTabs');
    } catch (err: any) {
      const msg = err.message || 'Invalid username or password.';
      setError(
        msg.includes('Network') || msg.includes('server')
          ? `${msg}\nTap "API Settings" below if IP changed.`
          : msg
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (urlToTest?: string) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const target = urlToTest || customServerUrl;
      const res = await checkServerHealth(target);
      setTestResult({
        ok: res.ok,
        message: res.ok ? '✅ Server connected successfully!' : `❌ ${res.message || 'Cannot reach server'}`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: `❌ ${e.message || 'Failed to connect'}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = async (newUrl?: string) => {
    const url = newUrl || customServerUrl;
    const saved = await setServerBaseUrl(url);
    setCurrentServerUrl(saved);
    setCustomServerUrl(saved);
    setShowServerModal(false);
    setTestResult(null);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Truck size={40} color={COLORS.white} />
          </View>
          <Text style={styles.brandName}>KSP TRANSPORT</Text>
          <Text style={styles.brandTagline}>Mobile Driver & Operator Portal</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Use credentials created by your Administrator</Text>

          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrapper}>
              <UserIcon size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={COLORS.textLight} />
                ) : (
                  <Eye size={20} color={COLORS.textLight} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginBtnText}>LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Server Connection Badge */}
        <TouchableOpacity
          style={styles.serverStatusBtn}
          onPress={() => {
            setCustomServerUrl(getServerBaseUrl());
            setTestResult(null);
            setShowServerModal(true);
          }}
        >
          <Server size={14} color="#94a3b8" />
          <Text style={styles.serverStatusText} numberOfLines={1}>
            API: {currentServerUrl}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          KSP Transport Management System • Secure JWT Access
        </Text>
      </ScrollView>

      {/* Server Configuration Modal */}
      <Modal visible={showServerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Server size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Backend Server Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setShowServerModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Select connection mode or enter your computer's IP address:
            </Text>

            {/* Presets */}
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  customServerUrl.includes('localhost') && styles.presetBtnActive,
                ]}
                onPress={() => {
                  const url = 'http://localhost:5000/api';
                  setCustomServerUrl(url);
                  handleTestConnection(url);
                }}
              >
                <Server size={16} color={customServerUrl.includes('localhost') ? COLORS.white : COLORS.primary} />
                <Text
                  style={[
                    styles.presetText,
                    customServerUrl.includes('localhost') && styles.presetTextActive,
                  ]}
                >
                  USB Cable (localhost)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  customServerUrl.includes(CURRENT_WIFI_IP) && styles.presetBtnActive,
                ]}
                onPress={() => {
                  const url = `http://${CURRENT_WIFI_IP}:5000/api`;
                  setCustomServerUrl(url);
                  handleTestConnection(url);
                }}
              >
                <Wifi size={16} color={customServerUrl.includes(CURRENT_WIFI_IP) ? COLORS.white : COLORS.primary} />
                <Text
                  style={[
                    styles.presetText,
                    customServerUrl.includes(CURRENT_WIFI_IP) && styles.presetTextActive,
                  ]}
                >
                  Wi-Fi ({CURRENT_WIFI_IP})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Custom URL Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Server Base URL</Text>
              <TextInput
                style={styles.modalInput}
                value={customServerUrl}
                onChangeText={setCustomServerUrl}
                placeholder="http://10.180.228.146:5000/api"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Test Connection Button */}
            <TouchableOpacity
              style={styles.testBtn}
              onPress={() => handleTestConnection()}
              disabled={testingConnection}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.testBtnText}>Test Connection</Text>
              )}
            </TouchableOpacity>

            {/* Test Result Box */}
            {testResult && (
              <View
                style={[
                  styles.testResultBox,
                  testResult.ok ? styles.testResultSuccess : styles.testResultError,
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    testResult.ok ? styles.testResultTextSuccess : styles.testResultTextError,
                  ]}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSaveServerUrl()}
            >
              <Text style={styles.saveBtnText}>Save & Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1.2,
  },
  brandTagline: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.lg,
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
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingLeft: 44,
    paddingRight: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  loginBtn: {
    backgroundColor: COLORS.accent,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  serverStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.lg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.full,
    alignSelf: 'center',
  },
  serverStatusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  footerNote: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    marginTop: SPACING.sm,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalClose: {
    fontSize: 20,
    color: COLORS.textMuted,
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  presetRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: SPACING.md,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  presetBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presetTextActive: {
    color: COLORS.white,
  },
  modalInput: {
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  testBtn: {
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  testBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  testResultBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  testResultSuccess: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  testResultError: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testResultTextSuccess: {
    color: '#15803d',
  },
  testResultTextError: {
    color: '#b91c1c',
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
