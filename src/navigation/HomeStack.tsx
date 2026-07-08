import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { HomeStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import SOSFormScreen from '../screens/SOSFormScreen';
import VendorsByCategoryScreen from '../screens/VendorsByCategoryScreen';
import ServiceDetailsScreen from '../screens/ServiceDetailsScreen';
import EventsScreen from '../screens/EventsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.maincontainerbackground },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.maincontainerbackground, paddingBottom: 0 },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="SOSForm" component={SOSFormScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="Invoices" component={InvoicesScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen
        name="VendorsByCategory"
        component={VendorsByCategoryScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
    </Stack.Navigator>
  );
}
