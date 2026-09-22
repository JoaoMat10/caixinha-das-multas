import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/AppProviders';
import { browserRouter } from '@/app/router';
import { PwaStatus } from '@/shared/pwa/PwaStatus';

export function App() {
  return (
    <AppProviders>
      <PwaStatus />
      <RouterProvider router={browserRouter} />
    </AppProviders>
  );
}
