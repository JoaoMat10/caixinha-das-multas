import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import {
  getPrimaryNavigationItems,
  getSecondaryNavigationItems,
} from '@/app/navigation';
import { useAuth } from '@/domains/auth';
import { AppIcon } from '@/shared/components/AppIcon';
import { appEnv } from '@/shared/config/env';
import { themes } from '@/shared/theme/theme';

function getNavigationClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'app-nav-link active' : 'app-nav-link';
}

export function AppShell() {
  const { user, logout, isBusy } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
      if (event.key !== 'Tab') return;
      const available = controls();
      const first = available[0];
      const last = available.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [moreOpen]);

  if (!user) return null;

  const primaryItems = getPrimaryNavigationItems(user);
  const secondaryItems = getSecondaryNavigationItems(user);
  const theme = themes[0]!;

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <div className="app-brand">
          <span className="app-crest" aria-hidden="true">
            €
          </span>
          <span>
            <strong>{appEnv.VITE_APP_NAME}</strong>
            <small>Balneário Premium</small>
          </span>
        </div>
        <nav aria-label="Estrutura da aplicação" className="desktop-navigation">
          {primaryItems.map((item) => (
            <NavLink
              className={getNavigationClassName}
              end
              key={item.to}
              to={item.to}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <span className="nav-divider" />
          {secondaryItems.map((item) => (
            <NavLink
              className={getNavigationClassName}
              end
              key={item.to}
              to={item.to}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {user.displayName.slice(0, 2).toLocaleUpperCase('pt-PT')}
          </span>
          <span className="account-copy">
            <strong>{user.displayName}</strong>
            <small>{theme.name}</small>
          </span>
          <button
            aria-label="Sair"
            disabled={isBusy}
            onClick={() => void logout()}
            type="button"
          >
            <AppIcon name="logout" />
          </button>
        </div>
      </aside>

      <div className="app-content-column">
        <header className="mobile-header">
          <div className="app-brand">
            <span className="app-crest" aria-hidden="true">
              €
            </span>
            <span>
              <strong>Caixinha</strong>
              <small>{user.displayName}</small>
            </span>
          </div>
          <button
            aria-expanded={moreOpen}
            aria-label="Abrir definições"
            className="header-action"
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <AppIcon name="more" />
          </button>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="mobile-bottom-navigation"
      >
        {primaryItems.map((item) => (
          <NavLink
            aria-label={`${item.shortLabel ?? item.label} — navegação móvel`}
            className={getNavigationClassName}
            end
            key={item.to}
            to={item.to}
          >
            <AppIcon name={item.icon} />
            <span>{item.shortLabel ?? item.label}</span>
          </NavLink>
        ))}
        <button
          aria-expanded={moreOpen}
          className={moreOpen ? 'app-nav-link active' : 'app-nav-link'}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <AppIcon name="more" />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen ? (
        <div
          className="more-backdrop"
          role="presentation"
          onMouseDown={() => setMoreOpen(false)}
        >
          <section
            aria-label="Definições e sessão"
            aria-modal="true"
            className="more-sheet"
            onMouseDown={(event) => event.stopPropagation()}
            ref={sheetRef}
            role="dialog"
          >
            <span className="sheet-handle" />
            <div className="sheet-account">
              <span className="account-avatar" aria-hidden="true">
                {user.displayName.slice(0, 2).toLocaleUpperCase('pt-PT')}
              </span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{theme.name}</small>
              </span>
            </div>
            {secondaryItems.map((item) => (
              <NavLink
                className="sheet-link"
                key={item.to}
                onClick={() => setMoreOpen(false)}
                to={item.to}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              className="sheet-link danger"
              disabled={isBusy}
              onClick={() => void logout()}
              type="button"
            >
              <AppIcon name="logout" />
              <span>Terminar sessão</span>
            </button>
            <button
              className="sheet-close"
              onClick={() => setMoreOpen(false)}
              type="button"
            >
              Fechar
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
