import AsyncStorage from '@react-native-async-storage/async-storage';
import * as residentApi from '../api/resident';
import { parseJwtPayload } from './jwt';
import { STORAGE_TOKEN_KEY } from '../api/client';
import { fetchAllSocieties } from '../api/society';
import { fetchBlocksBySociety } from '../api/block';
import { fetchFlatsByBlock } from '../api/flat';

export type LoadedResidentUser = {
  id?: string | number;
  email?: string;
  role?: string;
  name?: string;
  phone_number?: string;
  society_id?: string | number | null;
  flat_id?: string | number | null;
  profile_image?: string | null;
};

const STORAGE_PROFILE_EXTRAS_KEY = '@kamal_resident_profile_extras';

type ProfileExtras = {
  society_id?: string | number | null;
  flat_id?: string | number | null;
};

type ResidentRecord = {
  id?: string | number;
  name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  role?: string;
  role_id?: string | null;
  society_id?: string | number | null;
  flat_id?: string | number | null;
  profile_image?: string | null;
};

export function mapResidentRecordToAuthUser(
  raw: ResidentRecord | null | undefined,
  fallback?: Partial<LoadedResidentUser>
): LoadedResidentUser | null {
  if (!raw && !fallback?.id && !fallback?.phone_number) return null;

  const society_id =
    raw?.society_id ??
    (raw as { societyId?: string | number })?.societyId ??
    fallback?.society_id ??
    null;
  const flat_id =
    raw?.flat_id ??
    (raw as { apartment_id?: string | number })?.apartment_id ??
    (raw as { apartmentId?: string | number })?.apartmentId ??
    fallback?.flat_id ??
    null;

  return {
    id: raw?.id ?? fallback?.id,
    email: raw?.email ?? fallback?.email,
    role: raw?.role ?? raw?.role_id ?? fallback?.role,
    name: raw?.name ?? fallback?.name,
    phone_number: raw?.phone ?? raw?.phone_number ?? fallback?.phone_number,
    society_id,
    flat_id,
    profile_image: raw?.profile_image ?? fallback?.profile_image ?? null,
  };
}

async function readProfileExtras(userId: string | number): Promise<ProfileExtras | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PROFILE_EXTRAS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ProfileExtras>;
    return map[String(userId)] ?? null;
  } catch {
    return null;
  }
}

export async function writeProfileExtras(userId: string | number, extras: ProfileExtras) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PROFILE_EXTRAS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, ProfileExtras>) : {};
    map[String(userId)] = { ...map[String(userId)], ...extras };
    await AsyncStorage.setItem(STORAGE_PROFILE_EXTRAS_KEY, JSON.stringify(map));
  } catch {
    // ignore cache write failures
  }
}

async function lookupResidenceByFlatScan(userId: string | number): Promise<ProfileExtras | null> {
  try {
    const societiesRes = await fetchAllSocieties();
    const societies = societiesRes?.data ?? [];
    for (const society of societies) {
      const blocksRes = await fetchBlocksBySociety(society.id);
      const blocks = blocksRes?.data ?? [];
      for (const block of blocks) {
        const flatsRes = await fetchFlatsByBlock(block.id);
        const flats = flatsRes?.data ?? [];
        for (const flat of flats) {
          const residents = await residentApi.residentFetchByFlatId(flat.id);
          const match = residents.find((r) => String(r.id) === String(userId));
          if (match) {
            return {
              society_id: match.society_id ?? society.id,
              flat_id: match.flat_id ?? flat.id,
            };
          }
        }
      }
    }
  } catch {
    // best-effort lookup
  }
  return null;
}

/**
 * Load resident profile from API + JWT + local cache.
 * `/resident/checkAuth` does not return DB fields on the current backend.
 */
export async function loadResidentProfile(phone?: string): Promise<LoadedResidentUser | null> {
  const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) return null;

  const jwt = parseJwtPayload(token);
  const cleanPhone = phone?.replace(/\D/g, '');

  const fromList = await residentApi.residentFetchFromList({
    id: jwt?.id,
    phone: cleanPhone || undefined,
  });

  const fallback: Partial<LoadedResidentUser> = {
    id: jwt?.id,
    role: jwt?.role,
    phone_number: cleanPhone || undefined,
  };

  let user = mapResidentRecordToAuthUser(fromList ?? undefined, fallback);
  if (!user?.id) return user;

  const cached = await readProfileExtras(user.id);
  if (cached?.society_id != null || cached?.flat_id != null) {
    user = {
      ...user,
      society_id: user.society_id ?? cached.society_id ?? null,
      flat_id: user.flat_id ?? cached.flat_id ?? null,
    };
  }

  return user;
}

/** Resolve society/flat in background (can be slow on large societies). */
export async function resolveResidenceInBackground(
  userId: string | number,
  onResolved: (extras: ProfileExtras) => void
) {
  const cached = await readProfileExtras(userId);
  if (cached?.society_id != null && cached?.flat_id != null) {
    onResolved(cached);
    return;
  }

  const residence = await lookupResidenceByFlatScan(userId);
  if (residence) {
    await writeProfileExtras(userId, residence);
    onResolved(residence);
  }
}
