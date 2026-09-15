import type { AdminOverview } from '@/domains/admin/contracts/admin';
import { SectionCard } from '@/domains/admin/presentation/adminUi';

const actionLabels: Record<string, string> = {
  'user.created': 'Utilizador criado',
  'user.updated': 'Utilizador alterado',
  'user.deactivated': 'Utilizador desativado',
  'user.activated': 'Utilizador ativado',
  'user.password_reset': 'Password temporária reposta',
  'team.created': 'Equipa criada',
  'team.updated': 'Equipa alterada',
  'season.created': 'Época criada',
  'season.copied': 'Época copiada',
  'season.updated': 'Época alterada',
  'season.archived': 'Época arquivada',
  'member.created': 'Membro adicionado',
  'member.updated': 'Membro alterado',
  'photo.updated': 'Fotografia atualizada',
  'photo.removed': 'Fotografia removida',
};

export function AdminAuditSection({ overview }: { overview: AdminOverview }) {
  return (
    <SectionCard
      title="Auditoria administrativa"
      description="Últimos 100 eventos autorizados; nunca inclui passwords, tokens ou emails técnicos."
    >
      <ol className="space-y-3">
        {overview.auditEvents.map((event) => (
          <li
            className="border-pitch-100 rounded-2xl border p-4"
            key={event.id}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-bold">
                {actionLabels[event.action] ?? event.action}
              </p>
              <time
                className="text-pitch-600 text-xs"
                dateTime={event.occurredAt}
              >
                {new Intl.DateTimeFormat('pt-PT', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Europe/Lisbon',
                }).format(new Date(event.occurredAt))}
              </time>
            </div>
            <p className="text-pitch-600 mt-1 text-sm">
              Por {event.actorDisplayName} · {event.entityType}
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
