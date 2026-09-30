export function previousClosedMonthInLisbon(now = new Date()) {
  const parts = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month))
    throw new Error('Não foi possível determinar o mês em Lisboa.');

  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}
