import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { navigationRef } from '../navigation/navigationRef';
import { useTheme } from '../theme';

export default function FloatingTicketButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const open = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('CreateTicket');
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={open}>
        <Ionicons name="help-circle" size={22} color={colors.text} />
        <Text style={styles.label}>Ticket</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: {
  surface: string;
  border: string;
  text: string;
  primary: string;
}) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: 16,
    },
    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 6,
    },
    label: {
      color: colors.text,
      fontWeight: '800',
    },
  });
}

