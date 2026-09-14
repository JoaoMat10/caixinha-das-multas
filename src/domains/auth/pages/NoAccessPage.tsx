export function NoAccessPage() {
  return (
    <section
      className="mx-auto max-w-2xl text-center"
      aria-labelledby="access-title"
    >
      <p className="text-pitch-700 text-sm font-bold tracking-[0.18em] uppercase">
        Acesso condicionado
      </p>
      <h1 id="access-title" className="mt-3 text-3xl font-black tracking-tight">
        Ainda não tens acesso a uma área da aplicação.
      </h1>
      <p className="text-pitch-700 mt-4 leading-7">
        A sessão está ativa, mas não existe uma equipa, época ou função
        autorizada para mostrar. Contacta um administrador da organização.
      </p>
    </section>
  );
}
