/**
 * Acceso al catálogo (Solutions → Family → Category → Service → Offering).
 * Fuente de contenido: GraphQL local (content/services/<idioma>/*.json), ejecutado con graphql-js.
 */
import { type Locale } from '../../i18n/config';
import { getLocalizedPath } from '../../i18n/utils';
import { runContentQuery } from '../content/execute.ts';
import { CATALOG_QUERY } from './queries.ts';
import { normalizeCatalog } from './normalize';
import type { RawCatalog } from './raw';
import type { Catalog, Family, Service, ServiceRef } from './types';

export type * from './types';
export { formatInvestment } from './format';

async function loadRaw(locale: Locale): Promise<RawCatalog> {
  return runContentQuery<RawCatalog>(CATALOG_QUERY, { locale });
}

const cache = new Map<Locale, Promise<Catalog>>();

/** Una consulta por idioma y build (memoizada). */
export function getCatalog(locale: Locale): Promise<Catalog> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = loadRaw(locale).then(normalizeCatalog);
    cache.set(locale, pending);
  }
  return pending;
}

/* ── Reglas de publicación ── */

/** Un servicio tiene página solo si hay contenido real que mostrar. No se publican páginas vacías. */
export function hasServicePage(service: Service): boolean {
  return Boolean(
    service.shortDescription || service.description || service.problem || service.approach ||
      service.outcomes.length || service.deliverables.length || service.offerings.length || service.faqs.length,
  );
}

export function familyHasContent(family: Family): boolean {
  return family.categories.some((c) => c.services.some(hasServicePage));
}

/* ── URLs ── */
export const familyPath = (locale: Locale, family: string) => getLocalizedPath(locale, `/solutions/${family}/`);
export const servicePath = (locale: Locale, family: string, service: string) =>
  getLocalizedPath(locale, `/solutions/${family}/${service}/`);
export const offeringPath = (locale: Locale, family: string, service: string, offering: string) =>
  getLocalizedPath(locale, `/solutions/${family}/${service}/${offering}/`);

/** CTA → flujo de contacto con contexto (service, offering, locale). El mecanismo definitivo de captación es otra tarea. */
export function ctaPath(locale: Locale, service: string, offering?: string): string {
  const params = new URLSearchParams({ service });
  if (offering) params.set('offering', offering);
  return `${getLocalizedPath(locale, '/')}?${params.toString()}#cta`;
}

/* ── Búsqueda y relaciones ── */
export function allServices(catalog: Catalog): Service[] {
  return catalog.families.flatMap((f) => f.categories.flatMap((c) => c.services));
}

export function findService(catalog: Catalog, family: string, slug: string): Service | undefined {
  return allServices(catalog).find((s) => s.familySlug === family && s.slug === slug);
}

/** Relaciones del CMS; si no hay, servicios hermanos de la misma categoría (derivado, no almacenado). */
export function getRelatedServices(catalog: Catalog, service: Service): Service[] {
  const all = allServices(catalog);
  const explicit = service.relatedServices
    .map((r: ServiceRef) => all.find((s) => s.familySlug === r.family && s.slug === r.slug))
    .filter((s): s is Service => !!s && hasServicePage(s));
  if (explicit.length) return explicit;
  return all.filter((s) => s.familySlug === service.familySlug && s.categorySlug === service.categorySlug && s.slug !== service.slug && hasServicePage(s));
}

/** Modelo del mega-menú: Astro lo convierte en HTML; el navegador no consulta el CMS. */
export interface MenuFamily {
  name: string;
  href: string;
  categories: Array<{ name: string; services: Array<{ name: string; href?: string }> }>;
}

export function toMenu(catalog: Catalog, locale: Locale): MenuFamily[] {
  return catalog.families.map((f) => ({
    name: f.name,
    href: familyPath(locale, f.slug),
    categories: f.categories.map((c) => ({
      name: c.name,
      services: c.services.map((s) => ({ name: s.label, href: hasServicePage(s) ? servicePath(locale, f.slug, s.slug) : undefined })),
    })),
  }));
}
