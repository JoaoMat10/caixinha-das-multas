import { PhasePlaceholder } from '@/shared/components/PhasePlaceholder';

export function AuthPlaceholderPage() {
  return (
    <PhasePlaceholder
      description="Entrada por username, gestão segura de sessão e alteração de password serão implementadas depois da fundação de dados e RLS."
      eyebrow="Autenticação"
      phase="a Fase 03"
      title="Entrada reservada para a fase de autenticação"
    />
  );
}
