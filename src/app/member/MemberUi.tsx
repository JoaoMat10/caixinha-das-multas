import type { SeasonMembership } from '@/domains/auth/contracts/auth';
import { memberDescription } from '@/domains/dashboard/rules/dashboardRules';

export const memberCardClass =
  'member-card rounded-2xl border border-pitch-200 bg-white p-4 shadow-sm sm:p-6';

export function MemberSeasonSelect({
  memberships,
  seasonId,
  onChange,
}: {
  memberships: SeasonMembership[];
  seasonId: string;
  onChange: (seasonId: string) => void;
}) {
  if (memberships.length <= 1) return null;
  return (
    <label className="block max-w-lg space-y-2 text-sm font-semibold">
      <span>Equipa e época</span>
      <select
        className="border-pitch-200 text-pitch-950 min-h-11 w-full rounded-xl border bg-white px-3 py-2"
        value={seasonId}
        onChange={(event) => onChange(event.target.value)}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.seasonId}>
            {membership.teamName} · {membership.seasonName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MemberAvatar({
  name,
  url,
  size = 'large',
}: {
  name: string;
  url: string | null;
  size?: 'small' | 'large';
}) {
  const classes =
    size === 'large'
      ? 'size-20 rounded-2xl text-2xl'
      : 'size-11 rounded-xl text-sm';
  if (url)
    return (
      <img
        alt={`Fotografia de ${name}`}
        className={`${classes} border-pitch-100 shrink-0 border object-cover`}
        src={url}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={`${classes} bg-pitch-100 text-pitch-800 grid shrink-0 place-items-center font-black`}
    >
      {name.trim().slice(0, 2).toLocaleUpperCase('pt-PT')}
    </span>
  );
}

export function MemberIdentity({
  member,
  compact = false,
}: {
  member: {
    displayName: string;
    avatarUrl: string | null;
    memberType: 'player' | 'staff';
    shirtNumber: number | null;
    staffFunction: string | null;
    isCaptain: boolean;
  };
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar
        name={member.displayName}
        size={compact ? 'small' : 'large'}
        url={member.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className={compact ? 'truncate' : 'text-xl'}>
            {member.displayName}
          </strong>
          {member.isCaptain ? (
            <span
              aria-label="Capitão"
              className="bg-gold-400 text-pitch-950 inline-grid size-6 place-items-center rounded-full text-xs font-black"
              title="Capitão"
            >
              C
            </span>
          ) : null}
        </div>
        <p className="text-pitch-600 text-sm">{memberDescription(member)}</p>
      </div>
    </div>
  );
}

export function MemberQueryError({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-2xl bg-red-100 p-4 text-red-950" role="alert">
      <p className="font-bold">Não foi possível carregar os dados.</p>
      <p className="mt-1 text-sm">Verifica a ligação e tenta novamente.</p>
      <button
        className="mt-3 min-h-11 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold"
        onClick={retry}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}
