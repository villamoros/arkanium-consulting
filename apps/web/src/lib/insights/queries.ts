/**
 * Consultas GraphQL de Insights contra el contenido local (ver src/lib/content/schema.ts).
 * Dos consultas, cada una con lo que su vista necesita: listado (sin cuerpo) y detalle (con cuerpo).
 */

export const ARTICLE_SUMMARIES_QUERY = /* GraphQL */ `
  query ArticleSummaries($locale: Locale!) {
    articles(locale: $locale) {
      id
      slug
      title
      excerpt
      featured
      publishedAt
      updatedAt
      scheduledAt
      editorialStatus
      format
      category { slug name }
      coverAlt
      featuredImage { url width height caption }
      author { name slug }
      seo { noIndex }
    }
  }
`;

export const ARTICLE_DETAIL_QUERY = /* GraphQL */ `
  query ArticleDetail($locale: Locale!, $slug: String!) {
    article(locale: $locale, slug: $slug) {
      id
      slug
      title
      excerpt
      featured
      publishedAt
      updatedAt
      scheduledAt
      editorialStatus
      format
      category { slug name }
      coverAlt
      content { raw }
      featuredImage { url width height caption }
      author { name slug role bio avatar { url } linkedin website }
      tags { slug name }
      services { slug family { slug } }
      offerings { slug service { slug family { slug } } }
      caseStudies { slug }
      relatedArticles { id }
      seo { metaTitle metaDescription canonicalUrl noIndex ogImage { url } }
    }
  }
`;
