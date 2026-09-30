import type {
  ApplyFine,
  FineFilters,
  FinesGateway,
  SaveFineCategory,
} from '@/domains/fines/contracts/fines';
import { requireOnline } from '@/shared/network/requireOnline';

export class FinesService {
  constructor(private readonly gateway: FinesGateway) {}

  loadCategories(seasonId: string) {
    return this.gateway.loadCategories(seasonId);
  }

  loadMembers(seasonId: string) {
    return this.gateway.loadMembers(seasonId);
  }

  loadFines(filters: FineFilters) {
    return this.gateway.loadFines(filters);
  }

  saveCategory(input: SaveFineCategory) {
    requireOnline();
    if (
      !input.name.trim() ||
      input.baseAmountCents < 10 ||
      (input.amountPerMinuteCents !== null &&
        input.amountPerMinuteCents < 10) ||
      input.displayOrder < 0
    )
      throw new Error('Verifica o nome, valor e ordem da categoria.');
    if (
      !Number.isSafeInteger(input.baseAmountCents) ||
      (input.amountPerMinuteCents !== null &&
        !Number.isSafeInteger(input.amountPerMinuteCents)) ||
      !Number.isSafeInteger(input.displayOrder)
    )
      throw new Error('Valor e ordem devem ser números inteiros.');
    return this.gateway.saveCategory(input);
  }

  applyFine(input: ApplyFine) {
    requireOnline();
    if (
      !input.memberId ||
      !input.categoryId ||
      !input.occurredAt ||
      !input.idempotencyKey
    )
      throw new Error(
        'Membro, categoria, data e chave da operação são obrigatórios.',
      );
    if (!Number.isSafeInteger(input.minutes) || input.minutes < 0)
      throw new Error('O número de minutos deve ser um inteiro não negativo.');
    return this.gateway.applyFine(input);
  }
}
