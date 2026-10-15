import { defaultLocale, isLocale, locales, type Locale } from './config.ts';
import { en, type TranslationSchema } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { pt } from './pt.ts';

const dictionaries: Record<Locale, TranslationSchema> = { en, es, pt, fr };

/* ── Traducciones ─────────────────────────────────────────────
 * Política de claves faltantes: nunca se devuelve `undefined`.
 * Se usa el texto en inglés y se avisa en consola (dev y build).
 * TypeScript ya impide claves faltantes en es/pt/fr; esto cubre
 * strings vacíos, arrays más cortos y datos que llegan de fuera.
 */
function withFallback<T>(base: T, over: unknown, path: string, missing: string[]): T {
  if (Array.isArray(base)) {
    const arr = Array.isArray(over) ? over : [];
    if (!Array.isArray(over)) missing.push(path);
    return base.map((item, i) => withFallback(item, arr[i], `${path}[${i}]`, missing)) as T;
  }
  if (base && typeof base === 'object') {
    const obj = over && typeof over === 'object' ? (over as Record<string, unknown>) : {};
    if (!(over && typeof over === 'object')) missing.push(path);
    return Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, withFallback(v, obj[k], `${path}.${k}`, missing)]),
    ) as T;
  }
  if (typeof over === 'string' && over.trim() !== '') return over as T;
  missing.push(path);
  return base;
}

const cache = new Map<Locale, TranslationSchema>();

export function getTranslations(locale: Locale): TranslationSchema {
  const cached = cache.get(locale);
  if (cached) return cached;

  const missing: string[] = [];
  const result = locale === defaultLocale ? en : withFallback(en, dictionaries[locale], locale, missing);
  if (missing.length) {
    console.warn(`[i18n] ${missing.length} traducción(es) faltante(s) en "${locale}" → fallback EN:\n  ${missing.join('\n  ')}`);
  }
  cache.set(locale, result);
  return result;
}

/* ── Rutas ────────────────────────────────────────────────────
 * Convención: trailing slash en páginas (/en/, /en/solutions/).
 */

/** Idioma de una ruta (`/es/solutions/` → "es"), o undefined si no está localizada. */
export function getLocaleFromPath(pathname: string): Locale | undefined {
  const first = pathname.split('/').filter(Boolean)[0];
  return isLocale(first) ? first : undefined;
}

/** Ruta sin prefijo de idioma (`/es/solutions/` → `/solutions/`). */
export function stripLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (isLocale(parts[0])) parts.shift();
  return parts.length ? `/${parts.join('/')}/` : '/';
}

/**
 * Ruta localizada. Acepta hash: ("es", "/#cta") → "/es/#cta".
 *   getLocalizedPath("es", "/solutions/") → "/es/solutions/"
 */
export function getLocalizedPath(locale: Locale, path = '/'): string {
  const [rawPath = '', hash] = path.split('#');
  const clean = rawPath.split('/').filter(Boolean).join('/');
  const base = clean ? `/${locale}/${clean}/` : `/${locale}/`;
  return hash ? `${base}#${hash}` : base;
}

/** Misma página en otro idioma: ("/en/solutions/", "pt") → "/pt/solutions/". */
export function getAlternateLocalePath(pathname: string, locale: Locale): string {
  return getLocalizedPath(locale, stripLocale(pathname));
}

export { locales, defaultLocale, isLocale };
export type { Locale, TranslationSchema };
