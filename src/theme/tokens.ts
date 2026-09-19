/**
 * Tokeny designu.
 *
 * Styl: minimalistyczny, inspirowany interfejsami Apple i prostota Stravy.
 * Priorytet to czytelnosc - zwlaszcza podczas treningu, gdy uzytkownik patrzy
 * na ekran z podlogi, z pewnej odleglosci i w ruchu. Stad ogromne cyfry,
 * duzo przestrzeni, jeden kolor akcentu i brak gradientow oraz ciezkich cieni.
 */

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  overlay: string;
  /** Tlo paska postepu i innych torow. */
  track: string;
}

export const LIGHT_COLORS: ColorPalette = {
  background: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceElevated: '#FFFFFF',
  text: '#0B0B0F',
  textSecondary: '#6B6B76',
  textTertiary: '#A0A0AB',
  accent: '#FF6B35',
  accentText: '#FFFFFF',
  success: '#2FA84F',
  warning: '#E8A317',
  danger: '#E5484D',
  border: '#E4E4E9',
  overlay: 'rgba(0, 0, 0, 0.55)',
  track: '#E8E8ED',
};

export const DARK_COLORS: ColorPalette = {
  background: '#0B0B0F',
  surface: '#16161C',
  surfaceElevated: '#1E1E26',
  text: '#FFFFFF',
  textSecondary: '#9A9AA5',
  textTertiary: '#6B6B76',
  accent: '#FF7A47',
  accentText: '#FFFFFF',
  success: '#3DD35F',
  warning: '#F5B942',
  danger: '#FF5F62',
  border: '#2A2A33',
  overlay: 'rgba(0, 0, 0, 0.7)',
  track: '#2A2A33',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/**
 * Skala typograficzna. `display` sluzy licznikowi podczas treningu -
 * ma byc czytelny z odleglosci kilku metrow.
 */
export const TYPOGRAPHY = {
  display: { fontSize: 96, lineHeight: 100, fontWeight: '700' },
  counter: { fontSize: 140, lineHeight: 146, fontWeight: '700' },
  title1: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title2: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title3: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof TYPOGRAPHY;

export interface Theme {
  colors: ColorPalette;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  typography: typeof TYPOGRAPHY;
  isDark: boolean;
}

export function createTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    spacing: SPACING,
    radius: RADIUS,
    typography: TYPOGRAPHY,
    isDark,
  };
}
