import type { Offering } from './types';

/**
 * Texto de inversión de un offering según `investmentVisibility`.
 * PUBLIC → importe · FROM → "Desde importe" · CONTACT → "Contáctanos…" · HIDDEN/ausente → nada.
 * Nunca se muestra un importe que no esté cargado en el CMS.
 */
export function formatInvestment(
  offering: Pick<Offering, 'investment' | 'investmentVisibility'>,
  labels: { from: string; contactForPricing: string },
): string | undefined {
  switch (offering.investmentVisibility) {
    case 'PUBLIC':
      return offering.investment || undefined;
    case 'FROM':
      return offering.investment ? `${labels.from} ${offering.investment}` : undefined;
    case 'CONTACT':
      return labels.contactForPricing;
    default:
      return undefined;
  }
}
