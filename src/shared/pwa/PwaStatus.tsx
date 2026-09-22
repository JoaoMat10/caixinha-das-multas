import { useEffect, useState } from 'react';

import { AppIcon } from '@/shared/components/AppIcon';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker
        .register(`/service-worker.js?v=${__APP_BUILD_ID__}`)
        .then((reg) => {
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (
                worker.state === 'installed' &&
                navigator.serviceWorker.controller
              )
                setWaiting(worker);
            });
          });
        });
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  useEffect(() => {
    const reload = () => window.location.reload();
    navigator.serviceWorker?.addEventListener('controllerchange', reload);
    return () =>
      navigator.serviceWorker?.removeEventListener('controllerchange', reload);
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!online)
    return (
      <div className="system-banner offline" role="status">
        <AppIcon name="wifi-off" />
        <span>
          Sem ligação. As operações que alteram dados estão bloqueadas.
        </span>
      </div>
    );

  if (waiting)
    return (
      <div className="system-banner update" role="status">
        <AppIcon name="refresh" />
        <span>Existe uma nova versão da aplicação.</span>
        <button
          onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
          type="button"
        >
          Atualizar agora
        </button>
      </div>
    );

  if (installPrompt)
    return (
      <div className="system-banner install" role="status">
        <AppIcon name="download" />
        <span>Instala a Caixinha neste dispositivo.</span>
        <button onClick={() => void install()} type="button">
          Instalar
        </button>
      </div>
    );

  return null;
}
