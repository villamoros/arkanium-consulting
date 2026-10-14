/**
 * Normalización + INTEGRIDAD EDITORIAL de Case Studies.
 *
 * Las reglas se aplican aquí, en el build (fail-closed): un caso PUBLISHED que las incumple
 * rompe el build con un mensaje explícito, en lugar de publicarse de forma engañosa.
 * Los casos que no están PUBLISHED, o son PRIVATE, no se normalizan ni se renderizan.
 *
 * Solo `import type`: este módulo se prueba directamente con Node (scripts/test-case-integrity.mjs).
 */
import type { RawCaseStudies, RawCaseStudy } from './raw';
import type { ApproachPhase, CaseMetric, CaseStudy, CaseType, CaseVisibility, OfferingRef } from './types';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TYPES: CaseType[] = ['REAL', 'REPRESENTATIVE', 'ANONYMIZED'];
const VISIBLE: CaseVisibility[] = ['PUBLIC', 'UNLISTED'];
const PHASES: ApproachPhase[] = ['ASSESSMENT', 'STRATEGY', 'ARCHITECTURE', 'IMPLEMENTATION', 'GOVERNANCE'];

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter((x): x is string => !!x) : []);

function slugOf(value: unknown, where: string): string {
  if (typeof value !== 'string' || !SLUG.test(value)) {
    throw new Error(`[case-studies] Slug inválido ${JSON.stringify(value)} en ${where}. Use minúsculas, números y guiones.`);
  }
  return value;
}

