export const colors = {
  primary: '#0B4F6C',
  primaryDark: '#083A50',
  accent: '#01BAEF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral900: '#0F172A',
  neutral700: '#334155',
  neutral500: '#64748B',
  neutral200: '#E2E8F0',
  neutral50: '#F8FAFC',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#0F172A',
  brand: {
    lakeBlue: {
      900: '#083A50',
      800: '#0B4F6C',
      700: '#0F4C81',
      600: '#1967B2',
      100: '#E0F2FE',
      50: '#F8FAFC',
    },
    teal: {
      700: '#0369A1',
      500: '#01BAEF',
      100: '#E0F2FE',
    },
    marineGold: {
      600: '#D97706',
      500: '#F59E0B',
      100: '#FEF3C7',
    },
    coral: {
      500: '#EF4444', // Danger/Emergency
      100: '#FEE2E2',
    },
  },
  neutral: {
    white: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
} as const;

export type BrandColors = typeof colors;
