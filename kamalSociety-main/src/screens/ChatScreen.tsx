import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as chatApi from '../api/chat';
import { useAuth } from '../context/AuthContext';
import { resolveBackendFileUrl } from '../lib/backendFileUrl';
import type { ProfileStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;
type ChatRoute = RouteProp<ProfileStackParamList, 'Chat'>;

function formatMessageTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ChatRoute>();
  const { chatId, vendorName, vendorProfileImage } = route.params;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<chatApi.ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<chatApi.ChatMessage>>(null);

  const title = (vendorName || 'Chat').trim();
  const avatarUri = resolveBackendFileUrl(vendorProfileImage, { fallbackUploadsPrefix: '/uploads/' });
  const myId = user?.id != null ? String(user.id) : '';

  const loadMessages = useCallback(async () => {
    try {
      const res = await chatApi.fetchMessages(chatId);
      if (!res?.success) throw new Error(res?.message || 'Failed to load messages');
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to load messages');
    }
  }, [chatId]);

  const markSeen = useCallback(async () => {
    try {
      await chatApi.markMessagesSeen(chatId);
    } catch {
      /* non-blocking */
    }
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      (async () => {
        setLoading(true);
        await loadMessages();
        await markSeen();
        if (!cancelled) setLoading(false);
      })();

      interval = setInterval(() => {
        void loadMessages();
      }, 5000);

      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }, [loadMessages, markSeen]),
  );

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !user?.id) return;
    setSending(true);
    try {
      const res = await chatApi.sendMessage({
        chat_id: chatId,
        sender_id: user.id,
        message: text,
      });
      if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to send');
      setDraft('');
      setMessages((prev) => [...prev, res.data]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrNavigate(navigation, 'ChatInbox')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.headerAvatarImg} resizeMode="cover" />
            ) : (
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            )}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = myId && String(item.sender_id) === myId;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatMessageTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
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
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.maincontainerbackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 8 },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(232, 93, 4, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerAvatarImg: { width: '100%', height: '100%' },
    headerTitle: { flexShrink: 1, fontSize: 17, fontWeight: '800', color: colors.text, maxWidth: '70%' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
    bubbleWrap: { marginBottom: 10, maxWidth: '82%' },
    bubbleWrapMine: { alignSelf: 'flex-end' },
    bubbleWrapTheirs: { alignSelf: 'flex-start' },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    bubbleText: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
    bubbleTextMine: { color: '#fff' },
    bubbleTextTheirs: { color: colors.text },
    bubbleTime: { marginTop: 6, fontSize: 11, fontWeight: '600' },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.85)', textAlign: 'right' },
    bubbleTimeTheirs: { color: colors.textSecondary },
    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyChatText: { color: colors.textSecondary, fontWeight: '600' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.maincontainerbackground,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
  });
}
