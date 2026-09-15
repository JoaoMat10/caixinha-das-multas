import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthCard } from '@/domains/auth/presentation/AuthCard';
import {
  passwordChangeSchema,
  type PasswordChangeForm,
} from '@/domains/auth/rules/password';
import { useAuth } from '@/domains/auth/state/useAuth';

const inputClasses =
  'border-pitch-200 focus:border-pitch-700 focus:ring-pitch-700 mt-2 min-h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:ring-2 focus:ring-offset-1';

export function PasswordChangePage({
  required = false,
}: {
  required?: boolean;
}) {
  const { changePassword, error, isBusy, logout } = useAuth();
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
  });
  const disabled = isBusy || isSubmitting;

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setSuccess(false);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      reset();
    } catch {
      // O contexto apresenta sempre a mensagem genérica definida pelo serviço.
    }
  });

  const form = (
    <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <label className="text-sm font-bold" htmlFor="current-password">
          Password atual
        </label>
        <input
          {...register('currentPassword')}
          autoComplete="current-password"
          className={inputClasses}
          disabled={disabled}
          id="current-password"
          type="password"
        />
        {errors.currentPassword && (
          <p className="mt-2 text-sm text-red-700">
            {errors.currentPassword.message}
          </p>
        )}
      </div>
      <div>
        <label className="text-sm font-bold" htmlFor="new-password">
          Nova password
        </label>
        <input
          {...register('newPassword')}
          autoComplete="new-password"
          className={inputClasses}
          disabled={disabled}
          id="new-password"
          type="password"
        />
        {errors.newPassword && (
          <p className="mt-2 text-sm text-red-700">
            {errors.newPassword.message}
          </p>
        )}
      </div>
      <div>
        <label className="text-sm font-bold" htmlFor="confirm-password">
          Confirmar nova password
        </label>
        <input
          {...register('confirmPassword')}
          autoComplete="new-password"
          className={inputClasses}
          disabled={disabled}
          id="confirm-password"
          type="password"
        />
        {errors.confirmPassword && (
          <p className="mt-2 text-sm text-red-700">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
      <p className="text-pitch-600 text-xs leading-5">
        Mínimo de 6 caracteres, com maiúscula, minúscula e número.
      </p>
      {error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          aria-live="polite"
          className="border-pitch-200 bg-pitch-50 text-pitch-800 rounded-xl border p-3 text-sm"
        >
          Password alterada com sucesso.
        </p>
      )}
      <button
        className="bg-pitch-900 hover:bg-pitch-800 focus-visible:outline-pitch-700 min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        {disabled ? 'A guardar…' : 'Guardar nova password'}
      </button>
    </form>
  );

  if (!required) return form;

  return (
    <AuthCard
      eyebrow="Segurança da conta"
      title="Define uma nova password"
      description="A password temporária tem de ser substituída antes de aceder à aplicação."
    >
      {form}
      <button
        className="text-pitch-700 hover:text-pitch-950 mt-5 min-h-11 w-full text-sm font-bold"
        disabled={disabled}
        onClick={() => void logout()}
        type="button"
      >
        Sair
      </button>
    </AuthCard>
  );
}
