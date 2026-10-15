/**
 * Forma cruda de Insights tal como se lee del contenido local (content/insights/<idioma>/*.json),
 * con el autor ya resuelto desde content/authors. Mantiene la forma de Storyblok para la migración.
 */

type S = string | null | undefined;
type Asset = { url?: S; width?: number | null; height?: number | null; caption?: S } | null;

export interface RawArticle {
  id?: S; slug?: S; title?: S; excerpt?: S; featured?: boolean | null;
  publishedAt?: S; updatedAt?: S; scheduledAt?: S; editorialStatus?: S;
  format?: S;
  category?: { slug?: S; name?: S } | null;
  coverAlt?: S;
  content?: { raw?: unknown } | null;
  featuredImage?: Asset;
  author?: { name?: S; slug?: S; role?: S; bio?: S; avatar?: { url?: S } | null; linkedin?: S; website?: S } | null;
  tags?: Array<{ slug?: S; name?: S }> | null;
  services?: Array<{ slug?: S; family?: { slug?: S } | null }> | null;
  offerings?: Array<{ slug?: S; service?: { slug?: S; family?: { slug?: S } | null } | null }> | null;
  caseStudies?: Array<{ slug?: S }> | null;
  relatedArticles?: Array<{ id?: S }> | null;
  seo?: { metaTitle?: S; metaDescription?: S; canonicalUrl?: S; noIndex?: boolean | null; ogImage?: { url?: S } | null } | null;
}
export interface RawArticles { articles: RawArticle[] }
export interface RawArticleDetail { article: RawArticle | null }
