/**
 * Páginas legales (privacidad, términos, cookies, aviso). Textos en content/legal/<idioma>/<página>.json,
 * leídos con GraphQL local. Un idioma sin archivo no tiene página: no hay fallback al inglés.
 */
import type { Locale } from '../../i18n/config';
import { runContentQuery } from '../content/execute.ts';

export interface LegalDocument {
  value: string;
  title: string;
  description: string;
  sections: string[];
}

const LEGAL_PAGES_QUERY = /* GraphQL */ `
  query LegalPages($locale: Locale!) {
    legalPages(locale: $locale) {
      value
      title
      description
      sections
    }
  }
`;

export async function getLegalPages(locale: Locale): Promise<LegalDocument[]> {
  const data = await runContentQuery<{ legalPages: LegalDocument[] }>(LEGAL_PAGES_QUERY, { locale });
  return data.legalPages;
}
