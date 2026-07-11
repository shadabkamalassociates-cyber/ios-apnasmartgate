import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import ApproveDenyScreen from '../screens/ApproveDenyScreen';
import NotificationCheckScreen from '../screens/NotificationCheckScreen';
import CreateTicketScreen from '../screens/CreateTicketScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ApproveDeny"
            component={ApproveDenyScreen}
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen name="NotificationCheck" component={NotificationCheckScreen} />
          <Stack.Screen
            name="CreateTicket"
            component={CreateTicketScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
