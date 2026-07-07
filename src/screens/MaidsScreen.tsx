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
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import type { ProfileStackParamList } from '../navigation/types';
import * as maidApi from '../api/maid';
import { resolveBackendFileUrl } from '../lib/backendFileUrl';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export default function MaidsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [maids, setMaids] = useState<maidApi.Maid[]>([]);

  const societyId = user?.society_id;

  const load = useCallback(async () => {
    if (societyId == null || String(societyId).trim() === '') {
      setMaids([]);
      Alert.alert('Not available', 'Your society is not set, so maids cannot be loaded.');
      return;
    }

    setLoading(true);
    try {
      const res = await maidApi.fetchMaidsBySociety(societyId);
      if (!res?.success) throw new Error(res?.message || 'Failed to load maids');
      setMaids(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setMaids([]);
      Alert.alert('Error', (e as Error).message || 'Failed to load maids');
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
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
        <Text style={styles.headerTitle}>Maids</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Loading maids…</Text>
        </View>
      ) : maids.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.hint}>No maids found.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Reload</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={maids}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const photoUri = resolveBackendFileUrl(item.photo, { fallbackUploadsPrefix: '/uploads/' });
            return (
              <Pressable
                onPress={() => navigation.navigate('MaidDetails', { maid: item })}
                style={styles.row}
              >
                <View style={styles.avatar}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name="person" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name || '-'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.phone || ''}
                    {item.status ? ` • ${String(item.status)}` : ''}
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
  background: string;
  text: string;
  textSecondary: string;
  surface: string;
  primary: string;
  accent: string;
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
      gap: 10,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' },
    list: { padding: 16, paddingBottom: 24, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.background,
    },
    avatarImg: { width: 44, height: 44 },
    name: { color: colors.text, fontSize: 16, fontWeight: '900' },
    meta: { color: colors.textSecondary, fontWeight: '700', marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
    hint: { color: colors.textSecondary, fontWeight: '700' },
    retryBtn: {
      marginTop: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: { color: '#4A2100', fontWeight: '900' },
  });
}

