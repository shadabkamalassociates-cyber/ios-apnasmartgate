/**
 * Cosmic orange theme. App adapts to system light/dark (useColorScheme).
 */
export const cosmicOrange = {
  primary: '#E85D04',
  primaryLight: '#F48C06',
  primaryDark: '#DC2F02',
  accent: '#FFBA08',
} as const;

export const lightColors = {
  ...cosmicOrange,
  background: '#FFFBF7',
  maincontainerbackground: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#FFF3E8',
  text: '#1A1A1A',
  textSecondary: '#5C5C5C',
  border: '#E8E0D8',
  error: '#B91C1C',
  success: '#15803D',
} as const;

export const darkColors = {
  ...cosmicOrange,
  background: '#1A1512',
  maincontainerbackground: '#1A1512',
  
  
  
  
  
  
  
  surface: '#2A2420',
  surfaceVariant: '#3D352E',
  text: '#F5F0EB',
  textSecondary: '#B8AFA6',
  border: '#4A423B',
  error: '#F87171',
  success: '#4ADE80',
} as const;

export type ThemeColors = {
  readonly [K in keyof typeof lightColors]: string;
};
