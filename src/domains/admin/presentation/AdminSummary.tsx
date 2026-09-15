import type { AdminOverview } from '@/domains/admin/contracts/admin';
import { SectionCard } from '@/domains/admin/presentation/adminUi';

export function AdminSummary({ overview }: { overview: AdminOverview }) {
  const cards = [
    [
      'Utilizadores ativos',
      overview.users.filter((user) => user.isActive).length,
    ],
    ['Equipas ativas', overview.teams.filter((team) => team.isActive).length],
    [
      'Épocas ativas',
      overview.seasons.filter((season) => season.status === 'active').length,
    ],
    [
      'Membros ativos',
      overview.members.filter((member) => member.status === 'active').length,
    ],
  ] as const;

  return (
    <SectionCard
      title="Resumo administrativo"
      description="Visão global da configuração atual."
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="bg-pitch-50 rounded-2xl p-4" key={label}>
            <dt className="text-pitch-600 text-sm">{label}</dt>
            <dd className="mt-1 text-3xl font-black">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
