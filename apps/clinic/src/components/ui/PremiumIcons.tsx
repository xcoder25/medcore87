import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type MedIconName =
  | 'shield'
  | 'stethoscope'
  | 'building'
  | 'user-plus'
  | 'users'
  | 'heart'
  | 'calendar'
  | 'clipboard'
  | 'card'
  | 'bell'
  | 'lock'
  | 'sparkles'
  | 'sync'
  | 'activity'
  | 'pill'
  | 'lab'
  | 'arrow-right'
  | 'back'
  | 'logout'
  | 'grid'
  | 'check'
  | 'settings';

interface MedIconProps {
  name: MedIconName;
  size?: number;
  color?: string;
  glowColor?: string;
  badge?: boolean;
}

const GLYPHS: Record<MedIconName, string> = {
  shield: '❖',
  stethoscope: '✚',
  building: '▣',
  'user-plus': '⊕',
  users: '◈',
  heart: '♥',
  calendar: '▤',
  clipboard: '▥',
  card: '▭',
  bell: '◉',
  lock: '⛨',
  sparkles: '✦',
  sync: '⟳',
  activity: '〰',
  pill: '⬬',
  lab: '⚗',
  'arrow-right': '→',
  back: '←',
  logout: '⏻',
  grid: '⊞',
  check: '✓',
  settings: '⚙',
};

/**
 * Pure React Native + Web geometric luminous icon medallion.
 * Avoids emoji font variance and renders crisply across iOS, Android, and Web.
 */
export const MedIcon: React.FC<MedIconProps> = ({
  name,
  size = 20,
  color = '#E0F2FE',
  glowColor = '#38BDF8',
  badge = true,
}) => {
  const glyph = GLYPHS[name] || '◈';
  if (!badge) {
    return (
      <Text
        style={{
          color,
          fontSize: size,
          fontWeight: '800',
          lineHeight: size + 2,
          textAlign: 'center',
        }}
      >
        {glyph}
      </Text>
    );
  }

  const box = Math.round(size * 1.9);
  return (
    <View
      style={[
        styles.medallion,
        {
          width: box,
          height: box,
          borderRadius: Math.round(box * 0.34),
          borderColor: `${glowColor}66`,
          backgroundColor: `${glowColor}22`,
          shadowColor: glowColor,
        },
      ]}
    >
      <View style={[styles.specularRim, { borderRadius: Math.round(box * 0.34) }]} />
      <Text
        style={{
          color,
          fontSize: size,
          fontWeight: '900',
          lineHeight: size + 2,
          textAlign: 'center',
        }}
      >
        {glyph}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  medallion: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    height: '44%',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});

export default MedIcon;
