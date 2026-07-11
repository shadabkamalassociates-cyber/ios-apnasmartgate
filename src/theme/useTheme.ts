import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { lightColors, darkColors, type ThemeColors } from './colors';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);
  return { colors, isDark };
}
