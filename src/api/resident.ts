import api, { STORAGE_TOKEN_KEY, logApiResponseSuccess, logFetchApiRequest } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMultipart } from '../lib/uploadImage';

/**
 * Matches smart-society `usersOnboard` (POST /api/resident/signUp):
 * multipart form: name, email, password, phone_number, fcm_tokens, society_id, flat_id
 * optional file part: profile_image (multer)
 */
export type ResidentSignUp = {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  society_id?: string | number;
  flat_id?: string | number;
  /** Stored in DB as `fcm_token`; backend reads `fcm_tokens` from body. */
  fcm_tokens?: string;
  /** Fallbacks if only one naming style is set (coerced to `fcm_tokens`). */
  fcm_token?: string;
  fcmToken?: string;
  /** Optional VoIP token for iOS CallKit push notifications. */
  voip_token?: string;
  /** Optional multipart file; field name `profile_image`. */
  profileImage?: { uri: string; type?: string; name?: string };
};

function resolveSignupFcmToken(data: Omit<ResidentSignUp, 'profileImage'>) {
  return data.fcm_tokens ?? data.fcm_token ?? data.fcmToken ?? '';
}

/** Text fields for `usersOnboard` (always sent as multipart form parts). */
function buildUsersOnboardFields(data: Omit<ResidentSignUp, 'profileImage'>) {
  const fcm_tokens = resolveSignupFcmToken(data);
  return {
    name: data.name,
    email: data.email,
    password: data.password,
    phone_number: data.phone_number,
    fcm_tokens,
    ...(data.voip_token != null && { voip_token: data.voip_token }),
    ...(data.society_id != null && { society_id: data.society_id }),
    ...(data.flat_id != null && { flat_id: data.flat_id }),
  };
}

export type ResidentLogin = {
  phone: string;
  fcm_tokens?: string;
  fcm_token?: string;
  fcmToken?: string;
};

export type OtpSendResponse = {
  message: string;
  hashOTP: string;
};

export type OtpVerifyResponse = {
  message: string;
  token?: string;
};

export type ResidentLoginResponse = {
  success: boolean;
  token?: string;
  message?: string;
  resident?: {
    id: string | number;
    role_id?: string | null;
    name?: string;
    email?: string;
    phone?: string;
    is_active?: boolean;
    created_at?: string;
    fcm_token?: string | null;
    flat_id?: string | null;
    society_id?: string | number | null;
    profile_image?: string | null;
    society?: unknown;
    flat?: unknown;
  };
};

export type ResidentUpdate = {
  name?: string;
  email?: string;
  phone_number?: string;
};

export type ResidentValidation = {
  email: string;
  password: string;
  phone_number: string;
  /** Optional: backend may require it for validation, depending on implementation. */
  id_proof_number?: string;
};

export type ResidentUpdateOptions = {
  /** New profile image file (multipart). */
  profileImage?: { uri: string; type?: string; name?: string } | null;
  /** Set profile_image to null on the server. */
  removeProfileImage?: boolean;
};

export async function residentSignUp(data: ResidentSignUp) {
  const path = '/resident/signUp';
  const url = `${api.defaults.baseURL ?? ''}${path}`;
  const { profileImage, ...rest } = data;
  const fields = buildUsersOnboardFields(rest);

  const fd = new FormData();
  fd.append('name', fields.name);
  fd.append('email', fields.email);
  fd.append('password', fields.password);
  fd.append('phone_number', fields.phone_number);
  fd.append('fcm_tokens', fields.fcm_tokens);
  if (fields.voip_token != null) fd.append('voip_token', fields.voip_token);
  if (fields.society_id != null) fd.append('society_id', String(fields.society_id));
  if (fields.flat_id != null) fd.append('flat_id', String(fields.flat_id));
  if (profileImage?.uri) {
    fd.append('profile_image', {
      uri: profileImage.uri,
      type: profileImage.type || 'image/jpeg',
      name: profileImage.name || 'profile.jpg',
    } as any);
  }

  logFetchApiRequest({
    method: 'POST',
    url,
    contentTypeNote: 'multipart/form-data (fetch — boundary set by native)',
    body: {
      name: fields.name,
      email: fields.email,
      password: '[redacted]',
      phone_number: fields.phone_number,
      fcm_tokens: '[redacted]',
      ...(fields.voip_token != null && { voip_token: '[redacted]' }),
      ...(fields.society_id != null && { society_id: String(fields.society_id) }),
      ...(fields.flat_id != null && { flat_id: String(fields.flat_id) }),
      profile_image: profileImage?.uri
        ? {
            file: true,
            uri: profileImage.uri,
            type: profileImage.type || 'image/jpeg',
            name: profileImage.name || 'profile.jpg',
          }
        : undefined,
    },
  });
  
  console.log('🚀 Sending residentSignUp with payload:', JSON.stringify(fields, null, 2));
  
  const resp = await fetch(url, { method: 'POST', body: fd });
  const json = (await resp.json()) as { success: boolean; token?: string; message?: string };
  logApiResponseSuccess(resp.status, 'POST', url, json);
  if (!resp.ok) {
    const err: any = new Error(json.message || `HTTP ${resp.status}`);
    err.response = { status: resp.status, data: json };
    throw err;
  }
  if (json.token) await AsyncStorage.setItem(STORAGE_TOKEN_KEY, json.token);
  return json;
}

