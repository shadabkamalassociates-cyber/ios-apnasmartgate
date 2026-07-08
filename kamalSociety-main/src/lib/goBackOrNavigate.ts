type StackNavigation = {
  goBack: () => void;
  canGoBack?: () => boolean;
  navigate: (name: string, params?: object) => void;
};

export function goBackOrNavigate(
  navigation: StackNavigation,
  fallbackRoute: string,
  fallbackParams?: object,
) {
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation.navigate(fallbackRoute, fallbackParams);
}
