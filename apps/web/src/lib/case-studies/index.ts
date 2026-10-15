/**
 * Acceso a Case Studies. Fuente de contenido: GraphQL local (content/case-studies/<idioma>/*.json).
 * Reglas de integridad: ver normalize.ts.
 */
import { type Locale } from '../../i18n/config';
import { getLocalizedPath } from '../../i18n/utils';
import { runContentQuery } from '../content/execute.ts';
import { CASE_STUDIES_QUERY } from './queries.ts';
import { normalizeCaseStudies } from './normalize';
import type { RawCaseStudies } from './raw';
import type { CaseStudy, CaseType } from './types';

export type * from './types';

async function loadRaw(locale: Locale): Promise<RawCaseStudies> {
  return runContentQuery<RawCaseStudies>(CASE_STUDIES_QUERY, { locale });
}

const cache = new Map<Locale, Promise<CaseStudy[]>>();

/** Todos los casos renderizables (PUBLISHED, PUBLIC + UNLISTED). Una consulta por idioma y build. */
export function getCaseStudies(locale: Locale): Promise<CaseStudy[]> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = loadRaw(locale).then(normalizeCaseStudies);
    cache.set(locale, pending);
  }
  return pending;
}

/* ── URLs ── */
export const caseStudiesPath = (locale: Locale) => getLocalizedPath(locale, '/case-studies/');
export const caseStudyPath = (locale: Locale, slug: string) => getLocalizedPath(locale, `/case-studies/${slug}/`);

/* ── Listados: solo PUBLIC (UNLISTED es accesible por URL pero no aparece en ningún listado) ── */
export const listed = (all: CaseStudy[]): CaseStudy[] => all.filter((c) => c.visibility === 'PUBLIC');

/** Secciones del catálogo: Featured · Real · Representative · Anonymized (un caso no se repite). */
export function groupForListing(all: CaseStudy[]) {
  const pub = listed(all);
  const rest = pub.filter((c) => !c.featured);
  const ofType = (type: CaseType) => rest.filter((c) => c.type === type);
  return {
    featured: pub.filter((c) => c.featured),
    real: ofType('REAL'),
    representative: ofType('REPRESENTATIVE'),
    anonymized: ofType('ANONYMIZED'),
  };
}

/** Vista ligera para el Home: ya viene ordenado (featured, publishedAt). */
export const homeCaseStudies = (all: CaseStudy[], limit = 4): CaseStudy[] => listed(all).slice(0, limit);

/** Relaciones explícitas del CMS; si no hay, casos que comparten servicios (o, en su defecto, industria). */
export function getRelatedCaseStudies(all: CaseStudy[], current: CaseStudy, limit = 3): CaseStudy[] {
  const pub = listed(all).filter((c) => c.slug !== current.slug);
  const explicit = current.relatedCaseStudies.map((s) => pub.find((c) => c.slug === s)).filter((c): c is CaseStudy => !!c);
  if (explicit.length) return explicit.slice(0, limit);
  const key = (s: { family: string; slug: string }) => `${s.family}/${s.slug}`;
  const mine = new Set(current.services.map(key));
  return pub
    .map((c) => ({ c, score: c.services.filter((s) => mine.has(key(s))).length * 2 + (c.industry && c.industry.slug === current.industry?.slug ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Casos que referencian un servicio del catálogo (relación inversa, sin duplicar contenido). */
export const caseStudiesForService = (all: CaseStudy[], family: string, service: string): CaseStudy[] =>
  listed(all).filter((c) => c.services.some((s) => s.family === family && s.slug === service));
