import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createFormResolver } from '@/shared/forms/validation';
import { render } from '@/test/test-utils';

const exampleSchema = z.object({
  label: z.string().min(3, 'Indica pelo menos três caracteres.'),
});

type ExampleForm = z.infer<typeof exampleSchema>;

function ValidatedExampleForm() {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ExampleForm>({ resolver: createFormResolver(exampleSchema) });

  const submit = () => undefined;

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      <label htmlFor="label">Etiqueta</label>
      <input id="label" {...register('label')} />
      {errors.label ? <p role="alert">{errors.label.message}</p> : null}
      <button type="submit">Validar</button>
    </form>
  );
}

describe('integração de formulários e validação', () => {
  it('expõe os erros Zod através de React Hook Form', async () => {
    const user = userEvent.setup();
    render(<ValidatedExampleForm />);

    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'ab');
    await user.click(screen.getByRole('button', { name: 'Validar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Indica pelo menos três caracteres.',
    );
  });
});
