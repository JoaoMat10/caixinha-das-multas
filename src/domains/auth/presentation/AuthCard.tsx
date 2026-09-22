import type { PropsWithChildren, ReactNode } from 'react';

import { appEnv } from '@/shared/config/env';

export function AuthCard({
  children,
  eyebrow,
  title,
  description,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: ReactNode;
}>) {
  return (
    <main className="auth-shell">
      <section className="auth-container" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="app-crest auth-crest">€</span>
          <span>
            <strong>{appEnv.VITE_APP_NAME}</strong>
            <small>Acesso reservado ao plantel</small>
          </span>
        </div>
        <div className="auth-card">
          <p className="text-pitch-700 text-xs font-bold tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
          <h1
            id="auth-title"
            className="mt-3 text-3xl font-black tracking-tight"
          >
            {title}
          </h1>
          <p className="text-pitch-700 mt-3 text-sm leading-6">{description}</p>
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </main>
  );
}
