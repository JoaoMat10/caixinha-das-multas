import type { SeasonMembership } from '@/domains/auth/contracts/auth';

export const inputClass =
  'mt-2 block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-pitch-200 bg-white px-3 py-2 text-base text-pitch-950 sm:text-sm';
export const primaryButtonClass =
  'inline-flex min-h-12 max-w-full items-center justify-center rounded-xl bg-pitch-900 px-4 py-2 text-center leading-tight font-black text-white disabled:opacity-50';
export const secondaryButtonClass =
  'inline-flex min-h-12 max-w-full items-center justify-center rounded-xl border border-pitch-300 bg-white px-4 py-2 text-center leading-tight font-bold disabled:opacity-50';
export const cardClass =
  'domain-card min-w-0 rounded-2xl border border-pitch-200 bg-white p-4 shadow-sm sm:p-6';

export function TreasurerSeasonSelect({
  memberships,
  seasonId,
  onChange,
}: {
  memberships: SeasonMembership[];
  seasonId: string;
  onChange: (seasonId: string) => void;
}) {
  return (
    <label className="block max-w-lg space-y-2 text-sm font-semibold">
      <span>Época</span>
      <select
        className={inputClass}
        value={seasonId}
        onChange={(event) => onChange(event.target.value)}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.seasonId}>
            {membership.teamName} · {membership.seasonName} (
            {membership.seasonStatus})
          </option>
        ))}
      </select>
    </label>
  );
}

export function FinancialMessage({
  error,
  notice,
  floating = false,
}: {
  error: string | null;
  notice: string | null;
  floating?: boolean;
}) {
  if (!error && !notice) return null;
  return (
    <div className={`feedback-stack ${floating ? 'floating' : ''}`}>
      {error ? (
        <p
          className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="rounded-xl bg-emerald-100 p-3 text-sm font-semibold text-emerald-900"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
