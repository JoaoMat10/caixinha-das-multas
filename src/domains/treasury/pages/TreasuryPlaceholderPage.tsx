import { PhasePlaceholder } from '@/shared/components/PhasePlaceholder';

export function TreasuryPlaceholderPage() {
  return (
    <PhasePlaceholder
      description="Liquidar, reabrir e eliminar multas exigirá operações atómicas e validação das permissões de tesoureiro no servidor."
      eyebrow="Tesouraria"
      phase="a Fase 05"
      title="Tesouraria sem operações nesta fase"
    />
  );
}
