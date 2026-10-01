import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthCard } from '@/domains/auth/presentation/AuthCard';
import { normalizeUsername } from '@/domains/auth/rules/username';
import { useAuth } from '@/domains/auth/state/useAuth';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Indica o username.'),
  password: z.string().min(1, 'Indica a password.'),
});

type LoginForm = z.infer<typeof loginSchema>;

const inputClasses =
  'border-pitch-200 focus:border-pitch-700 focus:ring-pitch-700 mt-2 min-h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:ring-2 focus:ring-offset-1';

export function LoginPage() {
  const { login, error, isBusy, status } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const disabled = isBusy || isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(normalizeUsername(values.username), values.password);
    } catch {
      // O contexto apresenta sempre a mensagem genérica definida pelo serviço.
    }
  });

  return (
    <AuthCard
      eyebrow="Acesso reservado"
      title="Entrar"
      description="Usa o username atribuído pela organização. Não é necessário indicar qualquer email."
    >
      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <label className="text-sm font-bold" htmlFor="username">
            Username
          </label>
          <input
            {...register('username')}
            autoCapitalize="none"
            autoComplete="username"
            className={inputClasses}
            disabled={disabled}
            id="username"
            spellCheck={false}
          />
          {errors.username && (
            <p className="mt-2 text-sm text-red-700">
              {errors.username.message}
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-bold" htmlFor="password">
            Password
          </label>
          <div className="password-input-wrap">
            <input
              {...register('password')}
              autoComplete="current-password"
              className={inputClasses}
              disabled={disabled}
              id="password"
              type={passwordVisible ? 'text' : 'password'}
            />
            <button
              aria-label={
                passwordVisible ? 'Ocultar password' : 'Mostrar password'
              }
              className="password-toggle"
              disabled={disabled}
              onClick={() => setPasswordVisible((current) => !current)}
              type="button"
            >
              {passwordVisible ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-red-700">
              {errors.password.message}
            </p>
          )}
        </div>
        {error && status !== 'loading' && (
          <p
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          className="bg-pitch-900 hover:bg-pitch-800 focus-visible:outline-pitch-700 min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          {disabled ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </AuthCard>
  );
}
