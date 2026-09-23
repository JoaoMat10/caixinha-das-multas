import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// As rotas são carregadas com React.lazy; em máquinas frias, a transformação do
// primeiro módulo pode exceder o segundo usado por defeito pelo Testing Library.
configure({ asyncUtilTimeout: 3_000 });

afterEach(() => {
  cleanup();
});
