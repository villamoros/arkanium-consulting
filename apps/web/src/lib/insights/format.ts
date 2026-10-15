import type { Locale } from '../../i18n/config';

/** Fechas con Intl en el idioma de la página (UTC, para no depender del huso del build). */
export const formatDate = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export const formatMonthYear = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso));

/** "{minutes} min read" → "4 min read" */
export const minutesLabel = (template: string, minutes: number): string => template.replace('{minutes}', String(minutes));
