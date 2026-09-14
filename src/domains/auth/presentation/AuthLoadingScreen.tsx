export function AuthLoadingScreen() {
  return (
    <main className="bg-pitch-50 grid min-h-dvh place-items-center px-4">
      <div aria-live="polite" className="text-center">
        <span className="bg-gold-400 text-pitch-950 mx-auto grid size-12 animate-pulse place-items-center rounded-2xl text-xl font-black">
          €
        </span>
        <p className="text-pitch-700 mt-4 font-semibold">
          A preparar a sessão…
        </p>
      </div>
    </main>
  );
}
