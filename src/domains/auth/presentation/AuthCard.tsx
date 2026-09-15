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
    <main className="bg-pitch-50 grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md" aria-labelledby="auth-title">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="bg-gold-400 text-pitch-950 grid size-12 place-items-center rounded-2xl text-xl font-black">
            €
          </span>
          <p className="text-pitch-950 text-lg font-extrabold">
            {appEnv.VITE_APP_NAME}
          </p>
        </div>
        <div className="rounded-panel border-pitch-200 shadow-panel border bg-white p-6 sm:p-8">
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
