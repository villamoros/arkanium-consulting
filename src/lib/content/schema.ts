/**
 * Esquema GraphQL del contenido local (SDL). Es la fuente de contenido del sitio mientras no haya CMS.
 * Forma: la misma que consumían las consultas anteriores, para que las reglas de normalización no cambien.
 * Cuando se conecte Storyblok, solo cambia quién resuelve los campos, no la forma que ven las páginas.
 */
export const CONTENT_SDL = /* GraphQL */ `
  enum Locale {
    en
    es
    pt
    fr
  }

  scalar JSON

  type Asset {
    url: String
    width: Int
    height: Int
    altText: String
    caption: String
  }

  type Taxonomy {
    slug: String
    name: String
  }

  type FamilyRef {
    slug: String
  }

  type ServiceRef {
    slug: String
    family: FamilyRef
  }

  type OfferingRef {
    slug: String
    service: ServiceRef
  }

  type CaseStudyRef {
    slug: String
  }

  type ArticleRef {
    id: String
  }

  type RichText {
    raw: JSON
  }

  type Author {
    name: String
    slug: String
    role: String
    bio: String
    avatar: Asset
    linkedin: String
    website: String
  }

  type Seo {
    metaTitle: String
    metaDescription: String
    canonicalUrl: String
    noIndex: Boolean
    ogImage: Asset
  }

  type Article {
    id: String
    slug: String
    title: String
    excerpt: String
    featured: Boolean
    publishedAt: String
    updatedAt: String
    scheduledAt: String
    editorialStatus: String
    content: RichText
    featuredImage: Asset
    author: Author
    categories: [Taxonomy]
    tags: [Taxonomy]
    services: [ServiceRef]
    offerings: [OfferingRef]
    caseStudies: [CaseStudyRef]
    relatedArticles: [ArticleRef]
    seo: Seo
  }

  type TermRef {
    value: String
    name: String
    order: Int
  }

  type Service {
    id: String
    value: String
    label: String
    name: String
    position: Int
    duration: String
    description: String
    problem: String
    solution: String
    outcomes: [String]
    family: TermRef
    category: TermRef
  }

  type ServiceCategory {
    value: String
    name: String
    order: Int
    services: [Service!]!
  }

  type ServiceFamily {
    value: String
    name: String
    order: Int
    categories: [ServiceCategory!]!
  }

  type Query {
    articles(locale: Locale!): [Article!]!
    article(locale: Locale!, slug: String!): Article
    serviceFamilies(locale: Locale!): [ServiceFamily!]!
  }
`;
