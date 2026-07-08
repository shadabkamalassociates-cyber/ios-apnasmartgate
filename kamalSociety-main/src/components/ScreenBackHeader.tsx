import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';

type Props = {
  title?: string;
  onBack: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backDisabled?: boolean;
};

export default function ScreenBackHeader({ title, onBack, right, style, backDisabled }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, style]}>
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.8}
        disabled={backDisabled}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titleSpacer} />
      )}
      {right ?? <View style={styles.sideSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '700' },
  titleSpacer: { flex: 1 },
  sideSpacer: { width: 42 },
});
