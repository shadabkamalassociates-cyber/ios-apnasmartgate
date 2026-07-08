export type VendorCategoryKey =
  | 'home_maintenance'
  | 'cleaning_services'
  | 'security_services'
  | 'utility_services'
  | 'home_improvement'
  | 'gardening_services'
  | 'logistics_moving'
  | 'events_catering'
  | 'health_wellness'
  | 'daily_essentials';

export const VENDOR_CATEGORIES: { key: VendorCategoryKey; label: string }[] = [
  { key: 'home_maintenance', label: 'Home maintenance' },
  { key: 'cleaning_services', label: 'Cleaning services' },
  { key: 'security_services', label: 'Security services' },
  { key: 'utility_services', label: 'Utility services' },
  { key: 'home_improvement', label: 'Home improvement' },
  { key: 'gardening_services', label: 'Gardening services' },
  { key: 'logistics_moving', label: 'Logistics & moving' },
  { key: 'events_catering', label: 'Events & catering' },
  { key: 'health_wellness', label: 'Health & wellness' },
  { key: 'daily_essentials', label: 'Daily essentials' },
];

