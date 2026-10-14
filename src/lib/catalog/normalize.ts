import type { RawCatalog, RawOffering, RawSeo, RawService } from './raw';
import type { Catalog, EngagementType, InvestmentVisibility, Offering, Seo, Service } from './types';

/** Validación de slugs: van directo a la URL, no se confía en el CMS. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(value: unknown, where: string): string {
  if (typeof value !== 'string' || !SLUG.test(value)) {
    throw new Error(`[catalog] Slug inválido ${JSON.stringify(value)} en ${where}. Use minúsculas, números y guiones.`);
  }
  return value;
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter((x): x is string => !!x) : []);

const VISIBILITY: InvestmentVisibility[] = ['PUBLIC', 'FROM', 'CONTACT', 'HIDDEN'];
const ENGAGEMENT: EngagementType[] = ['FIXED_SCOPE', 'PROJECT', 'RETAINER'];

function seo(raw: RawSeo | null | undefined): Seo {
  return {
    title: text(raw?.title),
    description: text(raw?.description),
    canonical: text(raw?.canonical),
    ogImage: text(raw?.ogImage?.url),
    noIndex: raw?.noIndex === true,
  };
}

function unique(slugs: string[], where: string): void {
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`[catalog] Slug duplicado "${dup}" en ${where}.`);
}

function offering(raw: RawOffering, where: string): Offering {
  const slug = assertSlug(raw.slug, `${where} (offering)`);
  const name = text(raw.name);
  if (!name) throw new Error(`[catalog] Offering "${slug}" sin nombre en ${where}.`);
  const vis = raw.investmentVisibility as InvestmentVisibility;
  const eng = raw.engagementType as EngagementType;
  return {
    slug,
    name,
    shortDescription: text(raw.shortDescription),
    description: text(raw.description),
    problem: text(raw.problem),
    solution: text(raw.solution),
    duration: text(raw.duration),
    engagementType: ENGAGEMENT.includes(eng) ? eng : undefined,
    investment: text(raw.investment),
    // Por defecto NO se publica precio.
    investmentVisibility: VISIBILITY.includes(vis) ? vis : 'HIDDEN',
    deliverables: list(raw.deliverables),
    outcomes: list(raw.outcomes),
    seo: seo(raw.seo),
  };
}

function service(raw: RawService, familySlug: string, categorySlug: string, where: string): Service {
  const slug = assertSlug(raw.slug, `${where} (service)`);
  const name = text(raw.name);
  if (!name) throw new Error(`[catalog] Servicio "${slug}" sin nombre en ${where}.`);
  const offerings = (raw.offerings ?? []).map((o) => offering(o, `${where}/${slug}`));
  unique(offerings.map((o) => o.slug), `${where}/${slug} offerings`);
  return {
    slug,
    familySlug,
    categorySlug,
    name,
    label: text(raw.label) ?? name,
    duration: text(raw.duration),
    shortDescription: text(raw.shortDescription),
    description: text(raw.description),
    problem: text(raw.problem),
    approach: text(raw.approach),
    outcomes: list(raw.outcomes),
    deliverables: list(raw.deliverables),
    engagementModels: list(raw.engagementModels),
    ctaLabel: text(raw.ctaLabel),
    featured: raw.featured === true,
    faqs: (raw.faqs ?? []).flatMap((f) => {
      const question = text(f?.question);
      const answer = text(f?.answer);
      return question && answer ? [{ question, answer }] : [];
    }),
    offerings,
    relatedServices: (raw.relatedServices ?? []).flatMap((r) =>
      r?.slug && r.family?.slug ? [{ family: assertSlug(r.family.slug, `${where}/${slug} related`), slug: assertSlug(r.slug, `${where}/${slug} related`) }] : [],
    ),
    seo: seo(raw.seo),
  };
}

export function normalizeCatalog(raw: RawCatalog): Catalog {
  const families = (raw.serviceFamilies ?? []).map((f) => {
    const fSlug = assertSlug(f.slug, 'family');
    const fName = text(f.name);
    if (!fName) throw new Error(`[catalog] Familia "${fSlug}" sin nombre.`);
    const categories = (f.categories ?? []).map((c) => {
      const cSlug = assertSlug(c.slug, `${fSlug} (category)`);
      const cName = text(c.name);
      if (!cName) throw new Error(`[catalog] Categoría "${cSlug}" sin nombre.`);
      return { slug: cSlug, name: cName, services: (c.services ?? []).map((s) => service(s, fSlug, cSlug, `${fSlug}/${cSlug}`)) };
    });
    unique(categories.map((c) => c.slug), `${fSlug} categories`);
    unique(categories.flatMap((c) => c.services.map((s) => s.slug)), `${fSlug} services`);
    return {
      slug: fSlug,
      name: fName,
      shortDescription: text(f.shortDescription),
      description: text(f.description),
      icon: text(f.icon),
      featured: f.featured === true,
      categories,
    };
  });
  unique(families.map((f) => f.slug), 'families');
  return { families };
}
