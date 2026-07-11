import api from './client';

/** Matches smart-society `POST /api/booking-vendors/booking-service` */
export type BookVendorServicePayload = {
  user_id: string | number;
  vendor_id: string | number;
  service_id: string | number;
  /** Date string, e.g. YYYY-MM-DD */
  booking_date: string;
  /** Time string, e.g. 10:00 or 10:00:00 */
  booking_time: string;
  /** Service price in INR (rupees), from vendor service charges. */
  amount: number;
  address?: string | null;
};

export type VendorBookingRecord = {
  id?: string | number;
  user_id?: string | number;
  vendor_id?: string | number;
  service_id?: string | number;
  status?: string;
  amount?: number | string;
  [key: string]: unknown;
};

export type BookVendorServiceResponse = {
  message?: string;
  booking?: VendorBookingRecord;
  payment?: Record<string, unknown>;
};

export async function bookVendorService(payload: BookVendorServicePayload) {
  const res = await api.post<BookVendorServiceResponse>(
    '/booking-vendors/booking-service',
    payload,
  );
  return res.data;
}

export function getBookingIdFromResponse(
  data: BookVendorServiceResponse,
): string | number | null {
  const booking = data?.booking;
  if (booking?.id != null) return booking.id;
  const payment = data?.payment as { booking_id?: string | number } | undefined;
  if (payment?.booking_id != null) return payment.booking_id;
  return null;
}

/** Matches `POST /api/booking-vendors/create-payment-order` */
export type CreatePaymentOrderResponse = {
  message?: string;
  order?: {
    id: string;
    amount: number;
    currency?: string;
    receipt?: string;
  };
};

export async function createPaymentOrder(
  bookingId: string | number,
  /** Vendor service price in rupees — backend should create Razorpay order in paise. */
  amountRupees?: number,
) {
  const body: Record<string, unknown> = { booking_id: bookingId };
  if (amountRupees != null && amountRupees > 0) {
    body.amount = amountRupees;
    body.amount_paise = Math.round(amountRupees * 100);
  }
  const res = await api.post<CreatePaymentOrderResponse>(
    '/booking-vendors/create-payment-order',
    body,
  );
  return res.data;
}

/** Matches bookingVendors `verifyPayment` controller body */
export type VerifyVendorPaymentPayload = {
  booking_id: string | number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type VerifyVendorPaymentResponse = {
  success?: boolean;
  message?: string;
};

export async function verifyVendorPayment(payload: VerifyVendorPaymentPayload) {
  const res = await api.post<VerifyVendorPaymentResponse>(
    '/booking-vendors/verify-payment',
    payload,
  );
  return res.data;
}

export type ResidentBooking = {
  id: string | number;
  user_id?: string | number;
  vendor_id?: string | number;
  service_id?: string | number;
  booking_date?: string | null;
  booking_time?: string | null;
  address?: string | null;
  status?: string | null;
  created_at?: string | null;
  name?: string | null;
  price?: string | number | null;
};

/**
 * Matches smart-society `GET /api/booking-vendors/fetch-residents-bookings/:id`
 *
 * Some backends return the array directly, others return `{ data: [...] }`.
 * This helper is tolerant to both.
 */
export async function fetchResidentsBookings(residentId: string | number) {
  const res = await api.get<unknown>(
    `/booking-vendors/fetch-residents-bookings/${encodeURIComponent(String(residentId))}`,
  );

  const data = res.data as any;
  if (Array.isArray(data)) return data as ResidentBooking[];

  if (data && Array.isArray(data.data)) return data.data as ResidentBooking[];
  if (data && Array.isArray(data.bookings)) return data.bookings as ResidentBooking[];

  return [] as ResidentBooking[];
}
