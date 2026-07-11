import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { updateVisitorStatus, findWaitingAttendance } from '../api/visitor';

type Props = NativeStackScreenProps<RootStackParamList, 'ApproveDeny'>;

export default function ApproveDenyScreen({ route, navigation }: Props) {
  const { visitorName, requestId, actionId, phone, flat, vehicle } = route.params;
  const { user } = useAuth();

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
      .catch(() => {})
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Resolving Request...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Glow */}
      <LinearGradient
        colors={['rgba(255, 107, 0, 0.25)', 'transparent']}
        style={styles.backgroundGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      
      {/* Concentric Circles using Borders */}
      <View style={styles.concentricCircle1} />
      <View style={styles.concentricCircle2} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={goBack} disabled={loading}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.societyName}>Green Valley Society</Text>
              <Text style={styles.gateName}>Gate 1</Text>
            </View>
            <View style={{ width: 40 }} /> {/* Placeholder for alignment */}
          </View>

          {/* Shield Icon */}
          <View style={styles.shieldWrapper}>
            <LinearGradient
              colors={['#FF6B00', '#B93E00']}
              style={styles.shieldGradient}
            >
              <Ionicons name="shield-half-outline" size={40} color="#FFF" />
            </LinearGradient>
            <View style={styles.shieldRing} />
          </View>

          <Text style={styles.pageTitle}>
            Visitor Entry <Text style={styles.pageTitleHighlight}>Request</Text>
          </Text>
          <Text style={styles.pageSubtitle}>A visitor is waiting at the gate</Text>

          {/* Main Card */}
          <View style={styles.card}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{visitorName.charAt(0).toUpperCase()}</Text>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#FFF" />
                </View>
              </View>
              <Text style={styles.visitorName}>{visitorName}</Text>
              <View style={styles.visitorBadge}>
                <Ionicons name="person-outline" size={12} color="#4ADE80" />
                <Text style={styles.visitorBadgeText}>Personal Visitor</Text>
              </View>
            </View>

            {/* Info List */}
            <View style={styles.infoList}>
              {visitorPhone ? <InfoRow icon="call-outline" label="Phone" value={visitorPhone} /> : null}
              {flat ? <InfoRow icon="home-outline" label="Flat / Resident" value={flat} /> : null}
              {visitorVehicle ? <InfoRow icon="car-outline" label="Vehicle" value={visitorVehicle} /> : null}
              <InfoRow icon="time-outline" label="Request Time" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            </View>
          </View>

          {/* Warning Box */}
          <View style={styles.warningBox}>
            <View style={styles.warningIconContainer}>
              <Ionicons name="shield-checkmark" size={24} color="#EF4444" />
            </View>
            <View style={styles.warningTextCol}>
              <Text style={styles.warningTextMain}>Please verify the details before approving</Text>
              <Text style={styles.warningTextSub}>Your action will be recorded</Text>
            </View>
          </View>

          {/* Action Buttons or Result */}
          {result ? (
            <View style={styles.resultContainer}>
              <Ionicons
                name={result === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={54}
                color={result === 'approved' ? '#22C55E' : '#EF4444'}
              />
              <Text style={[styles.resultText, { color: result === 'approved' ? '#22C55E' : '#EF4444' }]}>
                {result === 'approved' ? 'Approved successfully' : 'Denied successfully'}
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={goBack}>
                <Text style={styles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnDeny, loading && { opacity: 0.7 }]}
                onPress={() => handleAction('deny')}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <View style={[styles.btnIconWrapper, { borderColor: '#FFF' }]}>
                      <Ionicons name="close" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.btnText}>Denied</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnApprove, loading && { opacity: 0.7 }]}
                onPress={() => handleAction('approve')}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <View style={[styles.btnIconWrapper, { borderColor: '#FFF' }]}>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.btnText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="lock-closed" size={14} color="#22C55E" />
            <Text style={styles.footerText}>Secure • Verified • Safe Community</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrapper}>
        <Ionicons name={icon} size={18} color="#FF6B00" />
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  backgroundGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  concentricCircle1: {
    position: 'absolute',
    top: -50,
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.15)',
  },
  concentricCircle2: {
    position: 'absolute',
    top: -150,
    alignSelf: 'center',
    width: 500,
    height: 500,
    borderRadius: 250,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.1)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitles: {
    alignItems: 'center',
  },
  societyName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  gateName: {
    color: '#FF6B00',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  shieldWrapper: {
    alignSelf: 'center',
    marginTop: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  shieldRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 0, 0.3)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
  },
  pageTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 24,
  },
  pageTitleHighlight: {
    color: '#FF6B00',
  },
  pageSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.4)',
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#27272A',
    borderWidth: 2,
    borderColor: '#3F3F46',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '700',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#18181B',
  },
  visitorName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  visitorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  visitorBadgeText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoIconWrapper: {
    width: 32,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  warningTextCol: {
    flex: 1,
  },
  warningTextMain: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  warningTextSub: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
  },
  btnDeny: {
    backgroundColor: '#EF4444',
  },
  btnApprove: {
    backgroundColor: '#22C55E',
  },
  btnIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
  },
  doneBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  doneBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#A1A1AA',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
});
