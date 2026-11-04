import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
  Pressable,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Truck, Eye, EyeOff, Lock, User as UserIcon, AlertCircle, Server, Wifi } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getServerBaseUrl, setServerBaseUrl, checkServerHealth, discoverWorkingBaseUrl, CURRENT_WIFI_IP } from '../services/api';

const loginBg = require('../../assets/transport_bg_day.jpg');

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUserFocused, setIsUserFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);

  // Server settings modal state
  const [showServerModal, setShowServerModal] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getServerBaseUrl());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // ── Animation Values ──────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.25)).current;
  const brandTranslateY = useRef(new Animated.Value(-24)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;

  const cardTranslateY = useRef(new Animated.Value(45)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const inputUserAnim = useRef(new Animated.Value(20)).current;
  const inputUserOpacity = useRef(new Animated.Value(0)).current;
  const inputPassAnim = useRef(new Animated.Value(20)).current;
  const inputPassOpacity = useRef(new Animated.Value(0)).current;

  const btnScale = useRef(new Animated.Value(1)).current;
  const btnTranslateY = useRef(new Animated.Value(20)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  const { login } = useAuth();

  useEffect(() => {
    setCustomServerUrl(getServerBaseUrl());
    discoverWorkingBaseUrl().then((url) => {
      if (url) setCustomServerUrl(url);
    }).catch(() => {});

    // ── Initial Entry Sequence ──
    Animated.parallel([
      // Logo spring in
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      // Brand text glide down
      Animated.timing(brandTranslateY, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Card glide up
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Staggered inputs & button
      Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(inputUserAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(inputUserOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(inputPassAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(inputPassOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(btnTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // ── Continuous Floating & Ambient Glow Breathing ──
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -5,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 5,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.25,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.35,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    glowLoop.start();

    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, []);

  // ── Shake animation on error ──
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.95,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

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
      setError(err.message || 'Invalid username or password.');
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
    setCustomServerUrl(saved);
    setShowServerModal(false);
    setTestResult(null);
    setError('');
  };

  return (
    <ImageBackground source={loginBg} style={styles.bg} resizeMode="cover">
      <StatusBar style="light" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: cardOpacity,
                  transform: [
                    { translateY: cardTranslateY },
                    { translateX: shakeAnim },
                  ],
                },
              ]}
            >
              <View style={styles.cardAccent} />

              <View style={styles.brandContainer}>
                <View style={styles.logoAnchor}>
                  <Animated.View
                    style={[
                      styles.logoGlowRing,
                      {
                        transform: [{ scale: glowScale }],
                        opacity: glowOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.logoBadge,
                      {
                        transform: [
                          { scale: logoScale },
                          { translateY: logoFloat },
                        ],
                      },
                    ]}
                  >
                    <Pressable
                      onLongPress={() => {
                        setCustomServerUrl(getServerBaseUrl());
                        setTestResult(null);
                        setShowServerModal(true);
                      }}
                    >
                      <Truck size={30} color={COLORS.white} />
                    </Pressable>
                  </Animated.View>
                </View>

                <Animated.View
                  style={{
                    alignItems: 'center',
                    transform: [{ translateY: brandTranslateY }],
                    opacity: brandOpacity,
                  }}
                >
                  <Text style={styles.brandName}>KSP TRANSPORT</Text>
                  <Text style={styles.brandTagline}>Fleet Operations Portal</Text>
                </Animated.View>
              </View>

              <Text style={styles.cardTitle}>Sign In</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={18} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

          {/* Username Input with Animation & Focus Glow */}
          <Animated.View
            style={[
              styles.inputGroup,
              {
                opacity: inputUserOpacity,
                transform: [{ translateY: inputUserAnim }],
              },
            ]}
          >
            <Text style={styles.label}>Username</Text>
            <View
              style={[
                styles.inputWrapper,
                isUserFocused && styles.inputWrapperFocused,
              ]}
            >
              <UserIcon
                size={20}
                color={isUserFocused ? COLORS.accent : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setIsUserFocused(true)}
                onBlur={() => setIsUserFocused(false)}
              />
            </View>
          </Animated.View>

          {/* Password Input with Animation & Focus Glow */}
          <Animated.View
            style={[
              styles.inputGroup,
              {
                opacity: inputPassOpacity,
                transform: [{ translateY: inputPassAnim }],
              },
            ]}
          >
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                isPassFocused && styles.inputWrapperFocused,
              ]}
            >
              <Lock
                size={20}
                color={isPassFocused ? COLORS.accent : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setIsPassFocused(true)}
                onBlur={() => setIsPassFocused(false)}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={isPassFocused ? COLORS.accent : COLORS.textLight} />
                ) : (
                  <Eye size={20} color={isPassFocused ? COLORS.accent : COLORS.textLight} />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Animated Submit Button with Spring Scale Touch */}
          <Animated.View
            style={{
              opacity: btnOpacity,
              transform: [
                { translateY: btnTranslateY },
                { scale: btnScale },
              ],
            }}
          >
            <Pressable
              style={[styles.loginBtn, isLoading && { opacity: 0.75 }]}
              onPress={handleLogin}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={COLORS.white} />
                  <Text style={styles.loginBtnText}>AUTHENTICATING...</Text>
                </View>
              ) : (
                <Text style={styles.loginBtnText}>SECURE SIGN IN</Text>
              )}
            </Pressable>
          </Animated.View>
            </Animated.View>
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
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
    height: 72,
    width: 72,
  },
  logoGlowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.indigo,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.indigo,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.accent,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
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
  inputWrapperFocused: {
    borderRadius: RADIUS.md,
    borderColor: COLORS.accent,
    backgroundColor: '#ffffff',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  loginBtn: {
    backgroundColor: COLORS.accent,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
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
