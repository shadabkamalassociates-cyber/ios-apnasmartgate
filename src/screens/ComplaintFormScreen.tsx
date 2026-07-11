import React, { useMemo, useState } from 'react';
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
  Image,
  Pressable,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as complaintApi from '../api/complaint';

export default function ComplaintFormScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route: {
    params?: {
      society_id?: string;
      apartment_id?: string;
      complaint?: { id: number; title: string; description?: string };
      onSaved?: () => void;
    };
  };
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const editingComplaint = route.params?.complaint;
  const isEdit = !!editingComplaint?.id;
  const [title, setTitle] = useState(editingComplaint?.title ?? '');
  const [description, setDescription] = useState(editingComplaint?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; type?: string; fileName?: string } | null>(null);
  const [focusedField, setFocusedField] = useState<'title' | 'description' | null>(null);

  const titleMeta = useMemo(() => {
    const max = 80;
    const len = title.trim().length;
    return { len, max, remaining: Math.max(0, max - len) };
  }, [title]);

  const descriptionMeta = useMemo(() => {
    const max = 500;
    const len = description.trim().length;
    return { len, max, remaining: Math.max(0, max - len) };
  }, [description]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    if (user.society_id == null || user.flat_id == null) {
      Alert.alert(
        'Missing details',
        'Your profile is missing society or flat information. Please update your profile or contact your society admin.'
      );
      return;
    }
    setLoading(true);
    try {
      if (isEdit && editingComplaint?.id != null) {
        await complaintApi.updateComplaint(editingComplaint.id, {
          title: title.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await complaintApi.createComplaint(
          {
            society_id: user.society_id,
            apartment_id: user.flat_id,
            raised_by: user.id,
            title: title.trim(),
            description: description.trim() || undefined,
          },
          photo
            ? {
                uri: photo.uri,
                type: photo.type,
                name: photo.fileName ?? 'complaint.jpg',
              }
            : null
        );
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message || (isEdit ? 'Failed to update complaint' : 'Failed to create complaint'));
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => !loading && navigation.goBack()} hitSlop={10} style={styles.headerBackBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit complaint' : 'Raise a complaint'}</Text>
          <Text style={styles.headerSubtitle}>Help your society team resolve it faster.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Complaint details</Text>

          <Text style={styles.label}>Title *</Text>
          <View style={[styles.inputWrap, focusedField === 'title' && styles.inputWrapFocused]}>
            <Ionicons name="text-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Water leakage in bathroom"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              editable={!loading}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField(null)}
              maxLength={titleMeta.max}
              returnKeyType="next"
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.hint}>Keep it short and specific.</Text>
            <Text style={styles.counter}>{titleMeta.len}/{titleMeta.max}</Text>
          </View>

          <Text style={styles.label}>Description</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap, focusedField === 'description' && styles.inputWrapFocused]}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} style={styles.textAreaIcon} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add details like location, timings, and any prior attempts to fix."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              editable={!loading}
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
              maxLength={descriptionMeta.max}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.hint}>Optional but recommended.</Text>
            <Text style={styles.counter}>{descriptionMeta.len}/{descriptionMeta.max}</Text>
          </View>
        </View>

        {!isEdit ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.cardTitle}>Photo (optional)</Text>
              <Text style={styles.photoHint}>JPG/PNG, up to 5 MB</Text>
            </View>

            {photo ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={styles.photoActionBtn}
                    onPress={async () => {
                      if (loading) return;
                      try {
                        const result = await launchImageLibrary({
                          mediaType: 'photo',
                          quality: 0.7,
                          maxWidth: 1280,
                          maxHeight: 1280,
                          selectionLimit: 1,
                        });
                        if (result.didCancel || result.errorCode) return;
                        const asset = result.assets?.[0];
                        if (asset?.uri) {
                          setPhoto({
                            uri: asset.uri,
                            type: asset.type,
                            fileName: asset.fileName ?? undefined,
                          });
                        }
                      } catch {
                        // ignore picker errors
                      }
                    }}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image-outline" size={18} color={colors.primary} />
                    <Text style={styles.photoActionText}>Change</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.photoActionBtn, styles.photoActionBtnDanger]}
                    onPress={() => !loading && setPhoto(null)}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[styles.photoActionText, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.pickPhotoCard}
                onPress={async () => {
                  if (loading) return;
                  try {
                    const result = await launchImageLibrary({
                      mediaType: 'photo',
                      quality: 0.7,
                      maxWidth: 1280,
                      maxHeight: 1280,
                      selectionLimit: 1,
                    });
                    if (result.didCancel || result.errorCode) return;
                    const asset = result.assets?.[0];
                    if (asset?.uri) {
                      setPhoto({
                        uri: asset.uri,
                        type: asset.type,
                        fileName: asset.fileName ?? undefined,
                      });
                    }
                  } catch {
                    // ignore picker errors
                  }
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View style={styles.pickPhotoIconWrap}>
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.pickPhotoTextCol}>
                  <Text style={styles.pickPhotoTitle}>Add a photo</Text>
                  <Text style={styles.pickPhotoSubtitle}>Helps verify and speed up resolution.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            if (!loading) navigation.goBack();
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isEdit ? 'Update' : 'Submit'}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitles: { flex: 1, marginLeft: 12 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    scroll: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },

    label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 12 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      gap: 10,
    },
    inputWrapFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    textAreaWrap: { alignItems: 'flex-start' },
    textAreaIcon: { paddingTop: 14 },
    textArea: { minHeight: 120, paddingVertical: 14 },
    metaRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    hint: { fontSize: 12, color: colors.textSecondary },
    counter: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

    photoWrap: { marginBottom: 4 },
    photoPreview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.border },
    photoHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    photoHint: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    photoActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    photoActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 12,
    },
    photoActionBtnDanger: {
      borderColor: colors.error + '55',
      backgroundColor: colors.error + '08',
    },
    photoActionText: { fontSize: 14, fontWeight: '800', color: colors.primary },

    pickPhotoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 16,
      padding: 14,
      backgroundColor: colors.surfaceVariant,
    },
    pickPhotoIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickPhotoTextCol: { flex: 1 },
    pickPhotoTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
    pickPhotoSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    bottomSpacer: { height: 96 },
    actionBar: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.maincontainerbackground,
    },
    cancelButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    submitButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
