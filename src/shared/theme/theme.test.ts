import { describe, expect, it, vi } from 'vitest';

import {
  THEME_STORAGE_KEY,
  applyTheme,
  defaultTheme,
  persistTheme,
  readTheme,
  themes,
} from '@/shared/theme/theme';

describe('tema da aplicação', () => {
  it('usa Balneário Premium e rejeita preferências desconhecidas', () => {
    expect(themes.map((theme) => theme.id)).toEqual(['balneario-premium']);
    expect(readTheme({ getItem: () => 'clube-minimalista' })).toBe(
      defaultTheme,
    );
  });

  it('persiste apenas o identificador visual e aplica o tema', () => {
    const setItem = vi.fn();
    persistTheme('balneario-premium', { setItem });
    expect(setItem).toHaveBeenCalledWith(
      THEME_STORAGE_KEY,
      'balneario-premium',
    );
    expect(document.documentElement.dataset.theme).toBe('balneario-premium');
  });

  it('aplica o esquema escuro antes da interface', () => {
    applyTheme('balneario-premium');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
