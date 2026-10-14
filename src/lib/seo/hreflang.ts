import { defaultLocale, locales, type Locale } from '../../i18n/config.ts';
import { getAlternateLocalePath, getLocaleFromPath } from '../../i18n/utils.ts';

export type LocalePaths = Partial<Record<Locale, string>>;

/** Returns only real locale variants; callers can pass CMS-derived paths for translated slugs. */
export function localeAlternates(pathname: string, localePaths?: LocalePaths): Array<{ locale: Locale; path: string }> {
  if (localePaths) return locales.flatMap((locale) => localePaths[locale] ? [{ locale, path: localePaths[locale]! }] : []);
  return getLocaleFromPath(pathname) ? locales.map((locale) => ({ locale, path: getAlternateLocalePath(pathname, locale) })) : [];
}

export function xDefaultPath(alternates: Array<{ locale: Locale; path: string }>): string | undefined {
  return (alternates.find((item) => item.locale === defaultLocale) ?? alternates[0])?.path;
}
