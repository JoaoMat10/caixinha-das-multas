import { PasswordChangePage } from '@/domains/auth/pages/PasswordChangePage';
import { themes } from '@/shared/theme/theme';

export function PasswordSettingsPage() {
  const theme = themes[0]!;
  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="password-title">
      <p className="text-pitch-700 text-sm font-bold tracking-[0.18em] uppercase">
        Definições
      </p>
      <h1
        id="password-title"
        className="mt-3 text-3xl font-black tracking-tight"
      >
        Definições
      </h1>
      <p className="text-pitch-700 mt-3 mb-7 leading-7">
        Aparência, segurança e acesso à tua conta.
      </p>
      <section
        className="rounded-panel border-pitch-200 shadow-panel mb-6 border bg-white p-5 sm:p-6"
        aria-labelledby="theme-title"
      >
        <p className="text-gold-800 text-xs font-bold tracking-[0.16em] uppercase">
          Aparência
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="theme-title" className="text-xl font-black">
              {theme.name}
            </h2>
            <p className="text-pitch-600 mt-1 text-sm">{theme.description}</p>
          </div>
          <span className="bg-gold-100 text-gold-800 rounded-full px-3 py-2 text-xs font-black uppercase">
            Tema ativo
          </span>
        </div>
        <p className="text-pitch-600 mt-4 text-xs leading-5">
          A aplicação está preparada para receber outras famílias visuais. Só
          aparecem aqui os temas realmente disponíveis.
        </p>
      </section>
      <div className="rounded-panel border-pitch-200 shadow-panel border bg-white p-6 sm:p-8">
        <h2 className="mb-5 text-xl font-black">Alterar password</h2>
        <PasswordChangePage />
      </div>
    </section>
  );
}
