import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NoticeItem } from '../api/notice';

function storageKey(userId: string | number) {
  return `@kamal_seen_notice_ids:${String(userId)}`;
}

async function getSeenNoticeIdSet(userId: string | number) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

export async function getSeenNoticeIdsLocally(userId: string | number) {
  return getSeenNoticeIdSet(userId);
}

export async function markNoticeSeenLocally(userId: string | number, noticeId: string | number) {
  const seenIds = await getSeenNoticeIdSet(userId);
  seenIds.add(String(noticeId));
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...seenIds]));
}

export async function hasUnseenNoticesLocally(userId: string | number, notices: NoticeItem[]) {
  if (notices.length === 0) {
    return false;
  }

  const seenIds = await getSeenNoticeIdSet(userId);
  return notices.some((notice) => notice?.id != null && !seenIds.has(String(notice.id)));
}
