import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';
import type { ProfileStackParamList } from '../navigation/types';
import { resolveBackendFileUrl } from '../lib/backendFileUrl';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

type R = RouteProp<ProfileStackParamList, 'MaidDetails'>;
type Nav = NativeStackNavigationProp<ProfileStackParamList>;

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ paddingVertical: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', opacity: 0.65 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

export default function MaidDetailsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const maid = route.params.maid;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const photoUri = resolveBackendFileUrl(maid.photo, { fallbackUploadsPrefix: '/uploads/' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrNavigate(navigation, 'Maids')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maid details</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.hero}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.heroImg} resizeMode="cover" />
            ) : (
              <View style={styles.heroFallback}>
                <Ionicons name="person" size={44} color={colors.primary} />
              </View>
            )}
          </View>

          <Text style={styles.name}>{maid.name || '-'}</Text>
          {!!maid.society_name && <Text style={styles.sub}>{maid.society_name}</Text>}

          <View style={styles.divider} />

          <InfoRow label="Phone" value={maid.phone ? String(maid.phone) : null} />
          <InfoRow label="Address" value={maid.address ? String(maid.address) : null} />
          <InfoRow label="Aadhaar number" value={maid.aadhaar_number ? String(maid.aadhaar_number) : null} />
          <InfoRow label="Status" value={maid.status ? String(maid.status) : null} />
          <InfoRow label="Verified" value={maid.is_verified != null ? (maid.is_verified ? 'Yes' : 'No') : null} />
        </View>
      </ScrollView>
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
    scroll: { padding: 16, paddingBottom: 24 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    hero: {
      width: '100%',
      height: 220,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.background,
      marginBottom: 14,
    },
    heroImg: { width: '100%', height: '100%' },
    heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    name: { color: colors.text, fontSize: 20, fontWeight: '900' },
    sub: { color: colors.textSecondary, fontWeight: '700', marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  });
}

