/**
 * Normalización + REGLAS DE PUBLICACIÓN de Insights.
 *
 * Un artículo es público en un idioma solo si:
 *   stage PUBLISHED (lo garantiza la query)  +  localizado en ese idioma (title, slug, excerpt)
 *   +  publishedAt ≤ ahora  +  scheduledAt ausente o ≤ ahora  +  editorialStatus ∈ {READY, sin definir}
 * Sin traducción NO hay fallback al inglés: esa versión simplemente no existe.
 *
 * Lo no publicable se omite (no es un error); lo corrupto (slug inválido, Rich Text roto,
 * slugs duplicados, localizado sin contenido) rompe el build.
 */
import type { RawArticle, RawArticles } from './raw';
import { readingMinutes, sanitizeRichText } from './richtext.ts';
import type { Article, ArticleImage, ArticleSummary } from './types';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** IDEA / WRITING / REVIEW / ARCHIVED no son públicos aunque el stage sea PUBLISHED. */
const PUBLIC_STATUS = new Set(['READY']);

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const time = (v: unknown): number | undefined => {
  const s = text(v);
  const t = s ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? undefined : t;
};
const httpsUrl = (v: unknown): string | undefined => {
  const s = text(v);
  if (!s) return undefined;
  try { const u = new URL(s); return u.protocol === 'https:' ? u.toString() : undefined; } catch { return undefined; }
};

function slugOf(value: unknown, where: string): string {
  if (typeof value !== 'string' || !SLUG.test(value)) {
    throw new Error(`[insights] Slug inválido ${JSON.stringify(value)} en ${where}. Use minúsculas, números y guiones.`);
  }
  return value;
}

export type Publication = 'public' | 'not-localized' | 'workflow' | 'no-date' | 'scheduled';

/** ¿Es público ahora (en el idioma pedido)? Función pura: `now` se inyecta. */
export function publicationOf(r: RawArticle, now: number): Publication {
  if (!text(r.title) || !text(r.slug) || !text(r.excerpt)) return 'not-localized';
  if (r.editorialStatus && !PUBLIC_STATUS.has(r.editorialStatus)) return 'workflow';
  const published = time(r.publishedAt);
  if (published === undefined) return 'no-date';
  const scheduled = time(r.scheduledAt);
  if (published > now || (scheduled !== undefined && scheduled > now)) return 'scheduled';
  return 'public';
}

function image(a: RawArticle['featuredImage']): ArticleImage | undefined {
  const url = httpsUrl(a?.url);
  if (!url) return undefined;
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
  return { url, alt: text(a?.altText) ?? '', caption: text(a?.caption), width: num(a?.width), height: num(a?.height) };
}

function summaryOf(r: RawArticle): ArticleSummary {
  const slug = slugOf(r.slug, 'article');
  const id = text(r.id);
  if (!id) throw new Error(`[insights] El artículo "${slug}" no tiene id.`);
  return {
    id,
    slug,
    title: text(r.title) as string,
    excerpt: text(r.excerpt) as string,
    featured: r.featured === true,
    publishedAt: text(r.publishedAt) as string,
    updatedAt: time(r.updatedAt) !== undefined ? text(r.updatedAt) : undefined,
    featuredImage: image(r.featuredImage),
    categories: (r.categories ?? []).flatMap((c) => (c?.slug && text(c.name) ? [{ slug: slugOf(c.slug, `${slug} category`), name: text(c.name) as string }] : [])),
    author: text(r.author?.name) ? { name: text(r.author?.name) as string, slug: text(r.author?.slug) } : undefined,
    noIndex: r.seo?.noIndex === true,
  };
}

/** featured primero, luego publishedAt descendente. */
const byPriority = (a: ArticleSummary, b: ArticleSummary) =>
  a.featured !== b.featured ? (a.featured ? -1 : 1) : Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

export function normalizeSummaries(raw: RawArticles, now: number): ArticleSummary[] {
  const out: ArticleSummary[] = [];
  for (const r of raw.articles ?? []) {
    const state = publicationOf(r, now);
    if (state === 'no-date') console.warn(`[insights] "${text(r.slug) ?? text(r.id)}" está publicado sin publishedAt: no se muestra (no se inventan fechas).`);
    if (state === 'public') out.push(summaryOf(r));
  }
  const slugs = out.map((a) => a.slug);
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`[insights] Slug duplicado "${dup}" en el mismo idioma.`);
  return out.sort(byPriority);
}

export function normalizeArticle(r: RawArticle | null | undefined, now: number): Article | undefined {
  if (!r || publicationOf(r, now) !== 'public') return undefined;
  const base = summaryOf(r);
  const content = sanitizeRichText(r.content?.raw, `article "${base.slug}"`);
  if (content.length === 0) throw new Error(`[insights] El artículo "${base.slug}" está localizado pero sin contenido. Complete el Rich Text o retire la localización.`);

  const a = r.author;
  const seo = r.seo;
  return {
    ...base,
    content,
    readingMinutes: readingMinutes(content),
    tags: (r.tags ?? []).flatMap((t) => (t?.slug && text(t.name) ? [{ slug: slugOf(t.slug, `${base.slug} tag`), name: text(t.name) as string }] : [])),
    authorDetail: text(a?.name)
      ? { name: text(a?.name) as string, role: text(a?.role), bio: text(a?.bio), avatar: httpsUrl(a?.avatar?.url), linkedin: httpsUrl(a?.linkedin), website: httpsUrl(a?.website) }
      : undefined,
    services: (r.services ?? []).flatMap((s) => (s?.slug && s.family?.slug ? [{ slug: slugOf(s.slug, `${base.slug} service`), family: slugOf(s.family.slug, `${base.slug} service`) }] : [])),
    offerings: (r.offerings ?? []).flatMap((o) =>
      o?.slug && o.service?.slug && o.service.family?.slug
        ? [{ slug: slugOf(o.slug, `${base.slug} offering`), service: slugOf(o.service.slug, `${base.slug} offering`), family: slugOf(o.service.family.slug, `${base.slug} offering`) }]
        : [],
    ),
    caseStudies: (r.caseStudies ?? []).flatMap((c) => (c?.slug ? [slugOf(c.slug, `${base.slug} case study`)] : [])),
    relatedArticleIds: (r.relatedArticles ?? []).flatMap((x) => (text(x?.id) ? [text(x?.id) as string] : [])),
    seo: {
      title: text(seo?.metaTitle),
      description: text(seo?.metaDescription),
      canonical: httpsUrl(seo?.canonicalUrl), // opcional: si falta, Astro genera la canonical del idioma
      ogImage: httpsUrl(seo?.ogImage?.url),
      noIndex: seo?.noIndex === true,
    },
  };
}