export async function residentValidateSignupFields(data: ResidentValidation) {
  const payload = {
    email: data.email,
    password: data.password,
    phone_number: data.phone_number,
    ...(data.id_proof_number ? { id_proof_number: data.id_proof_number } : {}),
  };

  const url = '/resident/validation';
  const res = await api.post<{ success: boolean; message?: string }>(url, payload);
  return res.data;
}

/**
 * Send OTP to resident's phone number for login.
 * Returns hashed OTP that should be stored temporarily for verification.
 */
export async function residentSendOtp(mobileNumber: string) {
  const res = await api.post<OtpSendResponse>('/auth/otp-sender-resident', { mobileNumber });
  return res.data;
}

/**
 * Verify OTP and complete resident login.
 * Backend returns a JWT when `phone` matches a registered user.
 */
export async function residentVerifyOtp(hashOTP: string, otp: string, phone: string) {
  const res = await api.post<OtpVerifyResponse>('/auth/otp-check', { hashOTP, otp, phone });
  if (res.data.token) await AsyncStorage.setItem(STORAGE_TOKEN_KEY, res.data.token);
  return res.data;
}

export async function residentCheckAuth() {
  const res = await api.get<{
    success: boolean;
    message?: string;
    resident?: {
      id: string | number;
      role_id?: string | null;
      name?: string;
      email?: string;
      phone?: string;
      is_active?: boolean;
      created_at?: string;
      fcm_token?: string | null;
      flat_id?: string | null;
      society_id?: string | number | null;
      profile_image?: string | null;
    };
    data?: {
      id: string | number;
      role?: string;
      name?: string;
      email?: string;
      phone?: string;
      flat_id?: string | number | null;
      society_id?: string | number | null;
      profile_image?: string | null;
    };
  }>('/resident/checkAuth');
  return res.data;
}

export type ResidentListItem = {
  id: string | number;
  name?: string;
  email?: string;
  phone?: string;
  role_id?: string | null;
  fcm_token?: string | null;
  profile_image?: string | null;
  society_id?: string | number | null;
  flat_id?: string | number | null;
};

/** Find a resident in paginated `GET /resident/fetch` (public list on current backend). */
export async function residentFetchFromList(opts: { id?: string | number; phone?: string }) {
  const targetPhone = opts.phone?.replace(/\D/g, '');
  let page = 1;
  const limit = 50;

  while (page <= 20) {
    const res = await api.get<{
      success: boolean;
      data?: ResidentListItem[];
      pagination?: { totalPages?: number };
    }>('/resident/fetch', { params: { page, limit } });

    const list = res.data?.data ?? [];
    const match = list.find((r) => {
      if (opts.id != null && String(r.id) === String(opts.id)) return true;
      if (targetPhone && String(r.phone ?? '').replace(/\D/g, '') === targetPhone) return true;
      return false;
    });
    if (match) return match;

    const totalPages = res.data?.pagination?.totalPages ?? 1;
    if (page >= totalPages || list.length === 0) break;
    page += 1;
  }

  return null;
}

/** Residents assigned to a flat (`PUT /resident/fetch_by_flat/:flat_id`). */
export async function residentFetchByFlatId(flatId: string | number) {
  const res = await api.put<{ success: boolean; data?: ResidentListItem[] }>(
    `/resident/fetch_by_flat/${encodeURIComponent(String(flatId))}`
  );
  return res.data?.data ?? [];
}


export async function residentUpdate(id: string | number, data: ResidentUpdate, options?: ResidentUpdateOptions) {
  const useMultipart =
    (options?.profileImage != null && options.profileImage.uri != null) || options?.removeProfileImage === true;

  if (useMultipart) {
    const fd = new FormData();
    if (data.name != null) fd.append('name', data.name);
    if (data.email != null) fd.append('email', data.email);
    if (data.phone_number != null) fd.append('phone_number', data.phone_number);
    if (options?.removeProfileImage) {
      fd.append('remove_profile_image', '1');
    } else if (options?.profileImage?.uri) {
      fd.append('profile_image', {
        uri: options.profileImage.uri,
        type: options.profileImage.type || 'image/jpeg',
        name: options.profileImage.name || 'profile.jpg',
      } as any);
    }
    const path = `/resident/update/${id}`;
    return fetchMultipart<{ success: boolean; data?: unknown; message?: string }>(path, fd, 'PUT');
  }

  const res = await api.put<{ success: boolean; data?: unknown; message?: string }>(`/resident/update/${id}`, {
    ...data,
  });
  return res.data;
}

export async function residentLogout() {
  await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
}
