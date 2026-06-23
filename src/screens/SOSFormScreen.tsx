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
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as sosApi from '../api/sos';
import ScreenBackHeader from '../components/ScreenBackHeader';

export default function SOSFormScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route: { params?: { society_id?: string; apartment_id?: string; onSaved?: () => void } };
}) {
  const { colors } = useTheme();
  const { user, refreshUser, loading: authLoading } = useAuth();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    let effectiveUser = user;

    // If user exists but `id` is missing (can happen before auth state fully syncs),
    // try to refresh auth before blocking the SOS action.
    if (effectiveUser?.id == null) {
      const refreshed = await refreshUser();
      effectiveUser = refreshed ?? effectiveUser;
    }

    if (effectiveUser?.id == null) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    if (effectiveUser.society_id == null || effectiveUser.flat_id == null) {
      Alert.alert(
        'Missing details',
        'Your profile is missing society or flat information. Please update your profile or contact your society admin.'
      );
      return;
    }
    setLoading(true);
    try {
      await sosApi.createSOS({
        society_id: effectiveUser.society_id,
        flat_id: effectiveUser.flat_id,
        title: 'Emergency SOS',
        created_by: effectiveUser.id,
        description: description.trim() || undefined,
      });
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to create SOS');
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  const handleBack = () => {
    if (!loading) navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenBackHeader title="Raise SOS" onBack={handleBack} backDisabled={loading} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Details..."
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
            editable={!loading && !authLoading}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              if (!loading) navigation.goBack();
            }}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
              disabled={loading || authLoading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send SOS</Text>}
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
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    buttonRow: {
      flexDirection: 'row',
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
    cancelButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cancelButtonText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  });
}
