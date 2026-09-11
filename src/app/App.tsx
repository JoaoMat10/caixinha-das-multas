import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/AppProviders';
import { browserRouter } from '@/app/router';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={browserRouter} />
    </AppProviders>
  );
}
