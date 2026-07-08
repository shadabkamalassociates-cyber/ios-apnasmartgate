import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { ProfileStackParamList } from './types';
import ProfileScreen from '../screens/ProfileScreen';
import MaidsScreen from '../screens/MaidsScreen';
import MaidDetailsScreen from '../screens/MaidDetailsScreen';
import ChatInboxScreen from '../screens/ChatInboxScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
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
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Maids" component={MaidsScreen} />
      <Stack.Screen name="MaidDetails" component={MaidDetailsScreen} />
      <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
