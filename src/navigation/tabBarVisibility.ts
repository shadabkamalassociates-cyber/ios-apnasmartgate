import type { RouteProp, ParamListBase } from '@react-navigation/native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

/**
 * Initial (root) screen for each bottom-tab stack. Any other focused route hides the tab bar.
 */
export const TAB_STACK_ROOT_SCREENS = {
  HomeTab: 'Home',
  ComplaintsTab: 'Complaints',
  VisitorsTab: 'Visitors',
  PostsTab: 'Posts',
  NoticeTab: 'Notice',
  ProfileTab: 'Profile',
} as const;

export type TabStackName = keyof typeof TAB_STACK_ROOT_SCREENS;

/** True when the user is on a nested screen inside a tab stack (not the tab's main screen). */
export function shouldHideTabBarOnNestedScreen(tabName: TabStackName, route: RouteProp<ParamListBase>): boolean {
  const root = TAB_STACK_ROOT_SCREENS[tabName];
  const focused = getFocusedRouteNameFromRoute(route);
  // `undefined` means the stack's initial route (root) is focused.
  if (focused == null) return false;
  return focused !== root;
}

export function tabBarStyleForTabRoute(
  tabName: TabStackName,
  route: RouteProp<ParamListBase>,
  visibleStyle: object,
): object {
  return shouldHideTabBarOnNestedScreen(tabName, route) ? { display: 'none' as const } : visibleStyle;
}
