import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme';
import { useAuth, NOTIFICATION_PERMISSION_REQUIRED_CODE } from '../../context/AuthContext';
import { openAppSettings } from '../../services/fcm';

type LoginStep = 'phone' | 'otp';

export default function LoginScreen({ navigation }: { navigation: { navigate: (n: string) => void } }) {
  const { colors } = useTheme();
  const { sendOtp, verifyOtpAndLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [hashedOtp, setHashedOtp] = useState('');
  const [step, setStep] = useState<LoginStep>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(cleanPhone);
      if (res.success && res.hashedOtp) {
        setHashedOtp(res.hashedOtp);
        setStep('otp');
      } else {
        Alert.alert('Error', res.message || 'Failed to send OTP');
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = phone.trim().replace(/\D/g, '');
      const res = await verifyOtpAndLogin(cleanPhone, hashedOtp, otp);
      if (res.success) {
        // Navigation will switch to main app via auth state
      } else if (res.code === NOTIFICATION_PERMISSION_REQUIRED_CODE) {
        setLoading(false);
        Alert.alert(
          'Notifications required',
          res.message ||
            'Notifications are required to sign in and receive society updates. Please enable them to continue.',
          [
            { text: 'Try again', onPress: () => handleVerifyOtp() },
            { text: 'Open Settings', onPress: () => openAppSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      } else {
        Alert.alert('Login failed', res.message || 'Invalid OTP');
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setHashedOtp('');
  };

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'Sign in to your resident account'
            : `Enter OTP sent to +91 ${phone}`}
        </Text>

        {step === 'phone' ? (
          <>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone Number"
                placeholderTextColor={colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={colors.textSecondary}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Sign in</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendContainer}
              onPress={handleSendOtp}
              disabled={loading}
            >
              <Text style={[styles.resendText, { color: colors.primary }]}>
                Resend OTP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              disabled={loading}
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                ← Change phone number
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('SignUp')}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Don't have an account? Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: { text: string; textSecondary: string; border: string; surface: string; primary: string; background: string }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    form: {
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 32,
    },
    phoneInputContainer: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    countryCode: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      marginRight: 8,
      justifyContent: 'center',
    },
    countryCodeText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    phoneInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 20,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: 16,
      textAlign: 'center',
      letterSpacing: 8,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    resendContainer: {
      marginTop: 16,
      alignItems: 'center',
    },
    resendText: {
      fontSize: 16,
      fontWeight: '500',
    },
    backButton: {
      marginTop: 12,
      alignItems: 'center',
    },
    backText: {
      fontSize: 14,
    },
    link: {
      marginTop: 24,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
