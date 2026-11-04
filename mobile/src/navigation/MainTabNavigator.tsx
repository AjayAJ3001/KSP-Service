import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Navigation, BookOpen, User, ShieldCheck } from 'lucide-react-native';

import { HomeScreen } from '../screens/HomeScreen';
import { TripHistoryScreen } from '../screens/TripHistoryScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { useAuth } from '../context/AuthContext';
import { MainTabParamList } from '../types';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <Tab.Navigator
      initialRouteName={isAdmin ? 'Admin' : 'Home'}
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.indigo,
          elevation: 8,
          shadowColor: COLORS.indigo,
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: '#c7d2fe',
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 16,
          shadowColor: COLORS.indigo,
          shadowOpacity: 0.18,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: COLORS.indigo,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarActiveBackgroundColor: '#eef2ff',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      {/* For Admin: Admin Dashboard is the primary landing tab, Home is completely removed.
          For Non-Admin: Home Screen is the primary landing tab. */}
      {isAdmin ? (
        <Tab.Screen
          name="Admin"
          component={AdminDashboardScreen}
          options={{
            title: 'Admin',
            headerTitle: user?.role === 'OWNER' ? 'Owner Control Center' : 'Admin Control Center',
            tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />,
          }}
        />
      ) : (
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            headerTitle: 'KSP Transport',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
      )}

      <Tab.Screen
        name="Trips"
        component={TripHistoryScreen}
        options={{
          title: 'Trips',
          headerTitle: 'Trip Dispatch History',
          tabBarIcon: ({ color, size }) => <Navigation color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Ledger"
        component={LedgerScreen}
        options={{
          title: 'Ledger',
          headerTitle: 'Party Account Ledger',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: isAdmin ? 'Admin Profile' : 'My Operator Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

