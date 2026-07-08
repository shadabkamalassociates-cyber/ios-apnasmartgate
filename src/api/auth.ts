import api from './client';

export type SendSignupOtpResponse = {
  message: string;
  hashOTP: string;
};

export type VerifyOtpResponse = {
  message: string;
};

/** Send OTP to phone for new resident signup (phone must not be registered). */
export async function sendSignupOtp(mobileNumber: string) {
  const res = await api.post<{ message: string; hashOTP?: string; otp?: string }>(
    '/auth/signUp-otp-sender-resident',
    { mobileNumber }
  );
  const hashOTP = res.data.hashOTP ?? res.data.otp;
  if (!hashOTP) {
    throw new Error(res.data.message || 'Failed to send OTP');
  }
  return { message: res.data.message, hashOTP };
}

/** Verify OTP against hash returned from sendSignupOtp. */
export async function verifySignupOtp(hashOTP: string, otp: string) {
  const res = await api.post<VerifyOtpResponse>('/auth/otp-check', {
    hashOTP,
    otp,
  });
  return res.data;
}

/** Request a password-reset email (`POST /auth/password-reset`). */
export async function requestPasswordReset(email: string) {
  const res = await api.post<{ message?: string }>('/auth/password-reset', { email });
  return res.data;
}
