import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { render } from '@/test/test-utils';

describe('ConfirmDialog', () => {
  it('expõe nomes acessíveis, move o foco e fecha com Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        confirmLabel="Eliminar multa"
        description="A multa será eliminada."
        destructive
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
        title="Eliminar multa?"
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Eliminar multa?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
