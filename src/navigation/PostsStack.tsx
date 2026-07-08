import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { PostsStackParamList } from './types';
import PostsScreen from '../screens/PostsScreen';
import PostFormScreen from '../screens/PostFormScreen';

const Stack = createNativeStackNavigator<PostsStackParamList>();

export default function PostsStack() {
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
      <Stack.Screen name="Posts" component={PostsScreen} />
      <Stack.Screen name="PostForm" component={PostFormScreen} />
    </Stack.Navigator>
  );
}
