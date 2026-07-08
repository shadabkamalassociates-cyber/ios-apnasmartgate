import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import { getAuthToken } from '../lib/authTokenStorage';
import * as residentApi from '../api/resident';
import * as getpassApi from '../api/getpass';
import { getFCMToken } from '../services/fcm';
import { parseJwtPayload } from '../lib/jwt';
import { loadResidentProfile, writeProfileExtras, resolveResidenceInBackground, clearProfileExtras } from '../lib/residentProfile';
import { clearLocalProfileAvatar } from '../lib/localProfileAvatar';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setAuthUser, setAuthLoading, clearAuth } from '../store/authSlice';

export type AuthUser = {
  id?: string | number;
  email?: string;
  role?: string;
  name?: string;
  phone_number?: string;
  /** Society this resident belongs to, if provided by backend */
  society_id?: string | number | null;
  /** Flat/apartment id for this resident, if provided by backend */
  flat_id?: string | number | null;
  /** Server path for profile photo, e.g. `uploads/resident-profile-images/...` */
  profile_image?: string | null;
};

export const NOTIFICATION_PERMISSION_REQUIRED_CODE = 'NOTIFICATION_PERMISSION_REQUIRED' as const;

type AuthResult = { success: boolean; message?: string; code?: typeof NOTIFICATION_PERMISSION_REQUIRED_CODE };

