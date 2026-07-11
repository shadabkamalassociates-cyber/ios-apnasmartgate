import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { ComplaintsStackParamList } from './types';
import ComplaintsScreen from '../screens/ComplaintsScreen';
import ComplaintFormScreen from '../screens/ComplaintFormScreen';

const Stack = createNativeStackNavigator<ComplaintsStackParamList>();

export default function ComplaintsStack() {
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
      <Stack.Screen name="Complaints" component={ComplaintsScreen} />
      <Stack.Screen name="ComplaintForm" component={ComplaintFormScreen} />
    </Stack.Navigator>
  );
}
