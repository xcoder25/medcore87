import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { C } from '../../theme';
import { MedIcon, type MedIconName } from './PremiumIcons';

const WEB_GLASS_BLUR: Record<string, unknown> =
  Platform.OS === 'web'
    ? {
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      }
    : {};

/**
 * Animated ambient aurora background for MedCore's Liquid-Glass aesthetic.
 */
export const AmbientGlowBackdrop: React.FC<{ variant?: 'clinical' | 'care' | 'auth' }> = ({
  variant = 'auth',
}) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.56] });

  const c1 = variant === 'care' ? '#10B981' : '#0EA5E9';
  const c2 = variant === 'care' ? '#06B6D4' : '#6366F1';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.canvas, overflow: 'hidden' }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.orbTopRight,
          {
            backgroundColor: c1,
            opacity: orbOpacity,
            transform: [{ scale: orbScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orbBottomLeft,
          {
            backgroundColor: c2,
            opacity: orbOpacity,
            transform: [{ scale: orbScale }],
          },
        ]}
      />
      <View style={styles.orbCenterGlow} />
    </View>
  );
};

interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  intensity?: 'soft' | 'strong';
  animateIn?: boolean;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  glowColor = C.glowBlue,
  intensity = 'soft',
  animateIn = false,
}) => {
  const anim = useRef(new Animated.Value(animateIn ? 0 : 1)).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animateIn, anim]);

  return (
    <Animated.View
      style={[
        styles.glassCard,
        {
          backgroundColor: intensity === 'strong' ? C.glassStrong : C.glass,
          borderColor: `${glowColor}44`,
          shadowColor: glowColor,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
        WEB_GLASS_BLUR as ViewStyle,
        style,
      ]}
    >
      <View style={styles.glassTopHighlight} pointerEvents="none" />
      {children}
    </Animated.View>
  );
};

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'emerald' | 'violet' | 'danger' | 'glass';
  icon?: MedIconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const palette = {
    primary: { bg: '#0284C7', border: '#38BDF8', glow: '#38BDF8', text: '#FFFFFF' },
    emerald: { bg: '#059669', border: '#34D399', glow: '#10B981', text: '#FFFFFF' },
    violet: { bg: '#6D28D9', border: '#A78BFA', glow: '#8B5CF6', text: '#FFFFFF' },
    danger: { bg: '#BE123C', border: '#FB7185', glow: '#F43F5E', text: '#FFFFFF' },
    glass: { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.28)', glow: '#38BDF8', text: '#E0F2FE' },
  }[variant];

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 35,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={disabled || loading ? undefined : handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.glowBtn,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            shadowColor: palette.glow,
            opacity: disabled ? 0.55 : 1,
          },
          WEB_GLASS_BLUR as ViewStyle,
          style,
        ]}
      >
        <View style={styles.btnSpecular} pointerEvents="none" />
        {icon && <MedIcon name={icon} size={15} color={palette.text} badge={false} />}
        <Text style={[styles.glowBtnText, { color: palette.text }]}>
          {loading ? 'Please wait…' : label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export type SyncState = 'live' | 'syncing' | 'offline';

export const LiveSyncPill: React.FC<{
  state: SyncState;
  label?: string;
  onPress?: () => void;
}> = ({ state, label, onPress }) => {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (state === 'offline') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const color =
    state === 'live' ? '#34D399' : state === 'syncing' ? '#38BDF8' : '#FBBF24';
  const text =
    label || (state === 'live' ? 'EMR LIVE' : state === 'syncing' ? 'SYNCING' : 'OFFLINE QUEUE');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.syncPill,
        {
          borderColor: `${color}66`,
          backgroundColor: `${color}1A`,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.syncDot,
          { backgroundColor: color, opacity: pulse, shadowColor: color },
        ]}
      />
      <Text style={[styles.syncPillText, { color }]}>{text}</Text>
    </Pressable>
  );
};

export interface LiquidTabItem<K extends string> {
  key: K;
  label: string;
  icon: MedIconName;
}

export function LiquidTabBar<K extends string>({
  items,
  activeKey,
  onSelect,
  accentColor = C.glowCyan,
}: {
  items: LiquidTabItem<K>[];
  activeKey: K;
  onSelect: (k: K) => void;
  accentColor?: string;
}) {
  return (
    <View style={styles.dockOuter}>
      <View style={[styles.dockGlass, WEB_GLASS_BLUR as ViewStyle]}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={[
                styles.dockItem,
                active && {
                  backgroundColor: `${accentColor}26`,
                  borderColor: `${accentColor}66`,
                  shadowColor: accentColor,
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                },
              ]}
            >
              <MedIcon
                name={item.icon}
                size={16}
                color={active ? '#FFFFFF' : '#94A3B8'}
                badge={false}
              />
              <Text style={[styles.dockLabel, active && { color: '#FFFFFF' }]} numberOfLines={1}>
                {item.label}
              </Text>
              {active && <View style={[styles.dockIndicator, { backgroundColor: accentColor }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbTopRight: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 310,
    height: 310,
    borderRadius: 180,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 190,
  },
  orbCenterGlow: {
    position: 'absolute',
    top: '35%',
    left: '15%',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  glassCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glassTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  glowBtn: {
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btnSpecular: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  glowBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dockOuter: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  dockGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(10, 18, 36, 0.86)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    paddingVertical: 7,
    paddingHorizontal: 6,
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
  },
  dockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dockIndicator: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
    marginTop: 2,
  },
});
