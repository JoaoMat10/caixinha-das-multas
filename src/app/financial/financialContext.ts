import { createContext, useContext } from 'react';

import type { FinesService } from '@/domains/fines/services/FinesService';
import type { TreasuryService } from '@/domains/treasury/services/TreasuryService';

export const FinancialContext = createContext<{
  fines: FinesService;
  treasury: TreasuryService;
} | null>(null);

export function useFinancialServices() {
  const context = useContext(FinancialContext);
  if (!context) throw new Error('FinancialProvider não encontrado.');
  return context;
}
