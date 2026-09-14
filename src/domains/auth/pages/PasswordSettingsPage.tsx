import { PasswordChangePage } from '@/domains/auth/pages/PasswordChangePage';

export function PasswordSettingsPage() {
  return (
    <section className="mx-auto max-w-xl" aria-labelledby="password-title">
      <p className="text-pitch-700 text-sm font-bold tracking-[0.18em] uppercase">
        Definições
      </p>
      <h1
        id="password-title"
        className="mt-3 text-3xl font-black tracking-tight"
      >
        Alterar password
      </h1>
      <p className="text-pitch-700 mt-3 mb-7 leading-7">
        Confirma primeiro a password atual para proteger a tua conta.
      </p>
      <div className="rounded-panel border-pitch-200 shadow-panel border bg-white p-6 sm:p-8">
        <PasswordChangePage />
      </div>
    </section>
  );
}
