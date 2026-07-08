import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as ticketsApi from '../api/tickets';
import type { ImageFile } from '../lib/uploadImage';

type TicketKind = 'general' | 'bug' | 'user' | 'post';

export default function CreateTicketScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route?: {
    params?: {
      kind?: TicketKind;
      prefillTitle?: string;
      prefillDescription?: string;
    };
  };
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const kind: TicketKind =
    route?.params?.kind === 'bug'
      ? 'bug'
      : route?.params?.kind === 'user'
        ? 'user'
        : route?.params?.kind === 'post'
          ? 'post'
          : 'general';
  const isBug = kind === 'bug';
  const isReport = kind === 'user' || kind === 'post';

  const [title, setTitle] = useState(route?.params?.prefillTitle ?? '');
  const [description, setDescription] = useState(route?.params?.prefillDescription ?? '');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    if (loading) return;
    try {
      const result: any = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1280,
        maxHeight: 1280,
        selectionLimit: 10,
      });

      if (result?.didCancel || result?.errorCode) {
        if (result?.errorCode) {
          Alert.alert('Image picker error', result?.errorMessage || result?.errorCode);
        }
        return;
      }

      const assets = result?.assets?.filter((a: any) => a?.uri) ?? [];
      const picked: ImageFile[] = assets.map((a: any, i: number) => {
        const uri = a.uri as string;
        const type = (a.type as string) || 'image/jpeg';
        const name =
          (a.fileName as string) ||
          (a.uri as string)?.split('/').pop() ||
          `ticket-${Date.now()}-${i}.jpg`;
        return { uri, type, name };
      });

      if (picked.length) {
        setImages((prev) => [...prev, ...picked].slice(0, 10));
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to open image picker');
    }
  };

  const removeImageAt = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (loading) return;
    if (!user?.id) {
      Alert.alert('Not available', 'Your account is missing an id. Please login again.');
      return;
    }

    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      Alert.alert('Error', 'Title and description are required.');
      return;
    }

    setLoading(true);
    try {
      const finalTitle = (() => {
        if (isBug && !/^\[bug\]/i.test(t)) return `[BUG] ${t}`;
        if (kind === 'user' && !/^\[report user\]/i.test(t)) return `[REPORT USER] ${t}`;
        if (kind === 'post' && !/^\[report post\]/i.test(t)) return `[REPORT POST] ${t}`;
        return t;
      })();
      await ticketsApi.createTicket({
        title: finalTitle,
        description: d,
        created_by_resident: user.id,
        images,
      });
      Alert.alert(
        'Success',
        isBug ? 'Bug report submitted.' : isReport ? 'Report submitted.' : 'Ticket created.'
      );
      navigation.goBack();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
        (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error ??
        (e as Error).message;
      Alert.alert('Error', msg || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} disabled={loading}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isBug ? 'Report Software Bug' : kind === 'user' ? 'Report a User' : kind === 'post' ? 'Report a Post' : 'Create Ticket'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isBug ? (
          <View style={styles.banner}>
            <Ionicons name="bug-outline" size={18} color={colors.primary} />
            <Text style={styles.bannerText}>
              Tell us what went wrong in the app. Include the steps to reproduce, what you expected, and what actually
              happened.
            </Text>
          </View>
        ) : isReport ? (
          <View style={styles.banner}>
            <Ionicons name="flag-outline" size={18} color={colors.primary} />
            <Text style={styles.bannerText}>
              Describe the issue with this {kind === 'post' ? 'post' : 'user'}. Include what happened and why you are
              reporting it. Our team will review your ticket.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder={
            isBug
              ? 'e.g. App crashes when opening Visitors'
              : kind === 'user'
                ? 'e.g. Harassment in community post'
                : kind === 'post'
                  ? 'e.g. Inappropriate community post'
                  : 'Short title'
          }
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder={
            isBug
              ? 'Steps to reproduce:\n1. ...\n2. ...\n\nExpected:\nActual:\nDevice / app version:'
              : 'Describe your issue'
          }
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          editable={!loading}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Photos (optional)</Text>
        <View style={styles.imagesRow}>
          {images.map((img, idx) => (
            <View key={`${img.uri}-${idx}`} style={styles.imagePreviewWrapper}>
              <TouchableOpacity
                style={styles.removeBadge}
                onPress={() => removeImageAt(idx)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.removeBadgeText}>×</Text>
              </TouchableOpacity>
              <View style={styles.imagePreview}>
                <Image source={{ uri: img.uri }} style={styles.imagePreviewImage} />
              </View>
            </View>
          ))}
          {images.length < 10 && (
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={pickImages}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.addImageText}>+ Add photo</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.hint}>You can upload up to 10 photos.</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isBug ? 'Send bug report' : isReport ? 'Submit report' : 'Submit'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    scroll: { padding: 20, paddingBottom: 40 },
    label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 12 },
    hint: { marginTop: 8, color: colors.textSecondary, fontWeight: '600' },
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    bannerText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
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
    textarea: {
      minHeight: 120,
    },
    imagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 6,
    },
    imagePreviewWrapper: {
      width: 96,
      height: 96,
      position: 'relative',
    },
    imagePreview: {
      width: 96,
      height: 96,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    imagePreviewImage: { width: '100%', height: '100%' },
    removeBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    removeBadgeText: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 16 },
    addImageBtn: {
      width: 96,
      height: 96,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    addImageText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 13,
      textAlign: 'center',
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
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    secondaryButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  });
}

