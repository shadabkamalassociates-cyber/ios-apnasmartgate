import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { AxiosError } from 'axios';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as visitorApi from '../api/visitor';
import ScreenBackHeader from '../components/ScreenBackHeader';

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

export default function VisitorFormScreen({
  navigation,
  route,
}: {
  navigation: {
    goBack: () => void;
    navigate: (name: string, params?: object) => void;
    canGoBack?: () => boolean;
  };
  route: { params?: { onSaved?: () => void; source?: 'home' | 'visitors' } };
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleinfo, setVehicleinfo] = useState('');
  const [loading, setLoading] = useState(false);

  const getErrorMessage = (e: unknown) => {
    const ax = e as AxiosError<{ message?: string }>;
    const apiMsg = ax?.response?.data?.message;
    if (apiMsg) return apiMsg;
    if (ax?.message) return ax.message;
    return 'Failed to add visitor';
  };

  const handleSubmit = async () => {
    const cleanedPhone = sanitizePhoneInput(phone);

    if (!name.trim() || !cleanedPhone) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }
    if (cleanedPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be exactly 10 digits');
      return;
    }
    if (user?.flat_id == null || String(user.flat_id).trim() === '') {
      Alert.alert('Error', 'Your flat is missing for your account. Please login again.');
      return;
    }
    if (user?.society_id == null || String(user.society_id).trim() === '') {
      Alert.alert('Error', 'Society is missing for your account. Please login again.');
      return;
    }
    setLoading(true);
    try {
      const res = await visitorApi.createVisitor({
        name: name.trim(),
        phone: cleanedPhone,
        vehicleinfo: vehicleinfo.trim() || undefined,
        flat_id: user.flat_id,
        societyId: user.society_id,
      });
      const newId = res?.data?.id;
      if (newId) {
        await visitorApi.updateVisitorStatus(newId, 'approve');
      }
      route.params?.onSaved?.();
      // After save, always take the user to the visitors list screen.
      // - If we came from HomeTab, go back to the VisitorsTab screen.
      // - Otherwise, just switch within the Visitors stack.
      if (route.params?.source === 'home') {
        navigation.navigate('VisitorsTab', { screen: 'Visitors' } as any);
      } else {
        navigation.navigate('Visitors' as any);
      }
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  const dismissForm = () => {
    const source = route.params?.source;
    if (source === 'home') {
      navigation.navigate('VisitorsTab', { screen: 'Visitors' } as any);
      return;
    }
    navigation.navigate('Visitors' as any);
  };

  const handleBack = () => {
    if (loading) return;
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    dismissForm();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenBackHeader title="Add visitor" onBack={handleBack} backDisabled={loading} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Visitor name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone number"
          placeholderTextColor={colors.textSecondary}
          value={phone}
          onChangeText={(v) => setPhone(sanitizePhoneInput(v))}
          keyboardType="phone-pad"
          maxLength={10}
          editable={!loading}
        />
        <Text style={styles.label}>Vehicle info (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Vehicle number or details"
          placeholderTextColor={colors.textSecondary}
          value={vehicleinfo}
          onChangeText={setVehicleinfo}
          editable={!loading}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add visitor</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: { background: string; text: string; textSecondary: string; surface: string; primary: string; border: string }) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 20, paddingBottom: 40 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      gap: 12,
    },
    button: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    secondaryButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  });
}
