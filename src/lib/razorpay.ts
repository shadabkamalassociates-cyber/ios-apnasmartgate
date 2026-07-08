import RazorpayCheckout from 'react-native-razorpay';
import { ENV } from '../config/env';
import { RAZORPAY_LOGO_DATA_URI } from './razorpayLogo';

/** Shown on the Razorpay checkout header. */
export const RAZORPAY_MERCHANT_NAME = 'Apna Smart Gate';

/** Razorpay expects amounts in paise (₹1 = 100 paise). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency?: string;
  receipt?: string;
};

export type OpenRazorpayCheckoutParams = {
  order: RazorpayOrder;
  /** Service/booking price in INR (rupees); used to fix server amount in rupees vs paise. */
  expectedAmountRupees?: number | null;
  description?: string;
  merchantName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export type RazorpayCheckoutResult =
  | {
      success: true;
      paymentId: string;
      orderId: string;
      signature: string;
    }
  | {
      success: false;
      cancelled?: boolean;
      error: string;
      code?: string;
    };

/**
 * Checkout amount in paise: prefer Razorpay order from server; align with service price in rupees.
 */
export function resolveCheckoutAmountPaise(
  orderAmountFromServer: number,
  servicePriceRupees: number,
): number {
  const order = Math.round(Number(orderAmountFromServer));
  const fromService = rupeesToPaise(servicePriceRupees);
  if (!Number.isFinite(order) || order <= 0) return fromService;
  if (order === fromService) return order;
  if (order === Math.round(servicePriceRupees)) return fromService;
  return order;
}

function extractRazorpayErrorReason(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as {
    reason?: string;
    description?: string;
    message?: string;
    error?: { reason?: string };
  };

  if (e.error?.reason) return e.error.reason;
  if (e.reason) return e.reason;

  const raw = e.description || e.message || '';
  if (typeof raw !== 'string' || !raw.trim()) return null;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: { reason?: string }; reason?: string };
      if (parsed.error?.reason) return parsed.error.reason;
      if (parsed.reason) return parsed.reason;
    } catch {
      /* not JSON */
    }
  }

  const lower = raw.toLowerCase();
  if (lower.includes('payment_cancelled') || lower.includes('cancelled the payment')) {
    return 'payment_cancelled';
  }

  return null;
}

function userFriendlyPaymentError(error: unknown): string {
  const reason = extractRazorpayErrorReason(error);
  if (reason === 'payment_cancelled') {
    return 'Payment was cancelled.';
  }

  const e = error as { description?: string; message?: string; code?: string | number };
  const raw = e.description || e.message || '';
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { description?: string };
        description?: string;
      };
      const inner = parsed.error?.description || parsed.description;
      if (inner?.trim()) return inner.trim();
    } catch {
      /* fall through */
    }
  }

  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (e.code === 'NETWORK_ERROR') {
    return 'Network error. Check your connection and try again.';
  }
  return 'Payment could not be completed. Please try again.';
}

function isPaymentCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string | number; description?: string; message?: string };

  if (extractRazorpayErrorReason(error) === 'payment_cancelled') {
    return true;
  }

  const text = `${e.description || ''} ${e.message || ''}`.toLowerCase();
  return (
    e.code === 'PAYMENT_CANCELLED' ||
    e.code === 0 ||
    e.code === '0' ||
    e.description === 'Payment Cancelled' ||
    text.includes('cancelled the payment') ||
    text.includes('you may have cancelled')
  );
}

/**
 * Opens native Razorpay checkout for a server-created order.
 */
export async function openRazorpayCheckout(
  params: OpenRazorpayCheckoutParams,
): Promise<RazorpayCheckoutResult> {
  const key = ENV.RAZORPAY_KEY_ID;
  if (!key) {
    return {
      success: false,
      error:
        'Razorpay is not configured. Add RAZORPAY_KEY_ID to .env and rebuild the app.',
    };
  }

  if (!params.order?.id) {
    return { success: false, error: 'Invalid payment order.' };
  }

  const serviceRupees = params.expectedAmountRupees ?? 0;
  const amountPaise = resolveCheckoutAmountPaise(params.order.amount, serviceRupees);

  try {
    const data = await RazorpayCheckout.open({
      description: params.description || 'Service booking payment',
      currency: params.order.currency || 'INR',
      key,
      amount: amountPaise,
      order_id: params.order.id,
      image: RAZORPAY_LOGO_DATA_URI,
      name: params.merchantName?.trim() || RAZORPAY_MERCHANT_NAME,
      prefill: {
        name: params.customerName || '',
        email: params.customerEmail || '',
        contact: params.customerPhone || '',
      },
      theme: { color: '#2563eb' },
    });

    return {
      success: true,
      paymentId: data.razorpay_payment_id,
      orderId: data.razorpay_order_id || params.order.id,
      signature: data.razorpay_signature,
    };
  } catch (error: unknown) {
    if (isPaymentCancelled(error)) {
      return { success: false, cancelled: true, error: 'Payment was cancelled.' };
    }

    const e = error as { code?: string; description?: string; message?: string };
    let message = userFriendlyPaymentError(error);
    if (e.code === 'BAD_REQUEST_ERROR' && !message.toLowerCase().includes('cancel')) {
      message = 'Payment could not be completed. Please try again.';
    }

    return { success: false, error: message, code: e.code };
  }
}