type OtpResult = { success: boolean; message?: string; hashedOtp?: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendOtp: (phone: string) => Promise<OtpResult>;
  verifyOtpAndLogin: (phone: string, hashedOtp: string, otp: string) => Promise<AuthResult>;
  signUp: (data: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
    society_id?: string | number;
    flat_id?: string | number;
    profileImage?: { uri: string; type?: string; name?: string };
  }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  refreshUser: (phone?: string) => Promise<AuthUser | null>;
  validateSession: () => Promise<{ success: boolean; message?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const loading = useSelector((state: RootState) => state.auth.loading);

  const refreshUser = useCallback(async (phone?: string) => {
    const token = await getAuthToken();
    if (!token) {
      dispatch(clearAuth());
      return null;
    }
    try {
      const nextUser = await loadResidentProfile(phone);
      if (nextUser?.id != null) {
        dispatch(setAuthUser(nextUser));
        void resolveResidenceInBackground(nextUser.id, (extras) => {
          dispatch(
            setAuthUser({
              ...nextUser,
              society_id: nextUser.society_id ?? extras.society_id ?? null,
              flat_id: nextUser.flat_id ?? extras.flat_id ?? null,
            })
          );
        });
        return nextUser;
      }
    } catch {
      // Network / server error: keep existing user in Redux so data is not lost.
    }
    return null;
  }, [dispatch]);

  const validateSession = useCallback(async () => {
    return {
      success: true,
      message: 'Session validation disabled.',
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      dispatch(setAuthLoading(true));
      try {
        const token = await getAuthToken();
        if (!token) {
          if (!isMounted) return;
          dispatch(clearAuth());
          return;
        }
        await refreshUser();
      } catch {
        // On network / server error we also keep the existing Redux user, just stop the loading spinner.
      } finally {
        if (isMounted) {
          dispatch(setAuthLoading(false));
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
    // Run once on app start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const sendOtp = useCallback(async (phone: string): Promise<OtpResult> => {
    console.log('[Auth] sendOtp start', { phone });
    try {
      const res = await residentApi.residentSendOtp(phone);
      console.log('[Auth] sendOtp success', { phone, message: res?.message });
      return { success: true, hashedOtp: res.hashOTP, message: res.message };
    } catch (e: any) {
      console.log('[Auth] sendOtp error', {
        phone,
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
      });
      const apiMsg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.response?.data?.title ??
        undefined;
      return { success: false, message: apiMsg || 'Failed to send OTP' };
    }
  }, []);

  const verifyOtpAndLogin = useCallback(async (phone: string, hashedOtp: string, otp: string): Promise<AuthResult> => {
    const fcmToken = await getFCMToken({ requestPermission: Platform.OS !== 'ios' });
    if (!fcmToken && Platform.OS !== 'ios') {
      return {
        success: false,
        message: 'Notifications are required to sign in and receive society updates. Please enable notifications.',
        code: NOTIFICATION_PERMISSION_REQUIRED_CODE,
      };
    }

    // Verify OTP — backend issues JWT for registered residents when phone is sent.
    let verifyRes: { message?: string; token?: string };
    try {
      verifyRes = await residentApi.residentVerifyOtp(hashedOtp, otp, phone);
    } catch (e: any) {
      const apiMsg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.response?.data?.title ??
        undefined;
      return { success: false, message: apiMsg || 'Invalid OTP' };
    }

    if (!verifyRes.token) {
      return { success: false, message: verifyRes.message || 'Login failed' };
    }

    const nextUser = await loadResidentProfile(phone);
    if (nextUser?.id != null) {
      dispatch(setAuthUser(nextUser));
      void resolveResidenceInBackground(nextUser.id, (extras) => {
        dispatch(
          setAuthUser({
            ...nextUser,
            society_id: nextUser.society_id ?? extras.society_id ?? null,
            flat_id: nextUser.flat_id ?? extras.flat_id ?? null,
          })
        );
      });
    } else {
      const payload = parseJwtPayload(verifyRes.token);
      dispatch(
        setAuthUser({
          id: payload?.id,
          role: payload?.role,
          phone_number: phone,
        })
      );
    }

    const residentId = nextUser?.id ?? parseJwtPayload(verifyRes.token)?.id;

    if (residentId != null && fcmToken) {
      try {
        await getpassApi.updateFcmToken(residentId, fcmToken);
      } catch {
        // Best-effort: if token update fails, still allow login.
      }
    }

    return { success: true, message: verifyRes.message };
  }, [dispatch, refreshUser]);

  const signUp = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      phone_number: string;
      society_id?: string | number;
      flat_id?: string | number;
      profileImage?: { uri: string; type?: string; name?: string };
    }): Promise<AuthResult> => {
      const fcmToken = await getFCMToken({ requestPermission: Platform.OS !== 'ios' });
      if (!fcmToken && Platform.OS !== 'ios') {
        return {
          success: false,
          message:
            'Notifications are required to sign up and receive society updates. Please enable notifications.',
          code: NOTIFICATION_PERMISSION_REQUIRED_CODE,
        };
      }
      try {
        const res = await residentApi.residentSignUp({
          ...data,
          email: data.email.trim().toLowerCase(),
          ...(fcmToken
            ? { fcm_tokens: fcmToken, fcm_token: fcmToken, fcmToken }
            : {}),
          profileImage: data.profileImage,
        });
        if (res.success && res.token) {
          const signedUpUser = await loadResidentProfile(data.phone_number);
          const nextUser: AuthUser = signedUpUser ?? {
            id: parseJwtPayload(res.token)?.id,
            name: data.name,
            email: data.email.trim().toLowerCase(),
            phone_number: data.phone_number,
            society_id: data.society_id ?? null,
            flat_id: data.flat_id ?? null,
          };
          dispatch(setAuthUser(nextUser));
          if (nextUser.id != null) {
            await writeProfileExtras(nextUser.id, {
              society_id: nextUser.society_id,
              flat_id: nextUser.flat_id,
            });
          }
        }
        return { success: !!res.success, message: res.message };
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Sign up failed';
        return { success: false, message };
      }
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    await residentApi.residentLogout();
    dispatch(clearAuth());
  }, [dispatch]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (user?.id == null) {
      return { success: false, message: 'Your account id was not found. Please sign in again.' };
    }
    try {
      await residentApi.residentDelete(user.id);
      await clearLocalProfileAvatar(String(user.id));
      await clearProfileExtras(user.id);
      await residentApi.residentLogout();
      dispatch(clearAuth());
      return { success: true, message: 'Account deleted.' };
    } catch (e: any) {
      const apiMsg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        undefined;
      return { success: false, message: apiMsg || 'Failed to delete account' };
    }
  }, [dispatch, user?.id]);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    sendOtp,
    verifyOtpAndLogin,
    signUp,
    logout,
    deleteAccount,
    refreshUser,
    validateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
