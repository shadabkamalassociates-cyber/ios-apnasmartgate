import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as chatApi from '../api/chat';
import { useAuth } from '../context/AuthContext';
import { resolveBackendFileUrl } from '../lib/backendFileUrl';
import type { ProfileStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

function formatChatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatInboxScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<chatApi.ChatRow[]>([]);

  const load = useCallback(async () => {
    if (user?.id == null) {
      setChats([]);
      return;
    }
    try {
      const res = await chatApi.fetchInbox(user.id);
      if (!res?.success) throw new Error(res?.message || 'Failed to load chats');
      setChats(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setChats([]);
      Alert.alert('Error', (e as Error).message || 'Failed to load chats');
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [chats]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrNavigate(navigation, 'Profile')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Loading conversations…</Text>
        </View>
      ) : sortedChats.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.hint}>Message a vendor from a service page to start chatting.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Reload</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedChats}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const title = (item.vendor_name || 'Vendor').trim();
            const avatarUri = resolveBackendFileUrl(item.vendor_profile_image, {
              fallbackUploadsPrefix: '/uploads/',
            });
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('Chat', {
                    chatId: item.id,
                    vendorId: item.vendor_id,
                    vendorName: title,
                    vendorProfileImage: item.vendor_profile_image ?? null,
                  })
                }
                style={styles.row}
              >
                <View style={styles.avatar}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name="storefront-outline" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {title}
                    </Text>
                    {item.created_at ? (
                      <Text style={styles.date}>{formatChatDate(item.created_at)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    Tap to open chat
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: {
  text: string;
  textSecondary: string;
  surface: string;
  primary: string;
  border: string;
  maincontainerbackground: string;
}) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
    emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
    hint: { color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
    retryBtn: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    retryText: { color: '#fff', fontWeight: '800' },
    list: { padding: 16, paddingBottom: 32, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(232, 93, 4, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    name: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 },
    date: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
    meta: { marginTop: 4, color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  });
}
