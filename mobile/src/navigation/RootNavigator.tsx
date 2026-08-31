import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { NewTripScreen } from '../screens/NewTripScreen';
import { PartyPaymentScreen } from '../screens/PartyPaymentScreen';
import { DriverExpensesScreen } from '../screens/DriverExpensesScreen';
import { SettlementReceiptScreen } from '../screens/SettlementReceiptScreen';
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
        name="PartyPayment"
        component={PartyPaymentScreen}
        options={{ title: 'Party Payment' }}
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
    </Stack.Navigator>
  );
};
