import { useState, type FormEvent } from 'react';

import type {
  AdminOverview,
  AdminUser,
  TemporaryPasswordResult,
} from '@/domains/admin/contracts/admin';
import {
  fieldClass,
  formActionsClass,
  primaryButtonClass,
  secondaryButtonClass,
  SectionCard,
} from '@/domains/admin/presentation/adminUi';
import type { AdminService } from '@/domains/admin/services/AdminService';

type Props = {
  overview: AdminOverview;
  service: AdminService;
  busy: boolean;
  run: <T>(
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ) => Promise<void>;
};

export function AdminUsersSection({ overview, service, busy, run }: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [passwordResetKeys, setPasswordResetKeys] = useState<
    Record<string, string>
  >({});

  const filtered = overview.users.filter((user) =>
    `${user.displayName} ${user.username}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function startEditing(user: AdminUser) {
    setEditing(user);
    setUsername(user.username);
    setDisplayName(user.displayName);
    setTemporaryPassword(null);
  }

  function clearForm() {
    setEditing(null);
    setUsername('');
    setDisplayName('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await run(
        () => service.updateUser({ id: editing.id, username, displayName }),
        clearForm,
      );
      return;
    }
    await run(
      () =>
        service.createUser({
          username,
          displayName,
          idempotencyKey: crypto.randomUUID(),
        }),
      (result: TemporaryPasswordResult) => {
        clearForm();
        setTemporaryPassword(result.temporaryPassword);
      },
    );
  }

  function resetPassword(userId: string) {
    const idempotencyKey = passwordResetKeys[userId] ?? crypto.randomUUID();
    setPasswordResetKeys((current) => ({
      ...current,
      [userId]: idempotencyKey,
    }));
    return run(
      () => service.resetPassword({ userId, idempotencyKey }),
      (result: TemporaryPasswordResult) => {
        setPasswordResetKeys((current) => {
          const next = { ...current };
          delete next[userId];
          return next;
        });
        setTemporaryPassword(result.temporaryPassword);
      },
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <SectionCard
        title={editing ? 'Editar utilizador' : 'Criar utilizador'}
        description="O email técnico nunca é apresentado ou pedido."
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold">
            Username
            <input
              className={`${fieldClass} mt-1`}
              maxLength={32}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className="block text-sm font-semibold">
            Nome apresentado
            <input
              className={`${fieldClass} mt-1`}
              maxLength={120}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <div className={formActionsClass}>
            <button
              className={primaryButtonClass}
              disabled={busy}
              type="submit"
            >
              {editing ? 'Guardar' : 'Criar conta'}
            </button>
            {editing ? (
              <button
                className={secondaryButtonClass}
                onClick={clearForm}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
        {temporaryPassword ? (
          <div
            className="bg-gold-100 text-gold-800 mt-4 rounded-xl p-3"
            role="status"
          >
            <p className="text-xs font-bold uppercase">
              Password temporária — mostrar uma vez
            </p>
            <code className="mt-1 block text-base font-bold break-all select-all">
              {temporaryPassword}
            </code>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Utilizadores"
        description="Pesquisa, estado, credenciais temporárias e fotografia."
      >
        <label className="sr-only" htmlFor="admin-user-search">
          Pesquisar utilizadores
        </label>
        <input
          className={fieldClass}
          id="admin-user-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por nome ou username"
          type="search"
          value={search}
        />
        <ul className="mt-4 space-y-3">
          {filtered.map((user) => (
            <li
              className="border-pitch-100 rounded-2xl border p-4"
              key={user.id}
            >
              <div className="grid min-w-0 gap-3">
                <div className="min-w-0">
                  <p className="font-bold break-words">{user.displayName}</p>
                  <p className="text-pitch-600 text-sm break-words">
                    @{user.username} · {user.isActive ? 'Ativo' : 'Desativado'}
                    {user.mustChangePassword
                      ? ' · alteração de password pendente'
                      : ''}
                  </p>
                  <p className="text-pitch-600 text-xs">
                    {user.avatarPath ? 'Com fotografia' : 'Sem fotografia'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => startEditing(user)}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        service.setUserActive(user.id, !user.isActive),
                      )
                    }
                    type="button"
                  >
                    {user.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => void resetPassword(user.id)}
                    type="button"
                  >
                    Repor password
                  </button>
                  <label
                    className={`${secondaryButtonClass} grid cursor-pointer place-items-center`}
                  >
                    Fotografia
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          void run(() =>
                            service.uploadUserPhoto(user.id, file),
                          );
                        event.target.value = '';
                      }}
                      type="file"
                    />
                  </label>
                  {user.avatarPath ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={busy}
                      onClick={() =>
                        void run(() => service.removeUserPhoto(user.id))
                      }
                      type="button"
                    >
                      Remover foto
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-pitch-600 border-pitch-200 rounded-xl border border-dashed p-4 text-sm">
              Nenhum utilizador corresponde à pesquisa.
            </li>
          ) : null}
        </ul>
      </SectionCard>
    </div>
  );
}
