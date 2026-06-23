import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';

const appVersion = require('../../package.json').version as string;

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const closeThen = (fn: () => void) => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      requestAnimationFrame(() => fn());
      return;
    }
    fn();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
              return;
            }
            navigation?.navigate?.('Main');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            closeThen(() =>
              navigation.navigate('Main', {
                screen: 'ProfileTab',
                params: { screen: 'Profile', params: { startEditing: true } },
              }),
            );
          }}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>Edit profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            closeThen(() => navigation.navigate('NotificationCheck'));
          }}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>Check notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            closeThen(() => navigation.navigate('CreateTicket', { kind: 'general' }));
          }}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="ticket-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>General ticket</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            closeThen(() => navigation.navigate('CreateTicket', { kind: 'bug' }));
          }}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="bug-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>Report a software bug</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.row, styles.rowDanger]}
          activeOpacity={0.75}
          onPress={() => {
            Alert.alert('Log out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log out',
                style: 'destructive',
                onPress: () => {
                  navigation?.canGoBack?.() && navigation.goBack();
                  logout();
                },
              },
            ]);
          }}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.rowIcon, styles.rowIconDanger]}>
              <Ionicons name="log-out-outline" size={18} color="#C14F2C" />
            </View>
            <Text style={[styles.rowText, styles.rowTextDanger]}>Log out</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>VERSION {appVersion}</Text>
    </View>
  );
}

function makeStyles(colors: {
  maincontainerbackground: string;
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
      paddingTop: 8,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    section: {
      padding: 16,
    },
    row: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      paddingRight: 8,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.maincontainerbackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    divider: {
      height: 10,
    },
    rowDanger: {
      borderColor: 'rgba(193, 79, 44, 0.35)',
    },
    rowIconDanger: {
      borderColor: 'rgba(193, 79, 44, 0.35)',
    },
    rowTextDanger: {
      color: '#C14F2C',
    },
    versionText: {
      textAlign: 'center',
      color: '#B7B0AA',
      fontSize: 12,
      letterSpacing: 1.4,
      marginTop: 2,
      marginBottom: 14,
    },
  });
}

