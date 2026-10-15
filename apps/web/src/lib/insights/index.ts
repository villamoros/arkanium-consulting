/**
 * Acceso a Insights. Sin fetch en el navegador: todo se resuelve en build.
 * Fuente de contenido: GraphQL local (content/insights/<idioma>/*.json), ejecutado con graphql-js.
 * Las reglas de publicación se aplican en normalize.ts, no en la consulta.
 */
import { locales, type Locale } from '../../i18n/config';
import { getLocalizedPath } from '../../i18n/utils';
import { runContentQuery } from '../content/execute.ts';
import { normalizeArticle, normalizeSummaries } from './normalize.ts';
import { ARTICLE_DETAIL_QUERY, ARTICLE_SUMMARIES_QUERY } from './queries.ts';
import type { RawArticleDetail, RawArticles } from './raw';
import type { Article, ArticleSummary } from './types';

export type * from './types';

/** "Ahora" del build: define qué artículos están ya publicados. */
const NOW = Date.now();

const summaries = new Map<Locale, Promise<ArticleSummary[]>>();

/** Datos ligeros para listado, Home, relacionados y rutas. */
export function getArticleSummaries(locale: Locale): Promise<ArticleSummary[]> {
  let pending = summaries.get(locale);
  if (!pending) {
    pending = runContentQuery<RawArticles>(ARTICLE_SUMMARIES_QUERY, { locale }).then((raw) => normalizeSummaries(raw, NOW));
    summaries.set(locale, pending);
  }
  return pending;
}

const details = new Map<string, Promise<Article | undefined>>();

/** Artículo completo (contenido + relaciones + SEO) en un idioma. Sin fallback a otro idioma. */
export function getArticle(locale: Locale, slug: string): Promise<Article | undefined> {
  const key = `${locale}:${slug}`;
  let pending = details.get(key);
  if (!pending) {
    pending = runContentQuery<RawArticleDetail>(ARTICLE_DETAIL_QUERY, { locale, slug }).then((raw) => normalizeArticle(raw.article, NOW));
    details.set(key, pending);
  }
  return pending;
}

/** id de artículo → { idioma: slug }. Solo idiomas en los que está realmente publicado (slugs localizados). */
export async function getArticleLocaleSlugs(id: string): Promise<Partial<Record<Locale, string>>> {
  const out: Partial<Record<Locale, string>> = {};
  for (const locale of locales) {
    const found = (await getArticleSummaries(locale)).find((a) => a.id === id);
    if (found) out[locale] = found.slug;
  }
  return out;
}

export const insightsPath = (locale: Locale) => getLocalizedPath(locale, '/insights/');
export const articlePath = (locale: Locale, slug: string) => getLocalizedPath(locale, `/insights/${slug}/`);

/** Relaciones editoriales explícitas, resueltas contra lo realmente publicado en este idioma. */
export const resolveRelatedArticles = (all: ArticleSummary[], ids: string[], selfId: string): ArticleSummary[] =>
  ids.flatMap((id) => (id === selfId ? [] : all.filter((a) => a.id === id)));
