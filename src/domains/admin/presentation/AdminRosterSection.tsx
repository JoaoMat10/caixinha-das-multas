import { useState, type FormEvent } from 'react';

import type {
  AdminMember,
  AdminMemberRole,
  AdminMemberType,
  AdminOverview,
} from '@/domains/admin/contracts/admin';
import {
  fieldClass,
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

export function AdminRosterSection({ overview, service, busy, run }: Props) {
  const availableSeasons = overview.seasons.filter(
    (season) => season.status !== 'archived',
  );
  const [seasonId, setSeasonId] = useState(availableSeasons[0]?.id ?? '');
  const [editing, setEditing] = useState<AdminMember | null>(null);
  const [userId, setUserId] = useState('');
  const [memberType, setMemberType] = useState<AdminMemberType>('player');
  const [shirtNumber, setShirtNumber] = useState('');
  const [staffFunction, setStaffFunction] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [roles, setRoles] = useState<AdminMemberRole[]>([]);

  function reset() {
    setEditing(null);
    setUserId('');
    setMemberType('player');
    setShirtNumber('');
    setStaffFunction('');
    setStatus('active');
    setRoles([]);
  }
  function edit(member: AdminMember) {
    setEditing(member);
    setSeasonId(member.seasonId);
    setUserId(member.userId);
    setMemberType(member.memberType);
    setShirtNumber(member.shirtNumber?.toString() ?? '');
    setStaffFunction(member.staffFunction ?? '');
    setStatus(member.status);
    setRoles(member.roles);
  }
  function toggleRole(role: AdminMemberRole) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        service.saveMember({
          id: editing?.id,
          seasonId,
          userId,
          memberType,
          shirtNumber:
            memberType === 'player' && shirtNumber ? Number(shirtNumber) : null,
          staffFunction: memberType === 'staff' ? staffFunction : null,
          status,
          roles,
        }),
      reset,
    );
  }

  const members = overview.members.filter(
    (member) => member.seasonId === seasonId,
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <SectionCard title={editing ? 'Editar membro' : 'Adicionar ao plantel'}>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold">
            Época
            <select
              className={`${fieldClass} mt-1`}
              disabled={Boolean(editing)}
              onChange={(event) => setSeasonId(event.target.value)}
              required
              value={seasonId}
            >
              <option value="">Selecionar</option>
              {availableSeasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {
                    overview.teams.find((team) => team.id === season.teamId)
                      ?.name
                  }{' '}
                  · {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Utilizador
            <select
              className={`${fieldClass} mt-1`}
              disabled={Boolean(editing)}
              onChange={(event) => setUserId(event.target.value)}
              required
              value={userId}
            >
              <option value="">Selecionar</option>
              {overview.users
                .filter((user) => user.isActive)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Tipo
            <select
              className={`${fieldClass} mt-1`}
              onChange={(event) =>
                setMemberType(event.target.value as AdminMemberType)
              }
              value={memberType}
            >
              <option value="player">Jogador</option>
              <option value="staff">Equipa técnica</option>
            </select>
          </label>
          {memberType === 'player' ? (
            <label className="block text-sm font-semibold">
              Número da camisola
              <input
                className={`${fieldClass} mt-1`}
                max={999}
                min={1}
                onChange={(event) => setShirtNumber(event.target.value)}
                required
                type="number"
                value={shirtNumber}
              />
            </label>
          ) : (
            <label className="block text-sm font-semibold">
              Função técnica
              <input
                className={`${fieldClass} mt-1`}
                onChange={(event) => setStaffFunction(event.target.value)}
                required
                value={staffFunction}
              />
            </label>
          )}
          <fieldset>
            <legend className="text-sm font-semibold">
              Funções adicionais
            </legend>
            <div className="mt-2 flex gap-4">
              {(['captain', 'treasurer'] as const).map((role) => (
                <label className="flex items-center gap-2 text-sm" key={role}>
                  <input
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    type="checkbox"
                  />
                  {role === 'captain' ? 'Capitão' : 'Tesoureiro'}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            Estado
            <select
              className={`${fieldClass} mt-1`}
              onChange={(event) =>
                setStatus(event.target.value as 'active' | 'inactive')
              }
              value={status}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              className={primaryButtonClass}
              disabled={busy}
              type="submit"
            >
              Guardar membro
            </button>
            {editing ? (
              <button
                className={secondaryButtonClass}
                onClick={reset}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>
      <SectionCard
        title="Plantel"
        description="Capitão e tesoureiro podem coexistir."
      >
        <ul className="space-y-3">
          {members.map((member) => {
            const user = overview.users.find(
              (item) => item.id === member.userId,
            );
            return (
              <li
                className="border-pitch-100 flex items-center justify-between gap-3 rounded-2xl border p-4"
                key={member.id}
              >
                <div>
                  <p className="font-bold">
                    {user?.displayName ?? 'Utilizador'}
                  </p>
                  <p className="text-pitch-600 text-sm">
                    {member.memberType === 'player'
                      ? `Jogador · #${member.shirtNumber}`
                      : `Equipa técnica · ${member.staffFunction}`}{' '}
                    · {member.status === 'active' ? 'Ativo' : 'Inativo'}
                  </p>
                  <p className="text-pitch-600 text-xs">
                    {member.roles
                      .map((role) =>
                        role === 'captain' ? 'Capitão' : 'Tesoureiro',
                      )
                      .join(' · ') || 'Sem funções adicionais'}
                  </p>
                </div>
                <button
                  className={secondaryButtonClass}
                  onClick={() => edit(member)}
                  type="button"
                >
                  Editar
                </button>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}
