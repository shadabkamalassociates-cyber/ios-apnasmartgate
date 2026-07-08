import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { NoticeStackParamList } from './types';
import NoticeScreen from '../screens/NoticeScreen';

const Stack = createNativeStackNavigator<NoticeStackParamList>();

export default function NoticeStack() {
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
      <Stack.Screen name="Notice" component={NoticeScreen} />
    </Stack.Navigator>
  );
}

