import { useColorScheme } from '@/hooks/use-color-scheme';

import { PosColors } from '@/constants/pos-theme';

export function usePosTheme() {
  const scheme = useColorScheme();
  const key = scheme === 'dark' ? 'dark' : 'light';
  return PosColors[key];
}
