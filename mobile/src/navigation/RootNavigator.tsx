import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { NewTripScreen } from '../screens/NewTripScreen';
import { PartyPaymentScreen } from '../screens/PartyPaymentScreen';
import { DriverExpensesScreen } from '../screens/DriverExpensesScreen';
import { SettlementReceiptScreen } from '../screens/SettlementReceiptScreen';
import { GiveTruckAdvanceScreen } from '../screens/GiveTruckAdvanceScreen';

// Admin Screens
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminReportsScreen } from '../screens/admin/AdminReportsScreen';
import { AdminAuditLogsScreen } from '../screens/admin/AdminAuditLogsScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminVehiclesScreen } from '../screens/admin/AdminVehiclesScreen';
import { AdminDriversScreen } from '../screens/admin/AdminDriversScreen';
import { AdminPartiesScreen } from '../screens/admin/AdminPartiesScreen';
import { AdminMastersScreen } from '../screens/admin/AdminMastersScreen';
import { AdminTripsScreen } from '../screens/admin/AdminTripsScreen';
import { AdminPaymentsScreen } from '../screens/admin/AdminPaymentsScreen';
import { AdminSettlementsScreen } from '../screens/admin/AdminSettlementsScreen';
import { AdminOwnerAdvancesScreen } from '../screens/admin/AdminOwnerAdvancesScreen';
import { AdminManagerLedgerScreen } from '../screens/admin/AdminManagerLedgerScreen';
import { AdminTruckAdvancesScreen } from '../screens/admin/AdminTruckAdvancesScreen';
import { AdminDriverBalanceMasterScreen } from '../screens/admin/AdminDriverBalanceMasterScreen';

import { RootStackParamList } from '../types';
import { COLORS } from '../constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewTrip"
        component={NewTripScreen}
        options={{ title: 'New Trip Entry' }}
      />
      <Stack.Screen
        name="GiveTruckAdvance"
        component={GiveTruckAdvanceScreen}
        options={{ title: 'Give Truck Advance' }}
      />
      <Stack.Screen
        name="PartyPayment"
        component={PartyPaymentScreen}
        options={{ title: 'Payment Details' }}
      />
      <Stack.Screen
        name="DriverExpenses"
        component={DriverExpensesScreen}
        options={{ title: 'Driver Expenses' }}
      />
      <Stack.Screen
        name="SettlementReceipt"
        component={SettlementReceiptScreen}
        options={{ title: 'Settlement Slip' }}
      />

      {/* Admin Panel Screens */}
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Admin Control Center' }}
      />
      <Stack.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{ title: 'Reports & Analytics' }}
      />
      <Stack.Screen
        name="AdminAuditLogs"
        component={AdminAuditLogsScreen}
        options={{ title: 'Audit Activity Logs' }}
      />
      <Stack.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ title: 'User Accounts' }}
      />
      <Stack.Screen
        name="AdminVehicles"
        component={AdminVehiclesScreen}
        options={{ title: 'Fleet Lorries Master' }}
      />
      <Stack.Screen
        name="AdminDrivers"
        component={AdminDriversScreen}
        options={{ title: 'Drivers Master' }}
      />
      <Stack.Screen
        name="AdminParties"
        component={AdminPartiesScreen}
        options={{ title: 'Parties Master' }}
      />
      <Stack.Screen
        name="AdminMasters"
        component={AdminMastersScreen}
        options={{ title: 'Master Settings' }}
      />
      <Stack.Screen
        name="AdminTrips"
        component={AdminTripsScreen}
        options={{ title: 'Trips Operations' }}
      />
      <Stack.Screen
        name="AdminPayments"
        component={AdminPaymentsScreen}
        options={{ title: 'Party Payments' }}
      />
      <Stack.Screen
        name="AdminSettlements"
        component={AdminSettlementsScreen}
        options={{ title: 'Settlements Master' }}
      />
      <Stack.Screen
        name="AdminOwnerAdvances"
        component={AdminOwnerAdvancesScreen}
        options={{ title: 'Owner Advances' }}
      />
      <Stack.Screen
        name="AdminManagerLedger"
        component={AdminManagerLedgerScreen}
        options={{ title: 'Manager Advances' }}
      />
      <Stack.Screen
        name="AdminTruckAdvances"
        component={AdminTruckAdvancesScreen}
        options={{ title: 'Truck Advances Master' }}
      />
      <Stack.Screen
        name="AdminDriverAdvances"
        component={AdminDriverBalanceMasterScreen}
        options={{ title: 'Driver Balance Master' }}
      />
      <Stack.Screen
        name="AdminDriverBalanceMaster"
        component={AdminDriverBalanceMasterScreen}
        options={{ title: 'Driver Balance Master' }}
      />
    </Stack.Navigator>
  );
};

