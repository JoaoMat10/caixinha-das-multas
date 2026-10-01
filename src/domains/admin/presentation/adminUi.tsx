export const fieldClass =
  'border-pitch-200 bg-white focus:border-pitch-700 focus:ring-pitch-700 min-h-12 w-full min-w-0 rounded-xl border px-3 py-2 text-base focus:ring-1 focus:outline-none sm:text-sm';
export const primaryButtonClass =
  'bg-pitch-900 hover:bg-pitch-800 focus-visible:outline-gold-400 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-center text-sm leading-tight font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto';
export const secondaryButtonClass =
  'border-pitch-200 bg-white hover:bg-pitch-50 focus-visible:outline-pitch-700 inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-3 text-center text-sm leading-tight font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto';
export const formActionsClass = 'grid gap-2 sm:flex sm:flex-wrap';

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="text-sm font-semibold text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

export function SectionCard({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-pitch-100 shadow-panel rounded-panel min-w-0 border bg-white p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {description ? (
          <p className="text-pitch-600 mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
