import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Truck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

export const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Login');
      }
    }
  }, [isLoading, isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Truck size={48} color={COLORS.white} />
      </View>
      <Text style={styles.title}>KSP TRANSPORT</Text>
      <Text style={styles.subtitle}>Fleet & Logistics Management</Text>
      <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: SPACING.xl }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
});
