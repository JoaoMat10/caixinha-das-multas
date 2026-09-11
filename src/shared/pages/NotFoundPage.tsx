import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section
      className="mx-auto max-w-xl text-center"
      aria-labelledby="not-found-title"
    >
      <p className="text-pitch-700 text-sm font-bold tracking-[0.18em] uppercase">
        Erro 404
      </p>
      <h1
        id="not-found-title"
        className="mt-3 text-4xl font-black tracking-tight"
      >
        Página não encontrada
      </h1>
      <p className="text-pitch-700 mt-4">
        O endereço indicado não pertence a esta aplicação.
      </p>
      <Link
        className="bg-pitch-900 mt-8 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-bold text-white"
        to="/"
      >
        Ir para o início
      </Link>
    </section>
  );
}
