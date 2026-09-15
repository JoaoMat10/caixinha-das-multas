import { useState, type FormEvent } from 'react';

import type {
  AdminOverview,
  AdminSeason,
  AdminTeam,
} from '@/domains/admin/contracts/admin';
import {
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  SectionCard,
} from '@/domains/admin/presentation/adminUi';
import type { AdminService } from '@/domains/admin/services/AdminService';
import type { AdminSeasonStatus } from '@/domains/admin/contracts/admin';

type Props = {
  overview: AdminOverview;
  service: AdminService;
  busy: boolean;
  run: <T>(
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ) => Promise<void>;
};

export function AdminTeamsSection({ overview, service, busy, run }: Props) {
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamActive, setTeamActive] = useState(true);
  const [editingSeason, setEditingSeason] = useState<AdminSeason | null>(null);
  const [teamId, setTeamId] = useState(overview.teams[0]?.id ?? '');
  const [seasonName, setSeasonName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [seasonStatus, setSeasonStatus] = useState<AdminSeasonStatus>('draft');
  const [copyFrom, setCopyFrom] = useState('');

  function resetTeam() {
    setEditingTeam(null);
    setTeamName('');
    setTeamActive(true);
  }
  function editTeam(team: AdminTeam) {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamActive(team.isActive);
  }
  async function submitTeam(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        service.saveTeam({
          id: editingTeam?.id,
          name: teamName,
          isActive: teamActive,
        }),
      resetTeam,
    );
  }

  function resetSeason() {
    setEditingSeason(null);
    setSeasonName('');
    setStartsOn('');
    setEndsOn('');
    setSeasonStatus('draft');
    setCopyFrom('');
  }
  function editSeason(season: AdminSeason) {
    setEditingSeason(season);
    setTeamId(season.teamId);
    setSeasonName(season.name);
    setStartsOn(season.startsOn ?? '');
    setEndsOn(season.endsOn ?? '');
    setSeasonStatus(season.status);
    setCopyFrom('');
  }
  async function submitSeason(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        service.saveSeason({
          id: editingSeason?.id,
          teamId,
          name: seasonName,
          startsOn: startsOn || null,
          endsOn: endsOn || null,
          status: seasonStatus,
          copyFromSeasonId: editingSeason ? null : copyFrom || null,
          idempotencyKey: crypto.randomUUID(),
        }),
      resetSeason,
    );
  }

  const copyOptions = overview.seasons.filter(
    (season) => season.teamId === teamId,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={editingTeam ? 'Editar equipa' : 'Criar equipa'}>
          <form
            className="space-y-4"
            onSubmit={(event) => void submitTeam(event)}
          >
            <label className="block text-sm font-semibold">
              Nome
              <input
                className={`${fieldClass} mt-1`}
                onChange={(event) => setTeamName(event.target.value)}
                required
                value={teamName}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                checked={teamActive}
                onChange={(event) => setTeamActive(event.target.checked)}
                type="checkbox"
              />{' '}
              Equipa ativa
            </label>
            <div className="flex gap-2">
              <button
                className={primaryButtonClass}
                disabled={busy}
                type="submit"
              >
                Guardar equipa
              </button>
              {editingTeam ? (
                <button
                  className={secondaryButtonClass}
                  onClick={resetTeam}
                  type="button"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title={editingSeason ? 'Editar época' : 'Criar época'}
          description="A cópia inclui apenas plantel ativo, roles e catálogo."
        >
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void submitSeason(event)}
          >
            <label className="block text-sm font-semibold">
              Equipa
              <select
                className={`${fieldClass} mt-1`}
                disabled={Boolean(editingSeason)}
                onChange={(event) => {
                  setTeamId(event.target.value);
                  setCopyFrom('');
                }}
                required
                value={teamId}
              >
                <option value="">Selecionar</option>
                {overview.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Nome da época
              <input
                className={`${fieldClass} mt-1`}
                onChange={(event) => setSeasonName(event.target.value)}
                placeholder="2027/28"
                required
                value={seasonName}
              />
            </label>
            <label className="block text-sm font-semibold">
              Início
              <input
                className={`${fieldClass} mt-1`}
                onChange={(event) => setStartsOn(event.target.value)}
                type="date"
                value={startsOn}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fim
              <input
                className={`${fieldClass} mt-1`}
                onChange={(event) => setEndsOn(event.target.value)}
                type="date"
                value={endsOn}
              />
            </label>
            <label className="block text-sm font-semibold">
              Estado
              <select
                className={`${fieldClass} mt-1`}
                onChange={(event) =>
                  setSeasonStatus(event.target.value as AdminSeasonStatus)
                }
                value={seasonStatus}
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativa</option>
                <option value="archived">Arquivada</option>
              </select>
            </label>
            {!editingSeason ? (
              <label className="block text-sm font-semibold">
                Copiar de
                <select
                  className={`${fieldClass} mt-1`}
                  onChange={(event) => setCopyFrom(event.target.value)}
                  value={copyFrom}
                >
                  <option value="">Não copiar</option>
                  {copyOptions.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <button
                className={primaryButtonClass}
                disabled={busy}
                type="submit"
              >
                Guardar época
              </button>
              {editingSeason ? (
                <button
                  className={secondaryButtonClass}
                  onClick={resetSeason}
                  type="button"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Equipas e épocas">
        <div className="space-y-4">
          {overview.teams.map((team) => (
            <article
              className="border-pitch-100 rounded-2xl border p-4"
              key={team.id}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{team.name}</h3>
                  <p className="text-pitch-600 text-sm">
                    {team.isActive ? 'Ativa' : 'Desativada'}
                  </p>
                </div>
                <button
                  className={secondaryButtonClass}
                  onClick={() => editTeam(team)}
                  type="button"
                >
                  Editar equipa
                </button>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {overview.seasons
                  .filter((season) => season.teamId === team.id)
                  .map((season) => (
                    <li className="bg-pitch-50 rounded-xl p-3" key={season.id}>
                      <p className="font-semibold">{season.name}</p>
                      <p className="text-pitch-600 text-xs">{season.status}</p>
                      <button
                        className="text-pitch-700 mt-2 text-sm font-bold underline"
                        onClick={() => editSeason(season)}
                        type="button"
                      >
                        Editar época
                      </button>
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
