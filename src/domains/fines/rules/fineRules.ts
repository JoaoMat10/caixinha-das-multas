import type { FineCategory, FineMember } from '@/domains/fines/contracts/fines';

export function formatEuros(cents: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseEuros(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error('Indica um valor em euros com até duas casas decimais.');
  const [euros, decimals = ''] = normalized.split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 10 || cents > 2147483647)
    throw new Error('O valor deve estar entre 0,10 € e 21 474 836,47 €.');
  return cents;
}

export function getFineMultiplier(member: FineMember): 1 | 2 {
  return member.memberType === 'staff' || member.isCaptain ? 2 : 1;
}

export function previewFine(member: FineMember, category: FineCategory) {
  const multiplier = getFineMultiplier(member);
  return {
    baseAmountCents: category.baseAmountCents,
    multiplier,
    totalCents: category.baseAmountCents * multiplier,
  };
}

export function memberLabel(member: FineMember) {
  const detail =
    member.memberType === 'player'
      ? `n.º ${member.shirtNumber}`
      : member.staffFunction;
  return `${member.displayName}${detail ? ` · ${detail}` : ''}${member.isCaptain ? ' · C' : ''}`;
}
