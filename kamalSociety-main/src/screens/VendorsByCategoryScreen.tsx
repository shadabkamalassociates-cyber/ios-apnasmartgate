import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';
import { VENDOR_CATEGORIES, type VendorCategoryKey } from '../constants/vendorCategories';
import { fetchVendorsByCategory, type VendorServiceRow } from '../api/vendorServices';
import { resolveImageUri } from '../lib/postImages';
import ScreenBackHeader from '../components/ScreenBackHeader';
import { goBackOrNavigate } from '../lib/goBackOrNavigate';

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_W - 16 * 2 - CARD_GAP) / 2;

type Props = {
  navigation: {
    goBack: () => void;
    navigate: (name: string, params?: any) => void;
    canGoBack?: () => boolean;
  };
  route: { params: { category: VendorCategoryKey } };
};

type ServiceCardItem = {
  id: string;
  vendor_id: string;
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  price?: string | number | null;
  images?: string[] | null;
};

function formatPrice(price?: string | number | null) {
  if (price == null) return null;
  const raw = String(price).trim();
  if (!raw) return null;
  const normalized = raw.endsWith('.00') ? raw.slice(0, -3) : raw;
  return `₹${normalized}`;
}

function getFirstImageUrl(images?: string[] | null): string | null {
  if (!images || !Array.isArray(images)) return null;
  for (const img of images) {
    const raw = String(img ?? '').trim();
    if (!raw) continue;
    const uri = resolveImageUri(raw);
    if (uri) return uri;
  }
  return null;
}

export default function VendorsByCategoryScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const category = route?.params?.category;

  const categoryLabel =
    VENDOR_CATEGORIES.find((c) => c.key === category)?.label ?? String(category ?? 'Vendors');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorServiceRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchVendorsByCategory(category);
        if (!res?.success) throw new Error('Failed to load vendors');
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load vendors');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category]);

  const cards = useMemo<ServiceCardItem[]>(() => {
    const list: ServiceCardItem[] = [];
    const vendorMap = new Map<string, { business_name?: string | null; city?: string | null; state?: string | null }>();
    for (const r of rows) {
      const vid = r?.vendor_id != null ? String(r.vendor_id) : 'unknown';
      if (!vendorMap.has(vid)) {
        vendorMap.set(vid, { business_name: r?.business_name, city: r?.city, state: r?.state });
      }
      const sid = r?.service_id != null ? String(r.service_id) : null;
      list.push({
        id: `${vid}-${sid ?? r?.service_name ?? list.length}`,
        vendor_id: vid,
        business_name: r?.business_name ?? null,
        city: r?.city ?? null,
        state: r?.state ?? null,
        service_id: sid,
        service_name: r?.service_name ?? null,
        price: r?.price ?? null,
        images: r?.images ?? null,
      });
    }
    return list;
  }, [rows]);

  function onPress(item: ServiceCardItem) {
    if (!item.service_id) return;
    navigation.navigate('ServiceDetails', { serviceId: item.service_id, title: item.service_name ?? undefined });
  }

  function doRetry() {
    setRows([]);
    setLoading(true);
    setError(null);
    fetchVendorsByCategory(category)
      .then((res) => {
        if (!res?.success) throw new Error('Failed to load vendors');
        setRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((e) => setError((e as Error)?.message || 'Failed to load vendors'))
      .finally(() => setLoading(false));
  }

  const handleBack = () => goBackOrNavigate(navigation, 'Home');

  const headerRight =
    !loading && cards.length > 0 ? (
      <View style={s.countPill}>
        <Text style={s.countText}>{cards.length}</Text>
      </View>
    ) : (
      <View style={s.headerRightSpacer} />
    );

  return (
    <View style={s.container}>
      <ScreenBackHeader title={categoryLabel} onBack={handleBack} right={headerRight} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.centerHint}>Finding services…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="warning-outline" size={48} color="#F97316" />
          <Text style={s.centerTitle}>Something went wrong</Text>
          <Text style={s.centerHint}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={doRetry} activeOpacity={0.8}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : cards.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} />
          <Text style={s.centerTitle}>No services yet</Text>
          <Text style={s.centerHint}>No one is offering {categoryLabel.toLowerCase()} right now.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = getFirstImageUrl(item.images);
            const price = formatPrice(item.price);
            const loc = [item.city, item.state].filter(Boolean).join(', ');

            return (
              <TouchableOpacity
                style={s.card}
                activeOpacity={0.8}
                onPress={() => onPress(item)}
                disabled={!item.service_id}
              >
                <View style={s.cardImgWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={s.cardImg} resizeMode="cover" />
                  ) : (
                    <View style={s.cardImgEmpty}>
                      <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                  {price ? (
                    <View style={s.priceBadge}>
                      <Text style={s.priceText}>{price}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={s.cardInfo}>
                  <Text style={s.cardName} numberOfLines={2}>{item.service_name || 'Service'}</Text>
                  <View style={s.cardMeta}>
                    <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
                    <Text style={s.cardVendor} numberOfLines={1}>{item.business_name || 'Vendor'}</Text>
                  </View>
                  {loc ? (
                    <View style={s.cardMeta}>
                      <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                      <Text style={s.cardLoc} numberOfLines={1}>{loc}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: {
  background: string;
  maincontainerbackground: string;
  text: string;
  textSecondary: string;
  surface: string;
  primary: string;
  border: string;
}) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      marginLeft: 14,
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
    },
    headerRightSpacer: {
      width: 42,
    },
    countPill: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    countText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 13,
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 10,
    },
    centerTitle: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 17,
      marginTop: 4,
    },
    centerHint: {
      color: colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 20,
    },
    retryBtn: {
      marginTop: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: '#F97316',
    },
    retryText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    grid: {
      padding: 16,
      paddingBottom: 28,
    },
    gridRow: {
      gap: CARD_GAP,
      marginBottom: CARD_GAP,
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardImgWrap: {
      width: '100%',
      height: CARD_WIDTH * 0.7,
      backgroundColor: colors.maincontainerbackground,
    },
    cardImg: {
      width: '100%',
      height: '100%',
    },
    cardImgEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priceBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    priceText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 13,
    },
    cardInfo: {
      padding: 10,
      gap: 4,
    },
    cardName: {
      color: colors.text,
      fontWeight: '900',
      fontSize: 13,
      lineHeight: 18,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cardVendor: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 11,
      flex: 1,
    },
    cardLoc: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 11,
      flex: 1,
    },
  });
}
