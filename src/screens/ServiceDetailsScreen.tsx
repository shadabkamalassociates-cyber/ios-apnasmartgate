import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AxiosError } from 'axios';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  bookVendorService,
  createPaymentOrder,
  getBookingIdFromResponse,
  verifyVendorPayment,
} from '../api/bookingVendors';
import { openRazorpayCheckout } from '../lib/razorpay';
import * as chatApi from '../api/chat';
import * as blockApi from '../api/block';
import * as flatApi from '../api/flat';
import * as societyApi from '../api/society';
import { fetchServiceById, type VendorServiceDetail } from '../api/vendorServices';
import { fetchVendorById, type VendorDetail } from '../api/vendors';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';
import { resolveImageUri } from '../lib/postImages';
import { useTheme } from '../theme';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

type Props = {
  navigation: { goBack: () => void; navigate: (name: string, params?: object) => void; canGoBack?: () => boolean };
  route: { params: { serviceId: string; title?: string } };
};

function formatPrice(price: unknown) {
  if (price == null) return null;
  const raw = String(price).trim();
  if (!raw) return null;
  const normalized = raw.endsWith('.00') ? raw.slice(0, -3) : raw;
  return `₹${normalized}`;
}

function formatDateTime(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatLabel(key: string) {
  return key.replace(/_/g, ' ');
}

function normalizeValue(value: unknown) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

/** Prefer today 10:00 while that moment is still ≥ now; otherwise the next whole minute after `now`. */
function defaultBookingDateTimeFrom(now: Date) {
  const d = new Date(now);
  d.setMilliseconds(0);
  const ten = new Date(d);
  ten.setHours(10, 0, 0, 0);
  ten.setSeconds(0, 0);
  if (d.getTime() <= ten.getTime()) return new Date(ten);
  const bumped = new Date(d);
  bumped.setSeconds(0, 0);
  bumped.setMinutes(bumped.getMinutes() + 1, 0, 0);
  return bumped;
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampBookingAtOrAfterNow(d: Date, now: Date) {
  return d.getTime() < now.getTime() ? new Date(now) : d;
}

function mergeDateTime(base: Date, picked: Date, part: 'date' | 'time') {
  const next = new Date(base);
  if (part === 'date') {
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  } else {
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  }
  return next;
}

function formatBookingDateLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBookingTimeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function dateToBookingApi(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return {
    booking_date: `${y}-${m}-${day}`,
    booking_time: `${h}:${min}:00`,
  };
}

const BOOKING_FIELD_LABELS: Record<string, string> = {
  user_id: 'User',
  vendor_id: 'Vendor',
  service_id: 'Service',
  booking_date: 'Date',
  booking_time: 'Time',
  amount: 'Service price',
  address: 'Address',
};

function parseServiceAmount(price: unknown): number | null {
  if (price == null) return null;
  const raw = String(price).replace(/[^\d.]/g, '').trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Vendor service charge in rupees (dynamic per service). */
function parseServiceAmountFromDetail(detail: VendorServiceDetail | null): number | null {
  if (!detail) return null;
  const candidates = [
    detail.price,
    (detail as { service_price?: unknown }).service_price,
    (detail as { charges?: unknown }).charges,
    (detail as { amount?: unknown }).amount,
  ];
  for (const value of candidates) {
    const parsed = parseServiceAmount(value);
    if (parsed != null) return parsed;
  }
  return null;
}

type BookingPayloadCheck = {
  user_id?: string | number | null;
  vendor_id?: string | number | null;
  service_id?: string | number | null;
  booking_date?: string | null;
  booking_time?: string | null;
  amount?: number | null;
};

function firstMissingBookingField(payload: BookingPayloadCheck): string | null {
  if (!payload.user_id) return 'user_id';
  if (!payload.vendor_id) return 'vendor_id';
  if (!payload.service_id) return 'service_id';
  if (!payload.booking_date) return 'booking_date';
  if (!payload.booking_time) return 'booking_time';
  if (payload.amount == null || payload.amount <= 0) return 'amount';
  return null;
}

function bookingFieldLabel(field: string) {
  const key = field.trim().toLowerCase();
  if (BOOKING_FIELD_LABELS[key]) return BOOKING_FIELD_LABELS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function requiredFieldMessage(field: string) {
  return `${bookingFieldLabel(field)} is required.`;
}

function humanizeBookingApiMessage(message: string, payload?: BookingPayloadCheck) {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'missing required field' || lower === 'missing required fields') {
    if (payload) {
      const missing = firstMissingBookingField(payload);
      if (missing) return requiredFieldMessage(missing);
    }
    return trimmed;
  }

  const colonMatch = /^missing required fields?:\s*(.+)$/i.exec(trimmed);
  if (colonMatch?.[1]) {
    return requiredFieldMessage(colonMatch[1].split(/[,\s]+/)[0]);
  }

  for (const field of Object.keys(BOOKING_FIELD_LABELS)) {
    if (lower.includes(field)) {
      return requiredFieldMessage(field);
    }
  }

  return trimmed;
}

function buildDefaultBookingAddress(
  societyName: string | null,
  blockName: string | null,
  flatNumber: string | null,
  user?: AuthUser | null,
): string {
  const parts: string[] = [];
  if (societyName?.trim()) parts.push(societyName.trim());
  if (blockName?.trim()) parts.push(blockName.trim());
  if (flatNumber?.trim()) parts.push(`Flat ${flatNumber.trim()}`);
  if (parts.length) return parts.join(', ');

  const fallback: string[] = [];
  if (user?.society_id != null) fallback.push(`Society #${user.society_id}`);
  if (user?.flat_id != null) fallback.push(`Flat #${user.flat_id}`);
  return fallback.join(', ');
}

function bookingErrorMessage(e: unknown, payload?: BookingPayloadCheck) {
  const ax = e as AxiosError<{
    message?: string;
    field?: string;
    missing?: string;
    errors?: Array<{ field?: string; param?: string; path?: string; message?: string; msg?: string }>;
  }>;
  const data = ax?.response?.data;

  const explicitField = data?.field ?? data?.missing;
  if (explicitField) return requiredFieldMessage(String(explicitField));

  const firstError = data?.errors?.[0];
  const errorField = firstError?.field ?? firstError?.param ?? firstError?.path;
  if (errorField) {
    const detail = firstError?.message ?? firstError?.msg;
    if (detail?.trim()) return humanizeBookingApiMessage(detail);
    return requiredFieldMessage(String(errorField));
  }

  const apiMsg = data?.message;
  if (apiMsg?.trim()) return humanizeBookingApiMessage(apiMsg, payload);
  if (ax?.message) return ax.message;
  return 'Could not complete booking';
}

export default function ServiceDetailsScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const tabNavigation = useNavigation();
  const serviceId = route?.params?.serviceId;
  const title = route?.params?.title;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VendorServiceDetail | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);

  const [chatLoading, setChatLoading] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingAt, setBookingAt] = useState<Date>(() => defaultBookingDateTimeFrom(new Date()));
  const [pickerMinDate, setPickerMinDate] = useState<Date>(() => new Date());
  const [androidPicker, setAndroidPicker] = useState<'date' | 'time' | null>(null);
  const [bookingAddress, setBookingAddress] = useState('');
  const [societyName, setSocietyName] = useState<string | null>(null);
  const [blockName, setBlockName] = useState<string | null>(null);
  const [flatNumber, setFlatNumber] = useState<string | null>(null);
  const [residenceLoading, setResidenceLoading] = useState(false);
  /** Set after slot is held; booking is not final until Razorpay payment succeeds. */
  const [awaitingPaymentBookingId, setAwaitingPaymentBookingId] = useState<
    string | number | null
  >(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    variant: 'cancelled' | 'failed';
    title: string;
    message: string;
  } | null>(null);

  const androidTimeMinimumDate = useMemo(() => {
    if (Platform.OS !== 'android' || androidPicker !== 'time') return undefined;
    if (!isSameCalendarDay(bookingAt, new Date())) return undefined;
    return new Date();
  }, [bookingAt, androidPicker]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchServiceById(serviceId);
        if (!cancelled) setDetail(data ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load service details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const name = ((detail?.name as string | null | undefined) ?? title ?? 'Service').trim();
  const description = ((detail?.description as string | null | undefined) ?? '').trim();
  const status = ((detail?.status as string | null | undefined) ?? '').trim();
  const category = ((detail?.category as string | null | undefined) ?? '').trim();
  const vendorId = detail?.vendor_id != null ? String(detail.vendor_id) : '';
  const createdAt = formatDateTime((detail as any)?.created_at);
  const serviceAmountRupees = parseServiceAmountFromDetail(detail);
  const priceText = formatPrice(serviceAmountRupees ?? (detail as any)?.price);

  const imageStrings = useMemo(() => {
    const raw = detail?.images;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    return [String(raw)].filter(Boolean);
  }, [detail]);

  const imageUrls = useMemo(
    () => imageStrings.map((s) => resolveImageUri(s)).filter(Boolean),
    [imageStrings],
  );

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [serviceId, imageUrls.length]);

  const selectedImageUrl = imageUrls[selectedImageIndex] ?? imageUrls[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vendorId) {
        setVendor(null);
        setVendorError(null);
        setVendorLoading(false);
        return;
      }

      setVendorLoading(true);
      setVendorError(null);
      try {
        const data = await fetchVendorById(vendorId);
        if (!cancelled) setVendor(data ?? null);
      } catch (e) {
        if (!cancelled) setVendorError((e as Error)?.message || 'Failed to load vendor details');
      } finally {
        if (!cancelled) setVendorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    let cancelled = false;
    const societyId = user?.society_id;
    const flatId = user?.flat_id;

    if (societyId == null && flatId == null) {
      setSocietyName(null);
      setBlockName(null);
      setFlatNumber(null);
      setResidenceLoading(false);
      return;
    }

    (async () => {
      setResidenceLoading(true);
      setSocietyName(null);
      setBlockName(null);
      setFlatNumber(null);
      try {
        if (societyId != null) {
          const res = await societyApi.fetchAllSocieties();
          const list = (res?.data ?? []) as societyApi.Society[];
          const match = list.find((s) => String(s.id) === String(societyId));
          if (!cancelled) setSocietyName(match?.name ?? null);
        }

        if (societyId != null && flatId != null) {
          const blocksRes = await blockApi.fetchBlocksBySociety(societyId);
          const blocks = (blocksRes?.data ?? []) as blockApi.Block[];
          for (const block of blocks) {
            if (cancelled) break;
            const flatsRes = await flatApi.fetchFlatsByBlock(block.id);
            const flats = (flatsRes?.data ?? []) as flatApi.Flat[];
            const found = flats.find((f) => String(f.id) === String(flatId));
            if (found) {
              if (!cancelled) {
                setBlockName(block.name ?? null);
                setFlatNumber(found.flat_number ?? null);
              }
              break;
            }
          }
        }
      } catch {
        /* fall back to ids in buildDefaultBookingAddress */
      } finally {
        if (!cancelled) setResidenceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.society_id, user?.flat_id]);

  const defaultBookingAddress = useMemo(
    () => buildDefaultBookingAddress(societyName, blockName, flatNumber, user),
    [societyName, blockName, flatNumber, user],
  );

  const addressForApi = useMemo(() => {
    const custom = bookingAddress.trim();
    if (custom) return custom;
    return defaultBookingAddress;
  }, [bookingAddress, defaultBookingAddress]);

  function resetBookingModalState() {
    setAwaitingPaymentBookingId(null);
    setAndroidPicker(null);
    setBookingAddress('');
    setPaymentNotice(null);
  }

  function requestCloseBookingModal() {
    if (bookingLoading) return;
    if (awaitingPaymentBookingId != null) {
      Alert.alert(
        'Payment required',
        'Your booking is not confirmed until payment is completed. Leave without paying?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              resetBookingModalState();
              setBookingOpen(false);
            },
          },
        ],
      );
      return;
    }
    resetBookingModalState();
    setBookingOpen(false);
  }

  function openBooking() {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please log in to book this service.');
      return;
    }
    if (!vendorId || !serviceId) {
      Alert.alert('Unavailable', 'Service or vendor information is missing.');
      return;
    }
    if (!priceText) {
      Alert.alert('Unavailable', 'This service has no price. Online payment is required to book.');
      return;
    }
    const now = new Date();
    setPickerMinDate(now);
    setBookingAt(defaultBookingDateTimeFrom(now));
    resetBookingModalState();
    setBookingOpen(true);
  }

  function onAndroidPickerChange(event: DateTimePickerEvent, selected?: Date) {
    const mode = androidPicker;
    if (Platform.OS === 'android') {
      setAndroidPicker(null);
    }
    if (event.type === 'dismissed' || !selected || !mode) return;
    const now = new Date();
    setBookingAt((prev) => clampBookingAtOrAfterNow(mergeDateTime(prev, selected, mode), now));
  }

  function onIosDateTimeChange(_: DateTimePickerEvent, selected?: Date) {
    if (!selected) return;
    const now = new Date();
    setBookingAt(clampBookingAtOrAfterNow(selected, now));
  }

  async function startVendorChat() {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please log in to message this vendor.');
      return;
    }
    if (!vendorId) {
      Alert.alert('Unavailable', 'Vendor information is missing.');
      return;
    }
    setChatLoading(true);
    try {
      const res = await chatApi.createOrGetChat(user.id, vendorId);
      if (!res?.success || !res.data?.id) throw new Error(res?.message || 'Could not start chat');
      const vendorLabel =
        (vendor?.business_name && String(vendor.business_name).trim()) ||
        (vendor?.name && String(vendor.name).trim()) ||
        'Vendor';
      tabNavigation.navigate('ProfileTab', {
        screen: 'Chat',
        params: {
          chatId: res.data.id,
          vendorId,
          vendorName: vendorLabel,
          vendorProfileImage: (vendor as { profile_image?: string | null })?.profile_image ?? null,
        },
      });
    } catch (e) {
      Alert.alert('Chat unavailable', (e as Error).message || 'Could not start chat');
    } finally {
      setChatLoading(false);
    }
  }

  async function completePaymentForBooking(
    bookingId: string | number,
    expectedAmountRupees: number,
  ): Promise<boolean> {
    setPaymentNotice(null);
    const orderRes = await createPaymentOrder(bookingId, expectedAmountRupees);
    const order = orderRes?.order;
    if (!order?.id) {
      throw new Error('Could not start payment. Please try again.');
    }

    const serviceTitle = detail?.name || detail?.title || 'Service booking';
    const vendorDisplayName =
      (vendor?.business_name && String(vendor.business_name).trim()) ||
      (vendor?.name && String(vendor.name).trim()) ||
      'Vendor';
    const checkout = await openRazorpayCheckout({
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      expectedAmountRupees,
      description: `${serviceTitle} — ${vendorDisplayName}`,
      customerName: user?.name,
      customerEmail: user?.email,
      customerPhone: user?.phone_number,
    });

    if (!checkout.success) {
      if (checkout.cancelled) {
        setPaymentNotice({
          variant: 'cancelled',
          title: 'Payment cancelled',
          message:
            'You closed checkout without paying. Your slot is still reserved — tap Pay to confirm when you are ready.',
        });
      } else {
        setPaymentNotice({
          variant: 'failed',
          title: 'Payment not completed',
          message: checkout.error,
        });
      }
      return false;
    }

    try {
      await verifyVendorPayment({
        booking_id: bookingId,
        razorpay_order_id: checkout.orderId,
        razorpay_payment_id: checkout.paymentId,
        razorpay_signature: checkout.signature,
      });
      return true;
    } catch (verifyErr) {
      const status = (verifyErr as AxiosError)?.response?.status;
      if (status === 404) {
        Alert.alert(
          'Payment received',
          'Your payment was successful. Booking confirmation on the server may take a moment — check My bookings shortly.',
        );
        return true;
      }
      const msg =
        (verifyErr as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (verifyErr as Error).message ||
        'Payment succeeded but confirmation failed. Contact support if the booking stays pending.';
      Alert.alert('Payment received', msg);
      return true;
    }
  }

  async function submitBooking() {
    if (!user?.id || !vendorId || !serviceId) return;

    const { booking_date, booking_time } = dateToBookingApi(bookingAt);
    const amount = parseServiceAmountFromDetail(detail);
    const payload = {
      user_id: user.id,
      vendor_id: vendorId,
      service_id: serviceId,
      booking_date,
      booking_time,
      amount,
    };

    if (awaitingPaymentBookingId == null) {
      if (bookingAt.getTime() < Date.now()) {
        Alert.alert('Invalid time', 'Please choose a date and time in the future.');
        return;
      }
      if (!addressForApi.trim()) {
        Alert.alert(
          'Address unavailable',
          'Your profile is missing society or flat details. Enter an address below or update your profile.',
        );
        return;
      }
      const missingField = firstMissingBookingField(payload);
      if (missingField) {
        Alert.alert('Required', requiredFieldMessage(missingField));
        return;
      }
      if (amount == null || amount <= 0) {
        Alert.alert('Invalid price', 'This service does not have a valid price for online payment.');
        return;
      }
    }

    setBookingLoading(true);
    try {
      let bookingId = awaitingPaymentBookingId;

      if (bookingId == null) {
        const bookRes = await bookVendorService({
          ...payload,
          amount: amount as number,
          address: addressForApi,
        });
        bookingId = getBookingIdFromResponse(bookRes);
        if (bookingId == null) {
          throw new Error('Could not reserve this slot. Please try again.');
        }
        setAwaitingPaymentBookingId(bookingId);
      }

      const paid = await completePaymentForBooking(bookingId, amount as number);
      if (!paid) {
        return;
      }

      resetBookingModalState();
      setBookingOpen(false);
      Alert.alert('Booking confirmed', 'Payment received. Your service is booked.');
    } catch (e) {
      const code = (e as AxiosError)?.response?.status;
      const title = code === 409 ? 'Slot taken' : 'Booking failed';
      Alert.alert(title, bookingErrorMessage(e, payload));
      if (code === 409) {
        setAwaitingPaymentBookingId(null);
      }
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrNavigate(navigation, 'Home')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name || 'Service Details'}
          </Text>
          {category ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {category}
            </Text>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.hint}>Loading service…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setDetail(null);
              setLoading(true);
              setError(null);
              fetchServiceById(serviceId)
                .then((data) => setDetail(data ?? null))
                .catch((e) => setError((e as Error)?.message || 'Failed to load service details'))
                .finally(() => setLoading(false));
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !detail ? (
        <View style={styles.center}>
          <Text style={styles.hint}>No details found.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.heroWrap}>
              {selectedImageUrl ? (
                <Image source={{ uri: selectedImageUrl }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                  <Text style={styles.hint}>No image</Text>
                </View>
              )}

              <View style={styles.heroBadges}>
                {status ? (
                  <View style={[styles.badge, status.toLowerCase() === 'approved' ? styles.badgeApproved : styles.badgeNeutral]}>
                    <Ionicons
                      name={status.toLowerCase() === 'approved' ? 'checkmark' : 'information'}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
                  </View>
                ) : null}
                {imageStrings.length ? (
                  <View style={[styles.badge, styles.badgeCount]}>
                    <Ionicons name="images-outline" size={14} color="#fff" />
                    <Text style={styles.badgeText}>{imageStrings.length} Images</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {imageUrls.length > 1 ? (
              <FlatList
                data={imageUrls}
                keyExtractor={(u, idx) => `${u}-${idx}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
                renderItem={({ item, index }) => {
                  const selected = index === selectedImageIndex;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedImageIndex(index)}
                      activeOpacity={0.85}
                      style={[styles.thumbWrap, selected ? styles.thumbSelected : null]}
                    >
                      <Image source={{ uri: item }} style={styles.thumbImage} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                }}
              />
            ) : null}

            <View style={styles.card}>
              <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="construct-outline" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceTitle} numberOfLines={2}>
                      {name || 'Service'}
                    </Text>
                    {category ? (
                      <Text style={styles.serviceSubtitle} numberOfLines={1}>
                        {category}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {status ? (
                  <View style={styles.statusPill}>
                    <Ionicons
                      name={status.toLowerCase() === 'approved' ? 'checkmark-circle' : 'information-circle'}
                      size={16}
                      color={status.toLowerCase() === 'approved' ? '#16A34A' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        status.toLowerCase() === 'approved' ? styles.statusTextApproved : null,
                      ]}
                    >
                      {status.toLowerCase()}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.highlightsRow}>
                {priceText ? (
                  <View style={styles.highlightItem}>
                    <View style={[styles.highlightIconCircle, { backgroundColor: '#FFF7ED' }]}>
                      <Ionicons name="pricetag-outline" size={18} color="#EA580C" />
                    </View>
                    <Text style={styles.highlightValue}>{priceText}</Text>
                    <Text style={styles.highlightLabel}>Fixed Price</Text>
                  </View>
                ) : null}
                <View style={styles.highlightItem}>
                  <View style={[styles.highlightIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="person-outline" size={18} color="#4F46E5" />
                  </View>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    {vendor?.business_name || vendor?.name || 'N/A'}
                  </Text>
                  <Text style={styles.highlightLabel}>Vendor</Text>
                </View>
                {createdAt ? (
                  <View style={styles.highlightItem}>
                    <View style={[styles.highlightIconCircle, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.highlightValue} numberOfLines={1}>
                      {new Date(String((detail as any)?.created_at)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.highlightLabel}>Listed</Text>
                  </View>
                ) : null}
              </View>

              {description ? (
                <View style={styles.serviceImagesWrap}>
                  <Text style={styles.sectionTitleSm}>About this service</Text>
                  <Text style={styles.descriptionText}>{description}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.vendorCard}>
              {vendorLoading ? (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.inlineLoadingText}>Loading vendor…</Text>
                </View>
              ) : vendorError ? (
                <View style={styles.vendorErrorWrap}>
                  <Text style={styles.errorText}>{vendorError}</Text>
                  <TouchableOpacity
                    style={styles.vendorRetryBtn}
                    onPress={() => {
                      if (!vendorId) return;
                      setVendorLoading(true);
                      setVendorError(null);
                      fetchVendorById(vendorId)
                        .then((data) => setVendor(data ?? null))
                        .catch((e) => setVendorError((e as Error)?.message || 'Failed to load vendor details'))
                        .finally(() => setVendorLoading(false));
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.vendorRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : !vendor ? (
                <Text style={styles.hint}>Vendor info not available.</Text>
              ) : (
                <>
                  <View style={styles.vendorHeader}>
                    <View style={styles.vendorAvatar}>
                      <Ionicons name="storefront-outline" size={22} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vendorName} numberOfLines={1}>
                        {normalizeValue(vendor.business_name) || 'Business'}
                      </Text>
                      {vendor.years_of_experience ? (
                        <Text style={styles.vendorExp}>
                          {normalizeValue(vendor.years_of_experience)} yrs experience
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {vendor.description ? (
                    <Text style={styles.vendorDesc}>{normalizeValue(vendor.description)}</Text>
                  ) : null}

                  {vendor.business_registration_number ? (
                    <View style={styles.vendorRow}>
                      <View style={[styles.vendorIconWrap, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="document-text-outline" size={16} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorFieldLabel}>Registration No.</Text>
                        <Text style={styles.vendorFieldValue}>{normalizeValue(vendor.business_registration_number)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {vendor.gst_number ? (
                    <View style={styles.vendorRow}>
                      <View style={[styles.vendorIconWrap, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorFieldLabel}>GST Number</Text>
                        <Text style={styles.vendorFieldValue}>{normalizeValue(vendor.gst_number)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {vendor.email ? (
                    <View style={styles.vendorRow}>
                      <View style={[styles.vendorIconWrap, { backgroundColor: '#FCE7F3' }]}>
                        <Ionicons name="mail-outline" size={16} color="#DB2777" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorFieldLabel}>Email</Text>
                        <Text style={styles.vendorFieldValue}>{normalizeValue(vendor.email)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {vendor.website_url ? (
                    <View style={styles.vendorRow}>
                      <View style={[styles.vendorIconWrap, { backgroundColor: '#E0E7FF' }]}>
                        <Ionicons name="globe-outline" size={16} color="#4F46E5" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorFieldLabel}>Website</Text>
                        <Text style={styles.vendorFieldValue} numberOfLines={1}>{normalizeValue(vendor.website_url)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {(vendor.business_address || vendor.city || vendor.state || vendor.pincode) ? (
                    <View style={styles.vendorAddressBox}>
                      <View style={[styles.vendorIconWrap, { backgroundColor: '#F0FDF4' }]}>
                        <Ionicons name="location-outline" size={16} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorFieldLabel}>Address</Text>
                        <Text style={styles.vendorFieldValue}>
                          {[
                            normalizeValue(vendor.business_address),
                            normalizeValue(vendor.city),
                            normalizeValue(vendor.state),
                            vendor.pincode ? normalizeValue(vendor.pincode) : '',
                          ].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <View style={styles.bottomBarInner}>
              {priceText ? (
                <View style={styles.bottomPriceWrap}>
                  <Text style={styles.bottomPriceLabel}>Price</Text>
                  <Text style={styles.bottomPriceValue}>{priceText}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.chatBtn, chatLoading && styles.chatBtnDisabled]}
                activeOpacity={0.85}
                onPress={startVendorChat}
                disabled={chatLoading || !vendorId}
              >
                {chatLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                    <Text style={styles.chatBtnText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bookBtn, !priceText && { flex: 1 }]} activeOpacity={0.85} onPress={openBooking}>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={styles.bookBtnText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Modal
            visible={bookingOpen}
            transparent
            animationType="slide"
            onRequestClose={requestCloseBookingModal}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={requestCloseBookingModal}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalKeyboard}
              >
                <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderLeft}>
                      <View style={styles.modalHeaderIcon}>
                        <Ionicons name="calendar" size={18} color="#fff" />
                      </View>
                      <View>
                        <Text style={styles.modalTitle}>Book Service</Text>
                        <Text style={styles.modalTitleSub}>
                          {awaitingPaymentBookingId != null
                            ? 'Complete payment to confirm'
                            : 'Payment required to confirm'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={requestCloseBookingModal}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      disabled={bookingLoading}
                    >
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalServiceCard}>
                      <View style={styles.modalServiceRow}>
                        <Ionicons name="construct-outline" size={16} color={colors.primary} />
                        <Text style={styles.modalServiceName} numberOfLines={1}>{name || 'Service'}</Text>
                      </View>
                      {priceText ? (
                        <View style={styles.modalServiceRow}>
                          <Ionicons name="pricetag-outline" size={14} color="#EA580C" />
                          <Text style={styles.modalServicePrice}>{priceText}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.paymentRequiredNotice}>
                      <Ionicons name="card-outline" size={18} color="#2563EB" />
                      <Text style={styles.paymentRequiredNoticeText}>
                        {awaitingPaymentBookingId != null
                          ? 'Your slot is reserved. Pay now to confirm — the booking is not final without payment.'
                          : 'You must complete payment to confirm this booking. Unpaid requests are not finalized.'}
                      </Text>
                    </View>

                    {awaitingPaymentBookingId != null ? (
                      <View style={styles.paymentPendingBanner}>
                        <Ionicons name="alert-circle" size={18} color="#B45309" />
                        <Text style={styles.paymentPendingBannerText}>
                          Payment pending — tap Pay to confirm below.
                        </Text>
                      </View>
                    ) : null}

                    {paymentNotice ? (
                      <View
                        style={[
                          styles.paymentNoticeCard,
                          paymentNotice.variant === 'cancelled'
                            ? styles.paymentNoticeCancelled
                            : styles.paymentNoticeFailed,
                        ]}
                      >
                        <View style={styles.paymentNoticeHeader}>
                          <Ionicons
                            name={
                              paymentNotice.variant === 'cancelled'
                                ? 'information-circle'
                                : 'close-circle'
                            }
                            size={22}
                            color={
                              paymentNotice.variant === 'cancelled' ? '#B45309' : '#B91C1C'
                            }
                          />
                          <Text
                            style={[
                              styles.paymentNoticeTitle,
                              paymentNotice.variant === 'cancelled'
                                ? styles.paymentNoticeTitleCancelled
                                : styles.paymentNoticeTitleFailed,
                            ]}
                          >
                            {paymentNotice.title}
                          </Text>
                          <TouchableOpacity
                            onPress={() => setPaymentNotice(null)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Dismiss payment message"
                          >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.paymentNoticeMessage}>{paymentNotice.message}</Text>
                        {paymentNotice.variant === 'cancelled' ? (
                          <TouchableOpacity
                            style={styles.paymentNoticeAction}
                            onPress={() => setPaymentNotice(null)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.paymentNoticeActionText}>Got it</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    <Text style={styles.modalSectionLabel}>Select Date & Time</Text>
                    {Platform.OS === 'ios' ? (
                      <View
                        style={[
                          styles.iosPickerWrap,
                          awaitingPaymentBookingId != null && styles.bookingFieldsLocked,
                        ]}
                        pointerEvents={awaitingPaymentBookingId != null ? 'none' : 'auto'}
                      >
                        <DateTimePicker
                          value={bookingAt}
                          mode="datetime"
                          display="spinner"
                          onChange={onIosDateTimeChange}
                          minimumDate={pickerMinDate}
                          themeVariant={isDark ? 'dark' : 'light'}
                        />
                      </View>
                    ) : (
                      <>
                        <View style={styles.pickerGrid}>
                          <TouchableOpacity
                            style={[styles.pickerTile, androidPicker === 'date' && styles.pickerTileActive]}
                            onPress={() => !bookingLoading && awaitingPaymentBookingId == null && setAndroidPicker('date')}
                            disabled={bookingLoading || awaitingPaymentBookingId != null}
                            activeOpacity={0.8}
                          >
                            <View style={styles.pickerTileIconWrap}>
                              <Ionicons name="calendar-outline" size={20} color={androidPicker === 'date' ? '#fff' : colors.primary} />
                            </View>
                            <Text style={styles.pickerTileLabel}>Date</Text>
                            <Text style={[styles.pickerTileValue, androidPicker === 'date' && styles.pickerTileValueActive]} numberOfLines={1}>
                              {formatBookingDateLabel(bookingAt)}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.pickerTile, androidPicker === 'time' && styles.pickerTileActive]}
                            onPress={() => !bookingLoading && awaitingPaymentBookingId == null && setAndroidPicker('time')}
                            disabled={bookingLoading || awaitingPaymentBookingId != null}
                            activeOpacity={0.8}
                          >
                            <View style={styles.pickerTileIconWrap}>
                              <Ionicons name="time-outline" size={20} color={androidPicker === 'time' ? '#fff' : colors.primary} />
                            </View>
                            <Text style={styles.pickerTileLabel}>Time</Text>
                            <Text style={[styles.pickerTileValue, androidPicker === 'time' && styles.pickerTileValueActive]} numberOfLines={1}>
                              {formatBookingTimeLabel(bookingAt)}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {androidPicker ? (
                          <View style={styles.androidPickerWrap}>
                            <DateTimePicker
                              value={bookingAt}
                              mode={androidPicker}
                              display="default"
                              onChange={onAndroidPickerChange}
                              minimumDate={androidPicker === 'date' ? pickerMinDate : androidTimeMinimumDate}
                            />
                          </View>
                        ) : null}
                      </>
                    )}

                    <Text style={styles.modalSectionLabel}>Address</Text>
                    <View style={styles.modalAddressInput}>
                      <View style={styles.modalAddressInputRow}>
                        <View style={styles.modalAddressIconWrap}>
                          <Ionicons name="location-outline" size={16} color="#16A34A" />
                        </View>
                        <View style={styles.modalAddressInputBody}>
                          <TextInput
                            style={styles.modalAddressText}
                            value={bookingAddress}
                            onChangeText={setBookingAddress}
                            placeholder="Optional — default is your registered address (society, block, flat)"
                            placeholderTextColor={colors.textSecondary}
                            editable={!bookingLoading && awaitingPaymentBookingId == null}
                            multiline
                          />
                          {!bookingAddress.trim() ? (
                            <View style={styles.modalAddressPreview}>
                              <Text style={styles.modalAddressPreviewLabel}>Address sent with booking</Text>
                              {residenceLoading ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.primary}
                                  style={styles.modalAddressPreviewLoader}
                                />
                              ) : (
                                <Text style={styles.modalAddressPreviewValue}>
                                  {addressForApi.trim() || '—'}
                                </Text>
                              )}
                              {defaultBookingAddress ? (
                                <Text style={styles.modalAddressPreviewNote}>
                                  Using your default registered address
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalFooter}>
                      <TouchableOpacity
                        style={styles.modalCancelBtn}
                        onPress={requestCloseBookingModal}
                        disabled={bookingLoading}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalSubmit, bookingLoading && styles.modalSubmitDisabled]}
                        onPress={submitBooking}
                        disabled={bookingLoading}
                        activeOpacity={0.9}
                      >
                        {bookingLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="card-outline" size={18} color="#fff" />
                            <Text style={styles.modalSubmitText}>
                              {awaitingPaymentBookingId != null ? 'Pay to confirm' : 'Pay to confirm booking'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: {
  background: string;
  maincontainerbackground: string;
  text: string;
  textSecondary: string;
  surface: string;
  primary: string;
  border: string;
}) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTextWrap: { flex: 1, marginLeft: 12 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    headerSubtitle: { marginTop: 3, color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
    hint: { color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
    errorText: { color: '#B91C1C', fontWeight: '800', textAlign: 'center' },
    retryBtn: {
      marginTop: 4,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    retryText: { color: '#fff', fontWeight: '800' },
    content: { padding: 16, paddingBottom: 120, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
      gap: 10,
    },
    heroWrap: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    heroImage: { width: '100%', height: 220 },
    heroPlaceholder: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
    heroBadges: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeApproved: { backgroundColor: '#F97316' },
    badgeNeutral: { backgroundColor: '#64748B' },
    badgeCount: { backgroundColor: '#475569' },
    badgeText: { color: '#fff', fontWeight: '900', letterSpacing: 0.2, fontSize: 12 },
    thumbRow: { paddingVertical: 10, gap: 10 },
    thumbWrap: {
      width: 86,
      height: 56,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
      marginRight: 10,
    },
    thumbSelected: { borderColor: colors.primary },
    thumbImage: { width: '100%', height: '100%' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F97316',
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
    serviceSubtitle: { marginTop: 2, color: colors.textSecondary, fontWeight: '600' },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: '#E2E8F0',
    },
    statusText: { color: '#334155', fontWeight: '800', textTransform: 'capitalize' },
    statusTextApproved: { color: '#16A34A' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    metaLabel: { color: colors.textSecondary, fontWeight: '800' },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: '#DBEAFE',
      borderWidth: 1,
      borderColor: '#93C5FD',
    },
    chipText: { color: '#1D4ED8', fontWeight: '900' },
    highlightsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    highlightItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.maincontainerbackground,
    },
    highlightIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightValue: { color: colors.text, fontWeight: '900', fontSize: 14, textAlign: 'center', paddingHorizontal: 4 },
    highlightLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
    serviceImagesWrap: { marginTop: 4, gap: 8 },
    descriptionText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13, lineHeight: 20 },
    sectionTitleSm: { color: colors.text, fontWeight: '900', fontSize: 14 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    smallChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: '#EEF2FF',
      borderWidth: 1,
      borderColor: '#C7D2FE',
      maxWidth: '100%',
    },
    smallChipText: { color: '#1E40AF', fontWeight: '800' },
    vendorCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      gap: 14,
    },
    vendorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    vendorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: '#4F46E5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    vendorName: { color: colors.text, fontWeight: '900', fontSize: 17 },
    vendorExp: { marginTop: 2, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    vendorDesc: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 13,
      lineHeight: 20,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    vendorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    vendorAddressBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    vendorIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vendorFieldLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 11, marginBottom: 1 },
    vendorFieldValue: { color: colors.text, fontWeight: '800', fontSize: 13 },
    inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    inlineLoadingText: { color: colors.textSecondary, fontWeight: '700' },
    vendorErrorWrap: { gap: 10 },
    vendorRetryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    vendorRetryText: { color: '#fff', fontWeight: '900' },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    bottomBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    bottomPriceWrap: {
      flex: 1,
    },
    bottomPriceLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    bottomPriceValue: { color: colors.text, fontWeight: '900', fontSize: 22 },
    chatBtn: {
      height: 52,
      minWidth: 118,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.maincontainerbackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
    chatBtnDisabled: { opacity: 0.65 },
    chatBtnText: { color: colors.primary, fontWeight: '900', fontSize: 15 },
    bookBtn: {
      flex: 1,
      height: 52,
      borderRadius: 16,
      backgroundColor: '#F97316',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 28,
    },
    bookBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      justifyContent: 'flex-end',
    },
    modalKeyboard: {
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: 20,
      maxWidth: 520,
      alignSelf: 'center',
      width: '100%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    modalHeaderIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: '#F97316',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
    modalTitleSub: { marginTop: 2, color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.maincontainerbackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalContent: { paddingBottom: 6, gap: 16 },
    modalServiceCard: {
      backgroundColor: colors.maincontainerbackground,
      borderRadius: 16,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalServiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalServiceName: { color: colors.text, fontWeight: '800', fontSize: 14, flex: 1 },
    modalServicePrice: { color: '#EA580C', fontWeight: '900', fontSize: 15 },
    paymentRequiredNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(37, 99, 235, 0.25)',
    },
    paymentRequiredNoticeText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    paymentPendingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(180, 83, 9, 0.12)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(180, 83, 9, 0.35)',
    },
    paymentPendingBannerText: {
      flex: 1,
      color: '#B45309',
      fontSize: 13,
      fontWeight: '800',
    },
    paymentNoticeCard: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      gap: 10,
    },
    paymentNoticeCancelled: {
      backgroundColor: 'rgba(180, 83, 9, 0.1)',
      borderColor: 'rgba(180, 83, 9, 0.35)',
    },
    paymentNoticeFailed: {
      backgroundColor: 'rgba(185, 28, 28, 0.08)',
      borderColor: 'rgba(185, 28, 28, 0.3)',
    },
    paymentNoticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    paymentNoticeTitle: {
      flex: 1,
      fontWeight: '900',
      fontSize: 15,
    },
    paymentNoticeTitleCancelled: { color: '#B45309' },
    paymentNoticeTitleFailed: { color: '#B91C1C' },
    paymentNoticeMessage: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    paymentNoticeAction: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentNoticeActionText: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    modalSectionLabel: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 13,
      marginBottom: -8,
    },
    modalAddressPreview: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 4,
    },
    modalAddressPreviewLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    modalAddressPreviewValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    modalAddressPreviewNote: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    modalAddressPreviewLoader: {
      alignSelf: 'flex-start',
      marginVertical: 4,
    },
    iosPickerWrap: {
      alignItems: 'stretch',
      marginBottom: 4,
    },
    bookingFieldsLocked: { opacity: 0.45 },
    pickerGrid: { flexDirection: 'row', gap: 12 },
    pickerTile: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.maincontainerbackground,
      alignItems: 'center',
      gap: 6,
    },
    pickerTileActive: {
      borderColor: '#F97316',
      backgroundColor: '#FFF7ED',
    },
    pickerTileIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerTileLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
    pickerTileValue: { color: colors.text, fontWeight: '900', fontSize: 13, textAlign: 'center' },
    pickerTileValueActive: { color: '#EA580C' },
    androidPickerWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 6,
      backgroundColor: colors.maincontainerbackground,
    },
    modalAddressInput: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.maincontainerbackground,
    },
    modalAddressInputRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    modalAddressInputBody: {
      flex: 1,
    },
    modalAddressIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#F0FDF4',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    modalAddressText: {
      flex: 1,
      color: colors.text,
      fontWeight: '600',
      fontSize: 13,
      minHeight: 60,
      textAlignVertical: 'top',
      paddingTop: 6,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    modalCancelBtn: {
      height: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.maincontainerbackground,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCancelText: { color: colors.textSecondary, fontWeight: '800', fontSize: 14 },
    modalSubmit: {
      flex: 1,
      height: 52,
      borderRadius: 16,
      backgroundColor: '#F97316',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    modalSubmitDisabled: { opacity: 0.7 },
    modalSubmitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  });
}

