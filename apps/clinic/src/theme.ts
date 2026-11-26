/** Shared Liquid-Glass + Neon-Glow design tokens — MedCore Mobile */
export const C = {
  // Obsidian & Liquid Glass Surfaces
  canvas: '#030816',
  canvasAlt: '#071127',
  glass: 'rgba(15, 23, 42, 0.58)',
  glassStrong: 'rgba(15, 23, 42, 0.78)',
  glassSoft: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassRim: 'rgba(255, 255, 255, 0.34)',

  // Light compatibility tokens used by existing sub-screens
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  teal: '#14B8A6',
  tealSoft: '#CCFBF1',
  bg: '#040B1A',
  card: '#0C162D',
  text: '#F8FAFC',
  textDark: '#0F172A',
  muted: '#94A3B8',
  border: 'rgba(148, 163, 184, 0.22)',

  // Luminous Accents & Glows
  glowCyan: '#22D3EE',
  glowBlue: '#38BDF8',
  glowEmerald: '#10B981',
  glowViolet: '#8B5CF6',
  glowAmber: '#F59E0B',
  glowRose: '#F43F5E',

  // Status
  danger: '#FB7185',
  dangerSoft: 'rgba(244, 63, 94, 0.16)',
  success: '#34D399',
  successSoft: 'rgba(16, 185, 129, 0.16)',
  warning: '#FBBF24',
  warningSoft: 'rgba(245, 158, 11, 0.16)',
  purple: '#A78BFA',
  purpleSoft: 'rgba(139, 92, 246, 0.18)',
  orange: '#FB923C',
  orangeSoft: 'rgba(251, 146, 60, 0.16)',
};

export type PropsWithBack = { onBack?: () => void };
