export function formatMemberDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value));
}

export function memberDescription(member: {
  memberType: 'player' | 'staff';
  shirtNumber: number | null;
  staffFunction: string | null;
}) {
  return member.memberType === 'player'
    ? `Jogador · camisola ${member.shirtNumber ?? '—'}`
    : `Equipa técnica · ${member.staffFunction ?? 'Função não definida'}`;
}
