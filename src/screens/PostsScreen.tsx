import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  ScrollView,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as postApi from '../api/post';
import { formatDateTime12hTimeFirst } from '../lib/datetime';
import { extractPostsArray, normalizePostImages } from '../lib/postImages';

type PostItem = {
  id: string | number;
  title: string;
  description?: string;
  images?: string[];
  created_at?: string;
  createdByResident?: string | number;
  createdByOwner?: string | number;
  likes_count?: number | string | null;
  likes?: unknown[] | null;
};

const LIKE_COUNTS_STORAGE_KEY = '@AapnaSmartGate:post_like_counts_v1';

export default function PostsScreen({ navigation }: { navigation: { navigate: (a: string, p?: object) => void } }) {
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const [list, setList] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [menuPost, setMenuPost] = useState<PostItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [feed, setFeed] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

  const parseMaybeNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const getBackendLikeCountMaybe = (p: PostItem): number | null => {
    const anyP = p as any;

    // Try multiple common field names.
    if (anyP.likes_count !== undefined && anyP.likes_count !== null) return parseMaybeNumber(anyP.likes_count);
    if (anyP.likesCount !== undefined && anyP.likesCount !== null) return parseMaybeNumber(anyP.likesCount);
    if (anyP.like_count !== undefined && anyP.like_count !== null) return parseMaybeNumber(anyP.like_count);
    if (anyP.likeCount !== undefined && anyP.likeCount !== null) return parseMaybeNumber(anyP.likeCount);

    // `likes` might be either an array or a number depending on backend/DB.
    if (anyP.likes !== undefined && anyP.likes !== null) {
      if (Array.isArray(anyP.likes)) return anyP.likes.length;
      return parseMaybeNumber(anyP.likes);
    }

    return null;
  };

  const readLikeCountsFromStorage = async (): Promise<Record<string, number>> => {
    try {
      const raw = await AsyncStorage.getItem(LIKE_COUNTS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};

      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const num = typeof v === 'number' ? v : parseMaybeNumber(v);
        if (num != null) next[String(k)] = num;
      }
      return next;
    } catch {
      return {};
    }
  };

  const load = async () => {
    try {
      const userId = user?.id;
      const cachedLikeCounts = await readLikeCountsFromStorage();

      if (feed === 'mine') {
        if (!userId) {
          setList([]);
          setLikedIds(new Set());
          return;
        }

        const [postsRes, likesRes] = await Promise.all([
          postApi.getPostsByResident(userId),
          postApi.fetchLikesByUser(userId),
        ]);

        const posts = extractPostsArray(postsRes) as PostItem[];
        const likedFromApi =
          (likesRes as { data?: { post_id?: string | number }[] })?.data?.map((row) => String(row.post_id)) ?? [];
        const likedSet = new Set(likedFromApi);

        const normalized = (Array.isArray(posts) ? posts : []).map((p) => {
          const base = { ...p, images: normalizePostImages(p) } as PostItem;
          const backendCount = getBackendLikeCountMaybe(base);
          const key = String((base as any)?.id ?? '');
          if (!key) return base;
          const cached = cachedLikeCounts[key];
          if (backendCount !== null) {
            // Some backends return 0 even when the user has liked the post.
            // If we know the user liked it and we have a cached value, prefer the cache.
            if (backendCount === 0 && cached != null && likedSet.has(key)) return { ...base, likes_count: cached };
            return base;
          }
          if (cached == null) return base;
          return { ...base, likes_count: cached };
        });
        setList(normalized);

        setLikedIds(likedSet);
        return;
      }

      if (userId) {
        const [allRes, likesRes] = await Promise.all([postApi.fetchAllPosts(), postApi.fetchLikesByUser(userId)]);
        const posts = extractPostsArray(allRes) as PostItem[];

        const likedFromApi =
          (likesRes as { data?: { post_id?: string | number }[] })?.data?.map((row) => String(row.post_id)) ?? [];
        const likedSet = new Set(likedFromApi);

        const normalized = (Array.isArray(posts) ? posts : []).map((p) => {
          const base = { ...p, images: normalizePostImages(p) } as PostItem;
          const backendCount = getBackendLikeCountMaybe(base);
          const key = String((base as any)?.id ?? '');
          if (!key) return base;
          const cached = cachedLikeCounts[key];
          if (backendCount !== null) {
            if (backendCount === 0 && cached != null && likedSet.has(key)) return { ...base, likes_count: cached };
            return base;
          }
          if (cached == null) return base;
          return { ...base, likes_count: cached };
        });

        setList(normalized);
        setLikedIds(likedSet);
      } else {
        const allRes = await postApi.fetchAllPosts();
        const posts = extractPostsArray(allRes) as PostItem[];
        const normalized = (Array.isArray(posts) ? posts : []).map((p) => {
          const base = { ...p, images: normalizePostImages(p) } as PostItem;
          const backendCount = getBackendLikeCountMaybe(base);
          if (backendCount !== null) return base;
          const key = String((base as any)?.id ?? '');
          if (!key) return base;
          const cached = cachedLikeCounts[key];
          if (cached == null) return base;
          return { ...base, likes_count: cached };
        });

        setList(normalized);
        setLikedIds(new Set());
      }
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [feed, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleLike = async (post: PostItem) => {
    if (!user?.id) return;
    const postId = post.id;
    const postOwnerResidentId =
      (post as any)?.createdByResident ??
      (post as any)?.createdByOwner ??
      (post as any)?.created_by?.id ??
      (post as any)?.created_by?.resident_id ??
      (post as any)?.created_by_id ??
      (post as any)?.created_by_resident_id ??
      null;

    const currentCount = getBackendLikeCountMaybe(post) ?? getLikeCount(post);
    const likedNow = !isLiked(postId);
    const nextCount = likedNow ? currentCount + 1 : Math.max(currentCount - 1, 0);

    // Optimistic UI update for like count + heart state.
    setList((prev) => prev.map((p) => (String(p.id) === String(postId) ? { ...p, likes_count: nextCount } : p)));
    setLikedIds((prev) => {
      const next = new Set(prev);
      const key = String(postId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    try {
      await postApi.likePostByResident(user.id, postId);

      // Persist count so reload doesn't reset it to 0 (backend fetch doesn't include like totals).
      try {
        const existing = await readLikeCountsFromStorage();
        existing[String(postId)] = nextCount;
        await AsyncStorage.setItem(LIKE_COUNTS_STORAGE_KEY, JSON.stringify(existing));
      } catch {
        // Ignore storage errors; UI state will still be correct until next refresh.
      }
    } catch (e1) {
      // Some backends validate route param `residentId` against the post owner.
      // If the first attempt fails, retry using the post owner's resident id (when available).
      if (postOwnerResidentId != null && String(postOwnerResidentId) !== String(user.id)) {
        try {
          await postApi.likePostByResident(postOwnerResidentId, postId);

          // Persist count after successful retry.
          try {
            const existing = await readLikeCountsFromStorage();
            existing[String(postId)] = nextCount;
            await AsyncStorage.setItem(LIKE_COUNTS_STORAGE_KEY, JSON.stringify(existing));
          } catch {
            // ignore
          }
          return;
        } catch (e2) {
          const message =
            (e2 as any)?.response?.data?.message ||
            (e2 as any)?.response?.data?.error ||
            (e2 as any)?.message ||
            'Failed to like post';
          Alert.alert('Like failed', message);
          load();
          return;
        }
      }

      const message =
        (e1 as any)?.response?.data?.message ||
        (e1 as any)?.response?.data?.error ||
        (e1 as any)?.message ||
        'Failed to like post';
      Alert.alert('Like failed', message);
      load();
    }
  };

  const isLiked = (postId: string | number) => likedIds.has(String(postId));

  const getLikeCount = (p: PostItem) => {
    const backendCount = getBackendLikeCountMaybe(p);
    if (backendCount !== null) return backendCount;
    return 0;
  };

  const handleDelete = (postId: string | number) => {
    Alert.alert('Delete post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postApi.deletePost(postId);
            load();
          } catch (e) {
            Alert.alert('Error', (e as Error).message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const canEditOrDelete = (p: PostItem) => String(p.createdByResident ?? '') === String(user?.id ?? '');

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredList =
    normalizedSearchQuery.length === 0
      ? list
      : list.filter((p) => {
          const title = (p.title ?? '').toLowerCase();
          const description = (p.description ?? '').toLowerCase();
          return `${title} ${description}`.includes(normalizedSearchQuery);
        });

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Posts</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => navigation.navigate('PostForm', { onSaved: load })}
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.switcherWrap}>
        <View style={styles.switcher}>
          <Pressable
            style={[styles.switcherBtn, feed === 'all' && styles.switcherBtnActive]}
            onPress={() => setFeed('all')}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          >
            <Text style={[styles.switcherText, feed === 'all' && styles.switcherTextActive]}>All posts</Text>
          </Pressable>
          <Pressable
            style={[styles.switcherBtn, feed === 'mine' && styles.switcherBtnActive]}
            onPress={() => setFeed('mine')}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          >
            <Text style={[styles.switcherText, feed === 'mine' && styles.switcherTextActive]}>My posts</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search posts..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, searchQuery.trim().length > 0 && styles.searchInputActive]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={filteredList}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {normalizedSearchQuery.length > 0
                ? 'No posts match your search'
                : feed === 'mine'
                  ? 'You have not posted yet'
                  : 'No posts yet'}
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('PostForm', { onSaved: load })}
              android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            >
              <Text style={styles.emptyBtnText}>Create a post</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postCardWrap}>
            <Pressable
              onPress={() => {
                setSelectedPost(item);
                setModalVisible(true);
              }}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={({ pressed }) => [styles.postCard, pressed && styles.postCardPressed]}
            >
              {item.images?.[0] ? (
                <ImageBackground
                  source={{ uri: item.images[0] }}
                  style={styles.postImage}
                  resizeMode="cover"
                >
                  <View style={styles.postImageTopRow}>
                    {feed === 'mine' && canEditOrDelete(item) ? (
                      <Pressable
                        onPress={() => {
                          setMenuPost(item);
                          setMenuVisible(true);
                        }}
                        hitSlop={10}
                        android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
                        style={styles.postMenuBtnOnImage}
                        accessibilityRole="button"
                        accessibilityLabel="Post options"
                      >
                        <Text style={styles.postMenuBtnTextOnImage}>⋮</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {Array.isArray(item.images) && item.images.length > 1 ? (
                    <View style={styles.postImageCountBadge}>
                      <Text style={styles.postImageCountText}>+{item.images.length - 1}</Text>
                    </View>
                  ) : null}
                </ImageBackground>
              ) : null}

              <View style={styles.postMetaRow}>
                <Text style={styles.postTypePill}>Post</Text>
                <View style={styles.postMetaRight}>
                  {item.created_at ? (
                    <View style={styles.postDateTimeColumn}>
                      <Text style={styles.postTimeSecondary}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={styles.postTimeSecondary}>
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {feed === 'mine' && canEditOrDelete(item) && !item.images?.[0] ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setMenuPost(item);
                        setMenuVisible(true);
                      }}
                      hitSlop={10}
                      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                      style={styles.postMenuBtnOnPlaceholder}
                      accessibilityRole="button"
                      accessibilityLabel="Post options"
                    >
                      <Text style={styles.postMenuBtnTextOnPlaceholder}>⋮</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Text style={styles.postTitleLarge} numberOfLines={2}>
                {item.title}
              </Text>

              {item.description ? (
                <Text style={styles.postDescription} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.postFooterRow}>
                <Pressable
                  onPress={(e) => {
                    // Prevent the parent card Pressable from opening the modal.
                    e.stopPropagation();
                    handleLike(item);
                  }}
                  hitSlop={8}
                >
                  <Text style={isLiked(item.id) ? styles.postActionLiked : styles.postActionPrimary}>
                    {isLiked(item.id) ? '♥' : '♡'} {getLikeCount(item)}
                  </Text>
                </Pressable>

                <View style={styles.postFooterRight}>
                  <Pressable
                    onPress={() => {
                      setSelectedPost(item);
                      setModalVisible(true);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.postReadMoreEmphasis}>Read more →</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        )}
      />

      <Modal
        visible={modalVisible && !!selectedPost}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          setFullImageUri(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {selectedPost && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedPost.title}
                  </Text>
                  <Pressable
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      setModalVisible(false);
                      setFullImageUri(null);
                    }}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </Pressable>
                </View>

                {selectedPost.created_at ? (
                  <Text style={styles.modalDate}>
                    {formatDateTime12hTimeFirst(selectedPost.created_at)}
                  </Text>
                ) : null}

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {selectedPost.description ? (
                    <Text style={styles.modalDesc}>
                      {selectedPost.description}
                    </Text>
                  ) : (
                    <Text style={styles.modalDescPlaceholder}>No description</Text>
                  )}

                  {selectedPost.images && selectedPost.images.length ? (
                    <View style={styles.modalImageColumn}>
                      {selectedPost.images.map((uri, index) => (
                        <Pressable
                          key={index}
                          onPress={() => setFullImageUri(uri)}
                          android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                          style={({ pressed }) => [pressed && styles.modalImagePressed]}
                        >
                          <Image source={{ uri }} style={styles.modalImage} resizeMode="cover" />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!fullImageUri}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullImageUri(null)}
      >
        <Pressable
          style={styles.imageLightboxBackdrop}
          onPress={() => setFullImageUri(null)}
          accessibilityRole="button"
          accessibilityLabel="Full size photo, tap to close"
        >
          {fullImageUri ? (
            <Image
              source={{ uri: fullImageUri }}
              style={{
                width: Math.max(0, windowWidth - 24),
                height: Math.max(0, windowHeight * 0.88),
              }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>

      <Modal
        visible={menuVisible && !!menuPost}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Post options
            </Text>

            {menuPost && canEditOrDelete(menuPost) ? (
              <>
                <Pressable
                  style={styles.sheetBtn}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                  onPress={() => {
                    const p = menuPost;
                    setMenuVisible(false);
                    setMenuPost(null);
                    navigation.navigate('PostForm', { post: p, onSaved: load });
                  }}
                >
                  <Text style={styles.sheetBtnText}>Edit</Text>
                </Pressable>
                <View style={styles.sheetDivider} />
                <Pressable
                  style={styles.sheetBtn}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                  onPress={() => {
                    const p = menuPost;
                    setMenuVisible(false);
                    setMenuPost(null);
                    handleDelete(p.id);
                  }}
                >
                  <Text style={[styles.sheetBtnText, styles.sheetBtnDanger]}>Delete</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.sheetHint}>You can only edit/delete your own posts.</Text>
            )}

            <Pressable
              style={[styles.sheetBtn, styles.sheetCancelBtn]}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              onPress={() => {
                setMenuVisible(false);
                setMenuPost(null);
              }}
            >
              <Text style={[styles.sheetBtnText, styles.sheetCancelText]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, overflow: 'hidden' },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    switcherWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    switcher: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      overflow: 'hidden',
    },
    switcherBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    switcherBtnActive: { backgroundColor: 'rgba(27, 135, 63, 0.12)' },
    switcherText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
    switcherTextActive: { color: colors.primary },
    searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontWeight: '600',
    },
    searchInputActive: {
      borderColor: colors.primary,
    },
    listContent: { padding: 16, paddingBottom: 32 },
    separator: { height: 12 },
    postCardWrap: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    postCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 4,
    },
    postCardPressed: { opacity: 0.98 },
    postImage: {
      width: '100%',
      height: 140,
      backgroundColor: '#E5F2E8',
    },
    postImageTopRow: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 2,
    },
    postMenuBtnOnImage: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.38)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    postMenuBtnOnPlaceholder: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    postMenuBtnTextOnImage: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 18,
      lineHeight: 20,
      marginTop: -1,
    },
    postMenuBtnTextOnPlaceholder: {
      color: colors.text,
      fontWeight: '900',
      fontSize: 18,
      lineHeight: 20,
      marginTop: -1,
    },
    postImageCountBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    postImageCountText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 12,
    },
    postMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    postMetaRight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    postTypePill: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1B873F',
    },
    postTimeSecondary: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    postDateTimeColumn: {
      alignItems: 'flex-end',
    },
    postTitleLarge: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 4,
    },
    postDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingTop: 2,
      paddingBottom: 8,
    },
    postFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 6,
    },
    postFooterRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    postActionPrimary: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    postActionLiked: {
      fontSize: 13,
      fontWeight: '700',
      color: '#e53935',
    },
    postReadMoreEmphasis: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6A00',
    },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16 },
    emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, overflow: 'hidden' },
    emptyBtnText: { color: '#fff', fontWeight: '600' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      width: '100%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginRight: 8,
    },
    modalCloseText: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    modalDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    modalBody: {
      marginTop: 12,
    },
    modalActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 10,
    },
    modalEditBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
      overflow: 'hidden',
    },
    modalEditBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    modalDesc: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginBottom: 12,
    },
    modalDescPlaceholder: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    modalImageColumn: {
      gap: 10,
    },
    modalImage: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      marginBottom: 10,
      backgroundColor: '#f1f1f1',
    },
    modalImagePressed: {
      opacity: 0.92,
    },
    imageLightboxBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 12,
    },

    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      padding: 16,
    },
    sheetCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingBottom: 6,
    },
    sheetTitle: {
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 8,
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    sheetHint: {
      paddingHorizontal: 14,
      paddingBottom: 8,
      fontSize: 12,
      color: colors.textSecondary,
    },
    sheetBtn: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    sheetDivider: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.7,
      marginHorizontal: 14,
    },
    sheetBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    sheetBtnDanger: {
      color: colors.error,
    },
    sheetCancelBtn: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 6,
    },
    sheetCancelText: {
      color: colors.textSecondary,
    },
  });
}
