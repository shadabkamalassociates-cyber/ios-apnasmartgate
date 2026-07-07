import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Linking,
  AppState,
} from 'react-native';
// import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { useTheme, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import ScreenBackHeader from '../components/ScreenBackHeader';
import { requestNotificationPermission } from '../services/fcm';
// import { getFCMToken } from '../services/fcm';
import { ensureGatePassChannel, showGatePassNotification } from '../services/visitorNotification';
import {
  isBatteryOptimizationDisabled,
  requestIgnoreBatteryOptimization,
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
} from '../services/visitorLaunchBridge';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationCheck'>;

type CheckStatus = 'idle' | 'checking' | 'pass' | 'fail' | 'warn';

type DiagnosticItem = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
};

export default function NotificationCheckScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    { id: 'network', label: 'Network Connectivity', status: 'idle' },
    { id: 'permission', label: 'Notification Permission', status: 'idle' },
    ...(Platform.OS === 'android'
      ? [{ id: 'fullscreen', label: 'Full-Screen Notifications', status: 'idle' as CheckStatus }]
      : []),
    // { id: 'token', label: 'FCM Token', status: 'idle' },
    { id: 'battery', label: 'Battery Optimization', status: 'idle' },
    ...(Platform.OS === 'android'
      ? [{ id: 'power_manager', label: 'Power Manager', status: 'idle' as CheckStatus }]
      : []),
    { id: 'sound', label: 'Notification Sound', status: 'idle' },
  ]);
  // const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const updateItem = useCallback(
    (id: string, update: Partial<DiagnosticItem>) => {
      setDiagnostics((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...update } : d)),
      );
    },
    [],
  );

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    // setFcmToken(null);

    for (const d of diagnostics) {
      updateItem(d.id, { status: 'checking', detail: undefined });
    }

    // 1. Network check
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      updateItem('network', { status: 'pass', detail: 'Connected' });
    } catch {
      updateItem('network', {
        status: 'fail',
        detail: 'No internet. Tap to open Wi-Fi settings.',
      });
    }

    // 2. Notification permission
    try {
      const authStatus = await messaging().hasPermission();
      const authorized =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (authorized) {
        updateItem('permission', { status: 'pass', detail: 'Granted' });
      } else {
        updateItem('permission', {
          status: 'fail',
          detail: 'Denied. Tap to enable notifications.',
        });
      }
    } catch {
      updateItem('permission', {
        status: 'fail',
        detail: 'Unable to check. Tap to open settings.',
      });
    }

    // 3. Full-screen intent permission (Android 14+)
    if (Platform.OS === 'android') {
      try {
        const allowed = await canUseFullScreenIntent();
        if (allowed) {
          updateItem('fullscreen', {
            status: 'pass',
            detail: 'Allowed. Visitor alerts will show on lock screen.',
          });
        } else {
          updateItem('fullscreen', {
            status: 'fail',
            detail: 'Disabled. Visitor alerts won\'t show on lock screen. Tap to enable.',
          });
        }
      } catch {
        updateItem('fullscreen', {
          status: 'warn',
          detail: 'Could not check. Tap to verify manually.',
        });
      }
    }

    // // 4. FCM token
    // try {
    //   const token = await getFCMToken();
    //   if (token) {
    //     setFcmToken(token);
    //     updateItem('token', {
    //       status: 'pass',
    //       detail: `${token.slice(0, 20)}…`,
    //     });
    //   } else {
    //     updateItem('token', {
    //       status: 'fail',
    //       detail: 'Could not retrieve token. Tap to fix permissions.',
    //     });
    //   }
    // } catch {
    //   updateItem('token', {
    //     status: 'fail',
    //     detail: 'Error fetching token. Tap to fix permissions.',
    //   });
    // }

    // 4. Standard Android battery optimization (using native PowerManager for reliability)
    if (Platform.OS === 'android') {
      try {
        const isDisabled = await isBatteryOptimizationDisabled();
        if (isDisabled) {
          updateItem('battery', {
            status: 'pass',
            detail: 'Disabled (unrestricted).',
          });
        } else {
          updateItem('battery', {
            status: 'fail',
            detail: 'Battery optimization is ON. Tap to disable it.',
          });
        }
      } catch {
        updateItem('battery', {
          status: 'warn',
          detail: 'Could not detect status. Tap to check manually.',
        });
      }

      // 5. Manufacturer-specific power manager (Xiaomi, Samsung, Oppo, etc.)
      try {
        const pmInfo = await notifee.getPowerManagerInfo();
        if (pmInfo.activity) {
          updateItem('power_manager', {
            status: 'warn',
            detail: `${pmInfo.manufacturer ?? 'Your phone'} has extra battery restrictions. Tap to open and set this app to Unrestricted.`,
          });
        } else {
          updateItem('power_manager', {
            status: 'pass',
            detail: 'No extra manufacturer restrictions detected.',
          });
        }
      } catch {
        updateItem('power_manager', {
          status: 'pass',
          detail: 'No extra manufacturer restrictions detected.',
        });
      }
    } else {
      updateItem('battery', {
        status: 'pass',
        detail: 'Not applicable on iOS.',
      });
    }

    // 6. Notification sound / channel readiness
    try {
      await ensureGatePassChannel();
      if (Platform.OS === 'android') {
        const channels = await notifee.getChannels();
        const gateChannel = channels.find((c) => c.id === 'mygate');
        if (gateChannel) {
          updateItem('sound', {
            status: 'pass',
            detail: `Channel "${gateChannel.name}" ready.`,
          });
        } else {
          updateItem('sound', {
            status: 'fail',
            detail: 'Notification channel missing. Tap to open settings.',
          });
        }
      } else {
        // iOS uses notification categories (set up in ensureGatePassChannel) rather than channels.
        updateItem('sound', {
          status: 'pass',
          detail: 'Notification category configured.',
        });
      }
    } catch {
      updateItem('sound', {
        status: 'warn',
        detail: 'Could not verify channel. Tap to check manually.',
      });
    }

    setRunning(false);
  }, [diagnostics, updateItem]);

  const openWifiSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() =>
        Linking.openSettings(),
      );
    } else {
      Linking.openURL('App-Prefs:WIFI').catch(() => Linking.openSettings());
    }
  };

  const openNotificationSettings = async () => {
    // First try requesting permission directly
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        updateItem('permission', { status: 'pass', detail: 'Granted' });
        return;
      }
    } catch {
      // fall through to open settings
    }

    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: 'com.kamalsociety' },
      ]).catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  };

  const pendingBatteryRecheck = useRef(false);
  const pendingFullscreenRecheck = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      if (pendingBatteryRecheck.current) {
        pendingBatteryRecheck.current = false;
        try {
          const isDisabled = await isBatteryOptimizationDisabled();
          updateItem('battery', {
            status: isDisabled ? 'pass' : 'fail',
            detail: isDisabled
              ? 'Disabled (unrestricted).'
              : 'Battery optimization is ON. Tap to disable it.',
          });
        } catch { /* ignore */ }
      }

      if (pendingFullscreenRecheck.current) {
        pendingFullscreenRecheck.current = false;
        try {
          const allowed = await canUseFullScreenIntent();
          updateItem('fullscreen', {
            status: allowed ? 'pass' : 'fail',
            detail: allowed
              ? 'Allowed. Visitor alerts will show on lock screen.'
              : 'Disabled. Visitor alerts won\'t show on lock screen. Tap to enable.',
          });
        } catch { /* ignore */ }
      }
    });
    return () => sub.remove();
  }, [updateItem]);

  const openBatterySettings = async () => {
    if (Platform.OS === 'android') {
      try {
        const alreadyDisabled = await requestIgnoreBatteryOptimization();
        if (alreadyDisabled) {
          updateItem('battery', { status: 'pass', detail: 'Disabled (unrestricted).' });
        } else {
          pendingBatteryRecheck.current = true;
        }
      } catch {
        Linking.openSettings();
      }
    }
  };

  const openPowerManagerSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await notifee.openPowerManagerSettings();
      } catch {
        Linking.openSettings();
      }
    }
  };

  const handleItemPress = (item: DiagnosticItem) => {
    if (item.status !== 'fail' && item.status !== 'warn') {
      // if (item.id === 'token' && fcmToken) {
      //   copyToken();
      // }
      return;
    }

    switch (item.id) {
      case 'network':
        openWifiSettings();
        break;
      case 'permission':
        openNotificationSettings();
        break;
      case 'fullscreen':
        pendingFullscreenRecheck.current = true;
        openFullScreenIntentSettings().catch(() => Linking.openSettings());
        break;
      // case 'token':
      //   openNotificationSettings();
      //   break;
      case 'battery':
        openBatterySettings();
        break;
      case 'power_manager':
        openPowerManagerSettings();
        break;
      case 'sound':
        if (Platform.OS === 'android') {
          Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
            { key: 'android.provider.extra.APP_PACKAGE', value: 'com.kamalsociety' },
            { key: 'android.provider.extra.CHANNEL_ID', value: 'mygate' },
          ]).catch(() => Linking.openSettings());
        } else {
          Linking.openSettings();
        }
        break;
    }
  };

  // const copyToken = () => {
  //   if (fcmToken) {
  //     Clipboard.setString(fcmToken);
  //     Alert.alert('Copied', 'FCM token copied to clipboard.');
  //   }
  // };

  const sendTestNotification = async () => {
    try {
      await showGatePassNotification({
        messageId: `test-${Date.now()}`,
        data: {
          screen: 'ApproveDeny',
          visitorName: 'Test Visitor',
          requestId: `test_${Date.now()}`,
          title: 'Test Visitor Alert',
          body: 'Test Visitor is waiting at the gate',
          name: 'Test Visitor',
          flat: 'A-101',
          phone: '9876543210',
          vehicle: 'MH-01-AB-1234',
        },
      } as any);
      const hint =
        Platform.OS === 'ios'
          ? 'Test notification sent. On the lock screen, long-press (or pull down) the notification to reveal Approve / Deny.'
          : 'Test notification sent. Check your notification shade or lock screen.';
      Alert.alert('Sent', hint);
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to send test notification.');
    }
  };

  const statusIcon = (status: CheckStatus) => {
    switch (status) {
      case 'pass':
        return <Ionicons name="checkmark-circle" size={24} color={colors.success} />;
      case 'fail':
        return <Ionicons name="close-circle" size={24} color={colors.error} />;
      case 'warn':
        return <Ionicons name="warning" size={24} color="#F59E0B" />;
      case 'checking':
        return <ActivityIndicator size="small" color={colors.primary} />;
      default:
        return <Ionicons name="ellipse-outline" size={24} color={colors.textSecondary} />;
    }
  };

  return (
    <View style={styles.container}>
      <ScreenBackHeader
        title="Notification Diagnostics"
        onBack={() => navigation.goBack()}
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {diagnostics.map((item) => {
          const tappable =
            item.status === 'fail' ||
            item.status === 'warn';

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.diagnosticCard,
                tappable && styles.diagnosticCardTappable,
              ]}
              activeOpacity={tappable ? 0.6 : 1}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.diagnosticRow}>
                {statusIcon(item.status)}
                <View style={styles.diagnosticText}>
                  <Text style={styles.diagnosticLabel}>{item.label}</Text>
                  {item.detail ? (
                    <Text
                      style={[
                        styles.diagnosticDetail,
                        tappable && item.status !== 'pass' && styles.diagnosticDetailTappable,
                      ]}
                    >
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
                {/* {item.id === 'token' && fcmToken ? (
                  <TouchableOpacity onPress={copyToken} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="copy-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ) : */}{tappable && item.status !== 'pass' ? (
                  <Ionicons name="open-outline" size={18} color={colors.primary} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.runButton, running && styles.runButtonDisabled]}
          onPress={runDiagnostics}
          disabled={running}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.runButtonText}>Run Diagnostics</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, running && styles.runButtonDisabled]}
          onPress={sendTestNotification}
          disabled={running}
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <Text style={styles.runButtonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
    },
    scroll: {
      padding: 16,
      paddingBottom: 40,
    },
    diagnosticCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    diagnosticRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    diagnosticText: {
      flex: 1,
    },
    diagnosticLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    diagnosticCardTappable: {
      borderColor: colors.primary,
    },
    diagnosticDetail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    diagnosticDetailTappable: {
      color: colors.primary,
      fontWeight: '600',
    },
    runButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    testButton: {
      backgroundColor: '#16A34A',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    runButtonDisabled: {
      opacity: 0.6,
    },
    runButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
