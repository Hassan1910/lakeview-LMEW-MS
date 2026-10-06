import { StyleSheet } from 'react-native';
import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const palette = {
  primary: '#0B4F6C',
  primaryDark: '#083A50',
  accent: '#01BAEF',
  bg: '#F4F7F8',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  success: '#166534',
  successBg: '#F0FDF4',
  warningBg: '#FFFBEB',
};

export const lmewMobileTheme = {
  ...DefaultTheme,
  roundness: 10,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    primaryContainer: '#E0F2FE',
    secondary: palette.accent,
    secondaryContainer: '#F0F9FF',
    tertiary: '#F59E0B',
    error: '#EF4444',
    background: palette.bg,
    surface: palette.surface,
    surfaceVariant: '#F1F5F9',
    onSurface: palette.text,
    outline: palette.border,
  },
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  pad: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { color: palette.text, fontSize: 22, fontWeight: '700' },
  section: { color: palette.text, fontSize: 16, fontWeight: '600' },
  body: { color: palette.text, fontSize: 15, lineHeight: 22 },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 8,
  },
});
