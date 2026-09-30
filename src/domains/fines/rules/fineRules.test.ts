import { describe, expect, it } from 'vitest';

import type { FineCategory, FineMember } from '@/domains/fines/contracts/fines';
import {
  formatEuros,
  getFineMultiplier,
  parseEuros,
  previewFine,
} from '@/domains/fines/rules/fineRules';

const category: FineCategory = {
  id: 'category',
  seasonId: 'season',
  name: 'Atraso',
  description: null,
  baseAmountCents: 10,
  amountPerMinuteCents: null,
  isActive: true,
  displayOrder: 0,
};
const member: FineMember = {
  id: 'member',
  displayName: 'Jogador',
  memberType: 'player',
  shirtNumber: 8,
  staffFunction: null,
  status: 'active',
  isCaptain: false,
  isTreasurer: false,
};

describe('regras de apresentação de multas', () => {
  it('aceita 0,10 € e rejeita frações de cêntimo', () => {
    expect(parseEuros('0,10')).toBe(10);
    expect(parseEuros('1.23')).toBe(123);
    expect(() => parseEuros('0,09')).toThrow();
    expect(() => parseEuros('1,234')).toThrow();
    expect(formatEuros(10)).toMatch(/0,10\s*€/);
  });

  it('aplica 2x uma só vez a capitão e equipa técnica, sem prémio de tesoureiro', () => {
    expect(getFineMultiplier({ ...member, isTreasurer: true })).toBe(1);
    expect(
      previewFine({ ...member, isCaptain: true }, category).totalCents,
    ).toBe(20);
    expect(
      previewFine(
        { ...member, memberType: 'staff', isCaptain: true, isTreasurer: true },
        category,
      ),
    ).toEqual({
      baseAmountCents: 10,
      variableAmountCents: 0,
      minutes: 0,
      multiplier: 2,
      totalCents: 20,
    });
  });

  it('soma o acréscimo por minuto antes de aplicar o multiplicador', () => {
    expect(
      previewFine(
        { ...member, isCaptain: true },
        { ...category, baseAmountCents: 300, amountPerMinuteCents: 10 },
        7,
      ),
    ).toEqual({
      baseAmountCents: 300,
      variableAmountCents: 70,
      minutes: 7,
      multiplier: 2,
      totalCents: 740,
    });
  });
});
