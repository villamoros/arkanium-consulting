/**
 * Configuración i18n — única fuente de verdad de los idiomas del sitio.
 * No repetir "en" | "es" | "pt" | "fr" en otros archivos: importar de aquí.
 */
export const locales = ['en', 'es', 'pt', 'fr'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export type Currency = 'usd' | 'eur' | 'brl';

export interface LocaleMeta {
  /** Código corto visible en el selector. */
  code: string;
  /** Nombre del idioma en su propio idioma (no se traduce). */
  name: string;
  /** Valor de og:locale. */
  ogLocale: string;
  /** Moneda con la que se muestran los precios. */
  currency: Currency;
}

export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { code: 'EN', name: 'English', ogLocale: 'en_US', currency: 'usd' },
  es: { code: 'ES', name: 'Español', ogLocale: 'es_ES', currency: 'eur' },
  pt: { code: 'PT', name: 'Português', ogLocale: 'pt_BR', currency: 'brl' },
  fr: { code: 'FR', name: 'Français', ogLocale: 'fr_FR', currency: 'eur' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
