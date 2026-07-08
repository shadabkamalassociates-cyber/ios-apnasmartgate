import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Navigate to a bottom-tab screen from a nested stack navigator. */
export function navigateToTab(
  navigation: NavigationProp<ParamListBase>,
  tabName: string,
  params?: object
) {
  const tabNav = navigation.getParent();
  if (tabNav) {
    tabNav.navigate(tabName as never, params as never);
    return;
  }
  navigation.navigate(tabName as never, params as never);
}
