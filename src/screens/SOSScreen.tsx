import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as sosApi from '../api/sos';
import type { SOSAlert } from '../api/sos';
import { formatDateTime12hTimeFirst } from '../lib/datetime';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ScreenBackHeader from '../components/ScreenBackHeader';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';
import { navigateToTab } from '../navigation/navigateToTab';

export default function SOSScreen({
  navigation,
}: {
  navigation: {
    navigate: (a: string, p?: object) => void;
    goBack: () => void;
    canGoBack?: () => boolean;
  };
}) {
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [list, setList] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feed, setFeed] = useState<'all' | 'mine'>('all');
  const societyId = user?.society_id != null ? String(user.society_id) : '';

  const load = async () => {
    if (authLoading) return;
    const userId = user?.id;

    if (feed === 'mine' && userId == null) {
      setList([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (feed === 'all' && !societyId) {
      setList([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res =
        feed === 'mine'
          ? await sosApi.getSOSByUser(userId as string | number)
          : await sosApi.getSOSBySociety(societyId);

      const data = (res as { data?: SOSAlert[] })?.data ?? [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [feed, societyId, authLoading, user?.id]);

  const onRefresh = () => {
    if (feed === 'all' && !societyId) return;
    if (feed === 'mine' && user?.id == null) return;
    setRefreshing(true);
    load();
  };

  const styles = makeStyles(colors);

  const handleBack = () => goBackOrNavigate(navigation, 'Home');

  const handleResolveSOS = async (item: SOSAlert) => {
    try {
      setActionLoading(true);
      await sosApi.updateSOS(item.id, 'RESOLVED');
      await load();
    } catch {
      // Keep UI simple here; HomeScreen shows an alert.
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSOS = async (item: SOSAlert) => {
    try {
      setActionLoading(true);
      await sosApi.deleteSOS(item.id);
      await load();
    } catch {
      // Keep UI simple here; HomeScreen shows an alert.
    } finally {
      setActionLoading(false);
    }
  };

  const raiseSosButton = (
    <TouchableOpacity
      style={styles.addBtn}
      onPress={() => navigation.navigate('SOSForm', { onSaved: load })}
    >
      <Text style={styles.addBtnText}>+ Raise SOS</Text>
    </TouchableOpacity>
  );

  if (authLoading || loading) {
    return (
      <View style={styles.container}>
        <ScreenBackHeader title="SOS" onBack={handleBack} style={styles.headerDivider} />
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackHeader title="SOS" onBack={handleBack} right={raiseSosButton} style={styles.headerDivider} />
      <View style={styles.switcherWrap}>
        <View style={styles.switcher}>
          <Pressable
            style={[styles.switcherBtn, feed === 'all' && styles.switcherBtnActive]}
            onPress={() => setFeed('all')}
          >
            <Text style={[styles.switcherText, feed === 'all' && styles.switcherTextActive]}>
              All SOS
            </Text>
          </Pressable>
          <Pressable
            style={[styles.switcherBtn, feed === 'mine' && styles.switcherBtnActive]}
            onPress={() => setFeed('mine')}
          >
            <Text style={[styles.switcherText, feed === 'mine' && styles.switcherTextActive]}>
              My SOS
            </Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {feed === 'all' && !societyId ? (
              <>
                <Text style={styles.emptyText}>Society not set in your profile</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigateToTab(navigation, 'ProfileTab')}
                >
                  <Text style={styles.emptyBtnText}>Go to Profile</Text>
                </TouchableOpacity>
              </>
            ) : feed === 'mine' ? (
              <Text style={styles.emptyText}>You have not raised SOS yet.</Text>
            ) : (
              <Text style={styles.emptyText}>No SOS alerts yet.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.sosCard}>
            {(() => {
              const createdByMe =
                user?.id != null && item.created_by?.id != null && String(item.created_by.id) === String(user.id);
              // In "My SOS", we want actions available for items created by the current user.
              // (Flat-id matching can be missing/inconsistent in some backend responses.)
              const canEditSOS = createdByMe;
              const isResolved = item.status === 'RESOLVED';
              const badgeLabel = isResolved ? 'RESOLVED' : 'ACTIVE';

              const flatNumber = item.flat?.flat_number ? String(item.flat.flat_number) : null;
              const floor = item.flat?.floor != null ? String(item.flat.floor) : null;

              const location = flatNumber
                ? `Flat ${flatNumber}${floor ? ` • Floor ${floor}` : ''}`
                : null;

              const descriptionText = item.description?.trim() ? item.description.trim() : null;
              const subtitle = descriptionText ?? `SOS active${location ? ` in ${location}` : ''}`;

              const title = createdByMe
                ? 'Home'
                : flatNumber
                  ? `Flat ${flatNumber}${floor ? ` • Floor ${floor}` : ''}`
                  : 'SOS alert';

              return (
                <>
                  <View style={styles.sosCardHeader}>
                    <Text style={styles.sosCardTitle}>{title}</Text>
                    <Text
                      style={[
                        styles.sosStatusBadge,
                        isResolved ? styles.sosStatusResolved : styles.sosStatusActive,
                      ]}
                    >
                      {badgeLabel}
                    </Text>
                  </View>

                  <Text style={styles.sosCardSubtitle}>{subtitle}</Text>

                  {item.created_at ? (
                    <View style={styles.sosCardTimeRow}>
                      <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                      <Text style={styles.sosDate}>{formatDateTime12hTimeFirst(item.created_at)}</Text>
                    </View>
                  ) : null}

                  {feed === 'mine' ? (
                    <View style={styles.sosCardFooter}>
                      {!isResolved ? (
                        <TouchableOpacity
                          onPress={() => handleResolveSOS(item)}
                          style={styles.sosActionBtn}
                          disabled={actionLoading}
                        >
                          <Text style={styles.sosActionText}>Mark resolved</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                      <TouchableOpacity
                        onPress={() => handleDeleteSOS(item)}
                        style={styles.sosDeleteBtn}
                        disabled={actionLoading}
                      >
                        <Text style={styles.sosDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View pointerEvents="none" style={styles.sosBottomGradientWrapper}>
                    <LinearGradient
                      style={styles.sosBottomGradientBar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={isResolved ? ['#16A34A', '#15803D'] : ['#FF6A00', '#572400']}
                    />
                  </View>
                </>
              );
            })()}
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: {
  background: string;
  text: string;
  textSecondary: string;
  surface: string;
  primary: string;
  border: string;
}) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    centered: { justifyContent: 'center', alignItems: 'center' },
    headerDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    listContent: { padding: 16, paddingBottom: 32 },

    switcherWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
    switcher: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    switcherBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
    switcherBtnActive: { backgroundColor: colors.primary },
    switcherText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    switcherTextActive: { color: '#fff' },

    // Home-like SOS card styles
    sosCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 4,
      elevation: 4,
    },
    sosBottomGradientWrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 4,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      overflow: 'hidden',
    },
    sosBottomGradientBar: { flex: 1 },

    sosCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sosCardTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.2,
    },
    sosStatusBadge: {
      fontSize: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      color: '#B45309',
      backgroundColor: '#FFE7D0',
      overflow: 'hidden',
      fontWeight: '800',
    },
    sosStatusActive: {
      backgroundColor: '#FFE7D0',
      color: '#D35400',
    },
    sosStatusResolved: {
      backgroundColor: '#D1FAE5',
      color: '#15803D',
    },
    sosCardSubtitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    sosCardTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sosDate: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    sosCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    sosActionBtn: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 14,
      alignItems: 'center',
    },
    sosActionText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '700',
    },
    sosDeleteBtn: {
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    sosDeleteText: {
      fontSize: 16,
      color: '#B91C1C',
      fontWeight: '800',
    },

    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: colors.textSecondary, paddingVertical: 8, marginBottom: 16 },
    emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    emptyBtnText: { color: '#fff', fontWeight: '600' },
  });
}
