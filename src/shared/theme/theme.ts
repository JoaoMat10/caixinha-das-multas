export const THEME_STORAGE_KEY = 'caixinha.theme';

export type ThemeId = 'balneario-premium';

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  colorScheme: 'dark';
};

export const themes: readonly ThemeDefinition[] = [
  {
    id: 'balneario-premium',
    name: 'Balneário Premium',
    description: 'Verde profundo, preto e dourado.',
    colorScheme: 'dark',
  },
] as const;

export const defaultTheme: ThemeId = 'balneario-premium';

export function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function readTheme(storage?: Pick<Storage, 'getItem'>): ThemeId {
  if (!storage) return defaultTheme;
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

export function applyTheme(
  theme: ThemeId,
  root: Pick<HTMLElement, 'dataset' | 'style'> = document.documentElement,
) {
  root.dataset.theme = theme;
  root.style.colorScheme = 'dark';
}

export function initializeTheme() {
  const theme = readTheme(
    typeof window === 'undefined' ? undefined : window.localStorage,
  );
  if (typeof document !== 'undefined') applyTheme(theme);
  return theme;
}

export function persistTheme(
  theme: ThemeId,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) {
  storage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}
