import { useState, type PropsWithChildren } from 'react';

import { FinancialContext } from '@/app/financial/financialContext';
import { createFinesService } from '@/domains/fines/services/createFinesService';
import type { FinesService } from '@/domains/fines/services/FinesService';
import { createTreasuryService } from '@/domains/treasury/services/createTreasuryService';
import type { TreasuryService } from '@/domains/treasury/services/TreasuryService';

export function FinancialProvider({
  children,
  finesService,
  treasuryService,
}: PropsWithChildren<{
  finesService?: FinesService;
  treasuryService?: TreasuryService;
}>) {
  const [fines] = useState(() => finesService ?? createFinesService());
  const [treasury] = useState(() => treasuryService ?? createTreasuryService());
  return (
    <FinancialContext.Provider value={{ fines, treasury }}>
      {children}
    </FinancialContext.Provider>
  );
}
