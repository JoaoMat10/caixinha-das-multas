const foundationItems = [
  'React, TypeScript e Vite',
  'Tailwind CSS e design tokens',
  'Routing e cache de estado remoto',
  'Formulários tipados e validação',
  'Testes unitários e de browser',
  'Manifesto PWA inicial',
] as const;

export function FoundationPage() {
  return (
    <section aria-labelledby="foundation-title">
      <div className="max-w-3xl">
        <p className="text-pitch-700 mb-3 text-sm font-bold tracking-[0.18em] uppercase">
          Fase 01
        </p>
        <h1
          id="foundation-title"
          className="text-4xl font-black tracking-tight sm:text-5xl"
        >
          A base está pronta para entrar em campo.
        </h1>
        <p className="text-pitch-700 mt-5 max-w-2xl text-lg leading-8">
          Este shell valida a fundação técnica e as fronteiras dos módulos. As
          funcionalidades da Caixinha das Multas serão adicionadas
          sequencialmente nas fases aprovadas.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {foundationItems.map((item) => (
          <article
            className="rounded-panel border-pitch-200 shadow-panel border bg-white p-5"
            key={item}
          >
            <span
              aria-hidden="true"
              className="bg-pitch-100 text-pitch-800 mb-4 grid size-8 place-items-center rounded-full font-black"
            >
              ✓
            </span>
            <h2 className="leading-6 font-bold">{item}</h2>
          </article>
        ))}
      </div>

      <div className="rounded-panel bg-pitch-900 mt-8 p-6 text-white sm:p-8">
        <h2 className="text-xl font-extrabold">Escopo protegido</h2>
        <p className="text-pitch-100 mt-2 max-w-3xl text-sm leading-6">
          Não existem nesta fase ligações a base de dados, autenticação, painel
          administrativo, gestão de multas ou operações de tesouraria.
        </p>
      </div>
    </section>
  );
}
