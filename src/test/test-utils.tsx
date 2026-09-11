import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderWithDefaults(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options);
}

export { renderWithDefaults as render };
