import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AuthGateway,
  AuthenticatedUser,
  AuthSessionEvent,
} from '@/domains/auth/contracts/auth';
import {
  AuthService,
  genericLoginError,
} from '@/domains/auth/services/AuthService';
import type { AuthContextValue } from '@/domains/auth/state/authContext';
import { AuthProvider } from '@/domains/auth/state/AuthProvider';
import { useAuth } from '@/domains/auth/state/useAuth';

const user: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'tesoureiro.a',
  displayName: 'Tesoureiro A',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createGateway() {
  let listener: ((event: AuthSessionEvent) => void) | undefined;
  const signIn = vi.fn();
  const getSession = vi.fn().mockResolvedValue(null);
  const loadAuthorizationContext = vi.fn().mockResolvedValue(user);
  const signOut = vi.fn().mockResolvedValue(undefined);
  const gateway: AuthGateway = {
    signIn,
    getSession,
    loadAuthorizationContext,
    updatePassword: vi.fn(),
    signOut,
    onSessionEvent: vi.fn((nextListener) => {
      listener = nextListener;
      return () => undefined;
    }),
  };

  return {
    gateway,
    signIn,
    getSession,
    loadAuthorizationContext,
    signOut,
    emit: (event: AuthSessionEvent) => {
      if (!listener) throw new Error('O listener de sessão não foi registado.');
      listener(event);
    },
  };
}

function Probe({ onChange }: { onChange: (value: AuthContextValue) => void }) {
  const auth = useAuth();

  useEffect(() => onChange(auth), [auth, onChange]);

  return (
    <div>
      <div data-testid="auth-status">{auth.status}</div>
      <div data-testid="auth-error">{auth.error}</div>
    </div>
  );
}

async function renderProvider(gateway: AuthGateway) {
  let currentContext: AuthContextValue | undefined;
  const onChange = (value: AuthContextValue) => {
    currentContext = value;
  };

  render(
    <AuthProvider service={new AuthService(gateway)}>
      <Probe onChange={onChange} />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous'),
  );

  return () => {
    if (!currentContext)
      throw new Error('O contexto Auth não está disponível.');
    return currentContext;
  };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each<AuthSessionEvent>(['signed-in', 'token-refreshed', 'user-updated'])(
    'difere a recuperação do evento %s para a tarefa seguinte',
    async (event) => {
      const { gateway, emit, getSession } = createGateway();
      await renderProvider(gateway);
      getSession.mockClear();

      act(() => emit(event));
      expect(getSession).not.toHaveBeenCalled();

      await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
    },
  );

  it('não restaura um resultado antigo depois de logout', async () => {
    const { gateway, emit, getSession, loadAuthorizationContext } =
      createGateway();
    const getContext = await renderProvider(gateway);
    const pendingUser = deferred<AuthenticatedUser>();
    getSession.mockResolvedValueOnce({
      userId: user.id,
      expiresAt: Math.ceil(Date.now() / 1000) + 60,
    });
    loadAuthorizationContext.mockReturnValueOnce(pendingUser.promise);

    act(() => emit('signed-in'));
    await waitFor(() =>
      expect(loadAuthorizationContext).toHaveBeenCalledOnce(),
    );
    await act(async () => getContext().logout());
    pendingUser.resolve(user);
    await act(async () => pendingUser.promise);

    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
  });

  it('preserva o erro genérico quando um login falhado emite SIGNED_OUT', async () => {
    const { gateway, emit, signIn, signOut } = createGateway();
    const getContext = await renderProvider(gateway);
    signIn.mockRejectedValueOnce(new Error('credenciais inválidas'));
    signOut.mockImplementationOnce(() => {
      emit('signed-out');
      return Promise.resolve();
    });

    let loginError: unknown;
    await act(async () => {
      try {
        await getContext().login('tesoureiro.a', 'Errada1');
      } catch (error) {
        loginError = error;
      }
    });
    expect(loginError).toMatchObject({ message: genericLoginError });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
      expect(screen.getByTestId('auth-error')).toHaveTextContent(
        genericLoginError,
      );
    });
  });

  it('não restaura um resultado antigo depois de desativação ou SIGNED_OUT', async () => {
    const { gateway, emit, getSession, loadAuthorizationContext } =
      createGateway();
    await renderProvider(gateway);
    const pendingUser = deferred<AuthenticatedUser>();
    getSession.mockResolvedValueOnce({
      userId: user.id,
      expiresAt: Math.ceil(Date.now() / 1000) + 60,
    });
    loadAuthorizationContext.mockReturnValueOnce(pendingUser.promise);

    act(() => emit('token-refreshed'));
    await waitFor(() =>
      expect(loadAuthorizationContext).toHaveBeenCalledOnce(),
    );
    act(() => emit('signed-out'));
    pendingUser.resolve(user);
    await act(async () => pendingUser.promise);

    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
  });

  it('cancela uma recuperação agendada quando recebe SIGNED_OUT', async () => {
    const { gateway, emit, getSession } = createGateway();
    await renderProvider(gateway);
    getSession.mockClear();

    act(() => {
      emit('signed-in');
      emit('signed-out');
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(getSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
  });
});
