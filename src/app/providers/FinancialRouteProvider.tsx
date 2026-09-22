import { Outlet } from 'react-router-dom';

import { FinancialProvider } from '@/app/financial/FinancialProvider';
import { useServiceOverrides } from '@/app/serviceOverrides';

export function FinancialRouteProvider() {
  const { finesService, treasuryService } = useServiceOverrides();
  return (
    <FinancialProvider
      finesService={finesService}
      treasuryService={treasuryService}
    >
      <Outlet />
    </FinancialProvider>
  );
}
