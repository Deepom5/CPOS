/**
 * POS palette layered on top of the base theme. Used by the billing, checkout
 * and receipt screens. Keep this small — semantic tokens only.
 */
import { Colors } from './theme';

export const Brand = {
  '50': '#E8F2FE',
  '100': '#C5DDFC',
  '300': '#6FACF6',
  '500': '#208AEF',
  '600': '#0F6CC4',
  '700': '#0A5097',
} as const;

export const PosColors = {
  light: {
    ...Colors.light,
    brand: Brand['500'],
    brandText: '#ffffff',
    brandSoft: Brand['50'],
    surface: '#ffffff',
    surfaceMuted: '#F7F8FA',
    border: '#E3E5EA',
    borderStrong: '#CFD3DA',
    success: '#1F9D55',
    warning: '#D98E00',
    danger: '#D9342B',
    successSoft: '#E5F4EC',
    warningSoft: '#FBF1DA',
    dangerSoft: '#FCE6E5',
  },
  dark: {
    ...Colors.dark,
    brand: Brand['500'],
    brandText: '#ffffff',
    brandSoft: '#0F2944',
    surface: '#111114',
    surfaceMuted: '#191A1D',
    border: '#2A2C31',
    borderStrong: '#3A3D44',
    success: '#3DD68C',
    warning: '#F2B83A',
    danger: '#F26B62',
    successSoft: '#143324',
    warningSoft: '#3A2C0F',
    dangerSoft: '#3A1B19',
  },
} as const;

export type PosColorToken = keyof typeof PosColors.light & keyof typeof PosColors.dark;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const Elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
