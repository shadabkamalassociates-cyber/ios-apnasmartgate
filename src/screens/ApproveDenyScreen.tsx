import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { updateVisitorStatus, findWaitingAttendance } from '../api/visitor';

type Props = NativeStackScreenProps<RootStackParamList, 'ApproveDeny'>;

export default function ApproveDenyScreen({ route, navigation }: Props) {
  const { visitorName, requestId, actionId, phone, flat, vehicle } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [attendanceId, setAttendanceId] = useState<number | null>(null);
  const [visitorPhone, setVisitorPhone] = useState(phone);
  const [visitorVehicle, setVisitorVehicle] = useState(vehicle);
  const [result, setResult] = useState<'approved' | 'denied' | null>(null);

  useEffect(() => {
    if (user?.flat_id == null) {
      setResolving(false);
      return;
    }

    findWaitingAttendance(requestId, visitorName, user.flat_id)
      .then((match) => {
        if (match) {
          setAttendanceId(match.attendanceId);
          if (!phone && match.visitor?.phone) setVisitorPhone(match.visitor.phone);
          if (!vehicle && match.visitor?.vehicleinfo) setVisitorVehicle(match.visitor.vehicleinfo);
        }
      })
      .catch(() => { })
      .finally(() => setResolving(false));
  }, [requestId, visitorName, user?.flat_id, phone, vehicle]);

  useEffect(() => {
    if (resolving) return;
    if (actionId !== 'approve' && actionId !== 'deny') return;

    const id = attendanceId;
    if (!id) {
      setResult(actionId === 'approve' ? 'approved' : 'denied');
      return;
    }

    setLoading(true);
    const status = actionId === 'approve' ? 'approve' : 'unapprove';
    updateVisitorStatus(id, status)
      .then(() => setResult(actionId === 'approve' ? 'approved' : 'denied'))
      .catch((e: any) => {
        const msg =
          e?.response?.data?.message ??
          e?.response?.data?.error ??
          e?.message ??
          `Failed to ${actionId} visitor`;
        Alert.alert('Error', msg);
      })
      .finally(() => setLoading(false));
  }, [resolving, actionId, attendanceId]);

  const handleAction = useCallback(async (action: 'approve' | 'deny') => {
    const id = attendanceId;
    if (!id) {
      Alert.alert('Error', 'Could not find the visitor attendance record.');
      return;
    }
    setLoading(true);
    try {
      const status = action === 'approve' ? 'approve' : 'unapprove';
      await updateVisitorStatus(id, status);
      setResult(action === 'approve' ? 'approved' : 'denied');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        `Failed to ${action} visitor`;
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [attendanceId]);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  if (resolving) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.title, { marginTop: 16 }]}>Loading visitor details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.screenBackBtn}
        onPress={goBack}
        disabled={loading}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {visitorName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.title}>Visitor Entry Request</Text>

        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label="Name" value={visitorName} colors={colors} />
          {visitorPhone ? <InfoRow icon="call-outline" label="Phone" value={visitorPhone} colors={colors} /> : null}
          {flat ? <InfoRow icon="home-outline" label="Flat" value={flat} colors={colors} /> : null}
          {visitorVehicle ? <InfoRow icon="car-outline" label="Vehicle" value={visitorVehicle} colors={colors} /> : null}
        </View>

        {result ? (
          <View style={styles.resultContainer}>
            <Ionicons
              name={result === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color={result === 'approved' ? colors.success : colors.error}
            />
            <Text
              style={[
                styles.resultText,
                { color: result === 'approved' ? colors.success : colors.error },
              ]}
            >
              {result === 'approved' ? 'Visitor Approved' : 'Visitor Denied'}
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={goBack}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.approveButton, loading && styles.buttonDisabled]}
              onPress={() => handleAction('approve')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.approveButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.denyButton, loading && styles.buttonDisabled]}
              onPress={() => handleAction('deny')}
              disabled={loading}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              <Text style={[styles.denyButtonText, { color: colors.error }]}>Deny</Text>
            </TouchableOpacity>
          </View>
        )}

        {!result && (
          <TouchableOpacity style={styles.backLink} onPress={goBack}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={infoStyles.icon} />
      <View style={infoStyles.textCol}>
        <Text style={[infoStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[infoStyles.value, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  icon: { marginRight: 12, width: 22, textAlign: 'center' },
  textCol: { flex: 1 },
  label: { fontSize: 12, fontWeight: '500', marginBottom: 1 },
  value: { fontSize: 15, fontWeight: '600' },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    screenBackBtn: {
      position: 'absolute',
      top: 54,
      left: 20,
      zIndex: 2,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceVariant,
    },
    card: {
      flex: 1,
      width: '100%',
      backgroundColor: colors.surface,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarLetter: {
      color: '#fff',
      fontSize: 32,
      fontWeight: '800',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    infoCard: {
      width: '100%',
      backgroundColor: colors.surfaceVariant,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 24,
    },
    actionsContainer: {
      width: '100%',
      gap: 12,
    },
    approveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 14,
    },
    approveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    denyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 14,
      borderWidth: 1.5,
      borderColor: colors.error,
    },
    denyButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    resultContainer: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    resultText: {
      fontSize: 18,
      fontWeight: '800',
    },
    doneButton: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 40,
    },
    doneButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    backLink: {
      marginTop: 16,
      paddingVertical: 8,
    },
    backLinkText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}
