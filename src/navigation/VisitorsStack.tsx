import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { VisitorsStackParamList } from './types';
import VisitorsScreen from '../screens/VisitorsScreen';
import VisitorFormScreen from '../screens/VisitorFormScreen';

const Stack = createNativeStackNavigator<VisitorsStackParamList>();

export default function VisitorsStack() {
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
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="VisitorForm" component={VisitorFormScreen} />
    </Stack.Navigator>
  );
}
