/**
 * Environment config. Uses react-native-config for .env (BACKEND_URL).
 * Fallback for dev when Config is not yet available.
 */
import Config from 'react-native-config';

const BACKEND_URL =
  Config?.BACKEND_URL || 'https://society.kamalhousing.com/api';

/** Public Razorpay key only — never put RAZORPAY_KEY_SECRET in the mobile app. */
const RAZORPAY_KEY_ID =
  Config?.RAZORPAY_KEY_ID ||
  Config?.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  '';

export const ENV = {
  BACKEND_URL: BACKEND_URL.replace(/\/$/, ''), // no trailing slash
  RAZORPAY_KEY_ID: RAZORPAY_KEY_ID.trim(),
} as const;
