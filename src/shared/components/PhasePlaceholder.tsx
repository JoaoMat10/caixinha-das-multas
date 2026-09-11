import { Link } from 'react-router-dom';

type PhasePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  phase: string;
};

export function PhasePlaceholder({
  eyebrow,
  title,
  description,
  phase,
}: PhasePlaceholderProps) {
  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="placeholder-title">
      <p className="text-pitch-700 mb-3 text-sm font-bold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <div className="rounded-panel border-pitch-200 shadow-panel border bg-white p-6 sm:p-8">
        <span className="bg-gold-100 text-gold-800 inline-flex rounded-full px-3 py-1 text-xs font-bold">
          Previsto para {phase}
        </span>
        <h1
          id="placeholder-title"
          className="mt-5 text-3xl font-black tracking-tight sm:text-4xl"
        >
          {title}
        </h1>
        <p className="text-pitch-700 mt-4 max-w-prose text-base leading-7">
          {description}
        </p>
        <p className="border-gold-400 text-pitch-600 mt-6 border-l-4 pl-4 text-sm leading-6">
          Esta área confirma apenas a fronteira do módulo. Ainda não contém
          dados, permissões ou ações de negócio.
        </p>
        <Link
          className="bg-pitch-900 hover:bg-pitch-800 focus-visible:outline-pitch-700 mt-8 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          to="/"
        >
          Voltar à fundação
        </Link>
      </div>
    </section>
  );
}