/** Solo http(s): el CMS no es de confianza para esquemas como javascript:. */
function safeUrl(v: unknown): string | undefined {
  const raw = text(v);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isoDate(v: unknown): string | undefined {
  const raw = text(v);
  return raw && !Number.isNaN(Date.parse(raw)) ? raw : undefined;
}

function violation(slug: string, rule: string): never {
  throw new Error(`[case-studies] Integridad editorial — "${slug}": ${rule}`);
}

/** ¿Debe renderizarse? (status PUBLISHED y visibilidad pública/no listada). Lo demás se descarta. */
function isRenderable(r: RawCaseStudy): boolean {
  return r.status === 'PUBLISHED' && VISIBLE.includes(r.visibility as CaseVisibility);
}

function normalizeOne(r: RawCaseStudy): CaseStudy {
  const slug = slugOf(r.slug, 'caseStudy');
  const type = r.type as CaseType;
  if (!TYPES.includes(type)) violation(slug, `type inválido ${JSON.stringify(r.type)} (REAL | REPRESENTATIVE | ANONYMIZED).`);

  const title = text(r.title);
  if (!title) violation(slug, 'falta title.');

  const hasClient = Boolean(text(r.clientName) || r.clientLogo?.url || text(r.clientWebsite));
  const evidence = r.evidenceStatus ?? 'NOT_REQUIRED';
  const authorization = r.publicationAuthorization?.status ?? 'NOT_REQUIRED';

  /* ── Reglas por tipo ── */
  if (type === 'REPRESENTATIVE') {
    if (hasClient) violation(slug, 'un REPRESENTATIVE no puede tener cliente (clientName/clientLogo/clientWebsite). Si el trabajo fue real, cambie el type.');
    if (text(r.engagementReference)) violation(slug, 'un REPRESENTATIVE no puede referenciar un engagement real (engagementReference).');
    if (evidence !== 'NOT_REQUIRED') violation(slug, `un REPRESENTATIVE debe tener evidenceStatus NOT_REQUIRED (tiene ${evidence}).`);
    if ((r.metrics ?? []).some((m) => m?.verified === true)) violation(slug, 'un REPRESENTATIVE no puede tener métricas verificadas (sería presentar un resultado real). Cambie el type o retire la métrica.');
  } else {
    // REAL y ANONYMIZED afirman que el trabajo ocurrió: exigen evidencia y autorización.
    if (!text(r.engagementReference)) violation(slug, `un ${type} publicado requiere engagementReference.`);
    if (evidence !== 'VERIFIED') violation(slug, `un ${type} publicado requiere evidenceStatus VERIFIED (tiene ${evidence}).`);
    if (authorization !== 'APPROVED') violation(slug, `un ${type} publicado requiere publicationAuthorization APPROVED (tiene ${authorization}).`);
  }
  if (type === 'ANONYMIZED' && (hasClient || r.clientVisibility === 'PUBLIC')) {
    violation(slug, 'un ANONYMIZED no puede identificar al cliente (clientName/clientLogo/clientWebsite vacíos y clientVisibility HIDDEN).');
  }
  if (type === 'REAL' && r.clientVisibility === 'PUBLIC' && !text(r.clientName)) {
    violation(slug, 'un REAL con clientVisibility PUBLIC requiere clientName.');
  }

  /* El cliente solo se expone si es REAL y PUBLIC; en cualquier otro caso se descarta por completo. */
  const client =
    type === 'REAL' && r.clientVisibility === 'PUBLIC'
      ? { name: text(r.clientName) as string, logo: safeUrl(r.clientLogo?.url), website: safeUrl(r.clientWebsite) }
      : undefined;

  const challengeSummary = text(r.challengeSummary);
  const summary = text(r.summary) ?? challengeSummary;
  if (!summary) violation(slug, 'falta summary (o challengeSummary) para la tarjeta.');

  /* Métricas: solo las verificadas son publicables como resultado factual. */
  const metrics: CaseMetric[] = [];
  for (const m of r.metrics ?? []) {
    if (m?.verified !== true) {
      console.warn(`[case-studies] "${slug}": métrica no verificada omitida (${JSON.stringify(m?.label)}).`);
      continue;
    }
    const label = text(m.label);
    const value = text(m.value);
    if (!label || !value) violation(slug, 'una métrica verificada requiere label y value.');
    metrics.push({ label, value, unit: text(m.unit), context: text(m.context), source: text(m.source) });
  }

  const approachSteps = (r.approachSteps ?? []).flatMap((s) => {
    const body = text(s?.body);
    return body && PHASES.includes(s?.phase as ApproachPhase) ? [{ phase: s.phase as ApproachPhase, body }] : [];
  });

  const offerings: OfferingRef[] = (r.offerings ?? []).flatMap((o) =>
    o?.slug && o.service?.slug && o.service.family?.slug
      ? [{ slug: slugOf(o.slug, `${slug} offering`), service: slugOf(o.service.slug, `${slug} offering`), family: slugOf(o.service.family.slug, `${slug} offering`) }]
      : [],
  );

  const seo = r.seo;
  return {
    slug,
    type,
    visibility: r.visibility as CaseVisibility,
    featured: r.featured === true,
    publishedAt: isoDate(r.publishedAt),
    title,
    summary,
    industry: r.industry?.slug && text(r.industry.name) ? { slug: slugOf(r.industry.slug, `${slug} industry`), name: text(r.industry.name) as string } : undefined,
    client,
    clientDescriptor: type === 'ANONYMIZED' ? text(r.clientDescriptor) : undefined,
    challengeSummary,
    challengeDetails: text(r.challengeDetails),
    approach: text(r.approach),
    approachSteps,
    solution: text(r.solution),
    outcomes: list(r.outcomes),
    deliverables: list(r.deliverables),
    timeline: text(r.timeline),
    metrics,
    technologies: (r.technologies ?? []).flatMap((t) =>
      t?.slug && text(t.name) ? [{ slug: slugOf(t.slug, `${slug} technology`), name: text(t.name) as string, category: text(t.category) }] : [],
    ),
    services: (r.services ?? []).flatMap((s) =>
      s?.slug && s.family?.slug ? [{ slug: slugOf(s.slug, `${slug} service`), family: slugOf(s.family.slug, `${slug} service`) }] : [],
    ),
    offerings,
    relatedCaseStudies: (r.relatedCaseStudies ?? []).flatMap((c) => (c?.slug ? [slugOf(c.slug, `${slug} related`)] : [])),
    featuredImage: safeUrl(r.featuredImage?.url),
    seo: {
      title: text(seo?.title),
      description: text(seo?.description),
      canonical: text(seo?.canonical),
      ogImage: safeUrl(seo?.ogImage?.url),
      // UNLISTED es accesible por URL directa pero nunca indexable.
      noIndex: seo?.noIndex === true || r.visibility === 'UNLISTED',
    },
  };
}

/** featured primero, luego publishedAt descendente; sin fecha conserva el orden del origen (sort estable). */
function byPriority(a: CaseStudy, b: CaseStudy): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  const da = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
  const db = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
  return db - da;
}

export function normalizeCaseStudies(raw: RawCaseStudies): CaseStudy[] {
  const items = (raw.caseStudies ?? []).filter(isRenderable).map(normalizeOne);
  const slugs = items.map((c) => c.slug);
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`[case-studies] Slug duplicado "${dup}".`);

  // Las relaciones solo apuntan a casos renderizables (no a borradores/privados) y nunca a sí mismos.
  const known = new Set(slugs);
  for (const c of items) c.relatedCaseStudies = c.relatedCaseStudies.filter((s) => known.has(s) && s !== c.slug);

  return items.sort(byPriority);
}
