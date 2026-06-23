import React, { useState } from 'react';
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
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as postApi from '../api/post';
import type { PostImageFile } from '../api/post';
import { displayUriToApiRelativePath } from '../lib/postImages';
import type { PostsStackProps } from '../navigation/types';
import ScreenBackHeader from '../components/ScreenBackHeader';

type Props = PostsStackProps<'PostForm'>;

/** Already on server (editable) or newly picked local file. */
type PostImageSlot =
  | { kind: 'remote'; displayUri: string; serverPath: string | null }
  | { kind: 'local'; displayUri: string; file: PostImageFile };

function buildInitialSlots(editingImages: string[] | undefined): PostImageSlot[] {
  if (!editingImages?.length) return [];
  return editingImages.map((displayUri) => {
    const serverPath = displayUriToApiRelativePath(displayUri);
    return { kind: 'remote' as const, displayUri, serverPath };
  });
}

export default function PostFormScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const editingPost = route.params?.post;
  const isEditing = !!editingPost?.id;

  const [title, setTitle] = useState(editingPost?.title ?? '');
  const [description, setDescription] = useState(editingPost?.description ?? '');
  const [imageSlots, setImageSlots] = useState<PostImageSlot[]>(() =>
    buildInitialSlots(editingPost?.images),
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editingPost?.id) {
        const keptRelativePaths = imageSlots
          .filter(
            (s): s is Extract<PostImageSlot, { kind: 'remote' }> & { serverPath: string } =>
              s.kind === 'remote' && !!s.serverPath,
          )
          .map((s) => s.serverPath);
        const newImageFiles = imageSlots
          .filter((s): s is Extract<PostImageSlot, { kind: 'local' }> => s.kind === 'local')
          .map((s) => s.file);
        await postApi.updatePostById(editingPost.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          keptRelativePaths,
          newImageFiles,
        });
      } else {
        const files = imageSlots
          .filter((s): s is Extract<PostImageSlot, { kind: 'local' }> => s.kind === 'local')
          .map((s) => s.file);
        await postApi.createPostByResident(
          user.id,
          { title: title.trim(), description: description.trim() || undefined },
          files.length ? files : undefined,
        );
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as Error).message;
      Alert.alert('Error', msg || (isEditing ? 'Failed to update post' : 'Failed to create post'));
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  const handlePickImages = async () => {
    if (loading) {
      return;
    }
    try {
      const result: any = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1280,
        maxHeight: 1280,
        selectionLimit: 3,
      });

      if (result?.didCancel || result?.errorCode) {
        return;
      }

      const assets = result?.assets?.filter((a: any) => a?.uri) ?? [];
      const picked: PostImageSlot[] = assets.map((a: any) => {
        const uri = a.uri as string;
        const type = (a.type as string) || 'image/jpeg';
        const name =
          (a.fileName as string) ||
          (a.uri as string)?.split('/').pop() ||
          `photo-${Date.now()}.jpg`;
        return {
          kind: 'local' as const,
          displayUri: uri,
          file: { uri, type, name },
        };
      });

      if (picked.length) {
        setImageSlots((prev) => [...prev, ...picked].slice(0, 3));
      }
    } catch {
      /* best-effort */
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => {
    if (!loading) navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenBackHeader
        title={isEditing ? 'Edit post' : 'Create post'}
        onBack={handleBack}
        backDisabled={loading}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Post title"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          editable={!loading}
        />
        <Text style={styles.label}>Photos</Text>
        <View style={styles.imagesRow}>
          {imageSlots.map((slot, index) => (
            <View key={`${slot.displayUri}-${index}`} style={styles.imagePreviewWrapper}>
              <TouchableOpacity
                style={styles.removeBadge}
                onPress={() => handleRemoveImage(index)}
                disabled={loading}
              >
                <Text style={styles.removeBadgeText}>×</Text>
              </TouchableOpacity>
              <View style={styles.imagePreview}>
                <Image source={{ uri: slot.displayUri }} style={styles.imagePreviewImage} />
              </View>
            </View>
          ))}
          {imageSlots.length < 3 && (
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={handlePickImages}
              disabled={loading}
            >
              <Text style={styles.addImageText}>+ Add photo</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isEditing ? 'Update' : 'Post'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    container: { flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 12 },
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
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    imagesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 8,
      gap: 10,
    },
    imagePreviewWrapper: {
      width: 90,
      height: 90,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    removeBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      zIndex: 1,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    imagePreview: {
      flex: 1,
    },
    imagePreviewImage: {
      width: '100%',
      height: '100%',
    },
    addImageBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    addImageText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 14,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  });
}
