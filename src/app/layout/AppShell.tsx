import { NavLink, Outlet } from 'react-router-dom';

import { getAuthorizedNavigationItems } from '@/app/navigation';
import { useAuth } from '@/domains/auth';
import { appEnv } from '@/shared/config/env';

function getNavigationClassName({ isActive }: { isActive: boolean }) {
  const baseClasses =
    'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400';

  return isActive
    ? `${baseClasses} bg-gold-400 text-pitch-950`
    : `${baseClasses} text-white hover:bg-white/10`;
}

export function AppShell() {
  const { user, logout, isBusy } = useAuth();

  if (!user) return null;

  const navigationItems = getAuthorizedNavigationItems(user);

  return (
    <div className="bg-pitch-50 text-pitch-950 min-h-dvh">
      <header className="bg-pitch-950 shadow-pitch-950/10 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div
            aria-hidden="true"
            className="bg-gold-400 text-pitch-950 grid size-11 shrink-0 place-items-center rounded-2xl text-xl font-black"
          >
            €
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">
              {appEnv.VITE_APP_NAME}
            </p>
            <p className="text-pitch-200 truncate text-xs">
              {user.displayName}
            </p>
          </div>
          <button
            className="focus-visible:outline-gold-400 min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void logout()}
            type="button"
          >
            Sair
          </button>
        </div>

        <nav
          aria-label="Estrutura da aplicação"
          className="border-t border-white/10"
        >
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
            {navigationItems.map((item) => (
              <NavLink
                className={getNavigationClassName}
                end
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="text-pitch-600 mx-auto max-w-6xl px-4 pb-8 text-center text-xs sm:px-6">
        O acesso visível respeita o contexto autorizado; a autorização efetiva
        permanece protegida na base de dados.
      </footer>
    </div>
  );
}
