import { describe, expect, it } from 'vitest';

import {
  OFFLINE_WRITE_MESSAGE,
  requireOnline,
} from '@/shared/network/requireOnline';

describe('operações online', () => {
  it('bloqueia explicitamente uma escrita sem rede', () => {
    expect(() => requireOnline({ onLine: false })).toThrow(
      OFFLINE_WRITE_MESSAGE,
    );
  });

  it('permite continuar quando existe ligação', () => {
    expect(() => requireOnline({ onLine: true })).not.toThrow();
  });
});
