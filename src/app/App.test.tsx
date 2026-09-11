import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppProviders } from '@/app/AppProviders';
import { createAppQueryClient } from '@/app/queryClient';
import { createTestRouter } from '@/app/router';
import { render } from '@/test/test-utils';

describe('shell da aplicação', () => {
  it('apresenta a fundação e navega para um módulo placeholder', async () => {
    const user = userEvent.setup();
    const router = createTestRouter(['/']);

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', {
        name: /a base está pronta para entrar em campo/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Tesouraria' }));

    expect(
      await screen.findByRole('heading', {
        name: /tesouraria sem operações nesta fase/i,
      }),
    ).toBeInTheDocument();
  });

  it('apresenta uma página de erro para uma rota desconhecida', () => {
    const router = createTestRouter(['/rota-inexistente']);

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { name: /página não encontrada/i }),
    ).toBeInTheDocument();
  });
});
