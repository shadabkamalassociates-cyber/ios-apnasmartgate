import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeStack from './HomeStack';
import ComplaintsStack from './ComplaintsStack';
import VisitorsStack from './VisitorsStack';
import PostsStack from './PostsStack';
import NoticeStack from './NoticeStack';
import ProfileStack from './ProfileStack';
import { tabBarStyleForTabRoute, type TabStackName } from './tabBarVisibility';

const Tab = createBottomTabNavigator();

function getTabConfig(routeName: string) {
  switch (routeName) {
    case 'HomeTab':
      return { label: 'Home', icon: 'home-outline', iconFocused: 'home' };
    case 'ComplaintsTab':
      return { label: 'Complaints', icon: 'megaphone-outline', iconFocused: 'megaphone' };
    case 'VisitorsTab':
      return { label: 'Visitors', icon: 'people-outline', iconFocused: 'people' };
    case 'PostsTab':
      return { label: 'Posts', icon: 'newspaper-outline', iconFocused: 'newspaper' };
    case 'NoticeTab':
      return { label: 'Notice', icon: 'notifications-outline', iconFocused: 'notifications' };
    case 'ProfileTab':
      return { label: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' };
    default:
      return { label: routeName, icon: 'ellipse-outline', iconFocused: 'ellipse' };
  }
}

function nestedAwareTabOptions(tabName: TabStackName, title: string, tabBarStyle: object) {
  return ({ route }: { route: Parameters<typeof tabBarStyleForTabRoute>[1] }) => ({
    title,
    tabBarStyle: tabBarStyleForTabRoute(tabName, route, tabBarStyle),
  });
}

export default function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    height: 52 + insets.bottom,
    paddingTop: 0,
    paddingBottom: insets.bottom || 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const { label, icon, iconFocused } = getTabConfig(route.name);

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabel: label,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
          tabBarPressColor: 'transparent',
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as React.ComponentProps<typeof TouchableOpacity>)}
              activeOpacity={0.7}
              style={[props.style, { justifyContent: 'center', alignItems: 'center' }]}
            />
          ),
          tabBarHideOnKeyboard: true,
          tabBarStyle,
          tabBarItemStyle: {
            paddingVertical: 2,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={focused && iconFocused ? iconFocused : icon}
                  size={22}
                  color={focused ? colors.primary : color ?? colors.textSecondary}
                />
              </View>
            </View>
          ),
        };
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={nestedAwareTabOptions('HomeTab', 'Home', tabBarStyle)} />
      <Tab.Screen
        name="ComplaintsTab"
        component={ComplaintsStack}
        options={nestedAwareTabOptions('ComplaintsTab', 'Complaints', tabBarStyle)}
      />
      <Tab.Screen
        name="VisitorsTab"
        component={VisitorsStack}
        options={nestedAwareTabOptions('VisitorsTab', 'Visitors', tabBarStyle)}
      />
      <Tab.Screen name="PostsTab" component={PostsStack} options={nestedAwareTabOptions('PostsTab', 'Posts', tabBarStyle)} />
      <Tab.Screen
        name="NoticeTab"
        component={NoticeStack}
        options={({ route }) => ({
          ...nestedAwareTabOptions('NoticeTab', 'Notice', tabBarStyle)({ route }),
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={nestedAwareTabOptions('ProfileTab', 'Profile', tabBarStyle)}
      />
    </Tab.Navigator>
  );
}
