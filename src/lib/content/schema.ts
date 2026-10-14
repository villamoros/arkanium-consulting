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

  type LegalPage {
    id: String
    value: String
    title: String
    description: String
    sections: [String]
  }

  type Metric {
    value: String
    label: String
  }

  type HomeHero {
    eyebrow: String
    title: String
    lede: String
    metrics: [Metric]
  }

  type AboutCard {
    kicker: String
    title: String
    body: String
  }

  type HomeAbout {
    eyebrow: String
    title: String
    intro: String
    cards: [AboutCard]
  }

  type TitledBody {
    title: String
    body: String
  }

  type HomeChallenges {
    eyebrow: String
    title: String
    intro: String
    items: [TitledBody]
  }

  type BusinessLines {
    strategy: TitledBody
    architecture: TitledBody
    governance: TitledBody
    leadership: TitledBody
  }

  type HomeSolutions {
    eyebrow: String
    title: String
    intro: String
    groupTitle: String
    lines: BusinessLines
  }

  type ProcessPhase {
    label: String
    kicker: String
    title: String
    body: String
    items: [String]
  }

  type ProcessPhases {
    assess: ProcessPhase
    architect: ProcessPhase
    modernize: ProcessPhase
    scale: ProcessPhase
  }

  type HomeProcess {
    eyebrow: String
    title: String
    intro: String
    phases: ProcessPhases
  }

  type WhyGain {
    eyebrow: String
    items: [String]
  }

  type HomeWhy {
    eyebrow: String
    title: String
    items: [TitledBody]
    gain: WhyGain
  }

  type QuestionAnswer {
    question: String
    answer: String
  }

  type HomeFaq {
    eyebrow: String
    title: String
    items: [QuestionAnswer]
  }

  type HomeCta {
    eyebrow: String
    title: String
    intro: String
    steps: [String]
  }

  type HomePage {
    id: String
    hero: HomeHero
    about: HomeAbout
    challenges: HomeChallenges
    solutions: HomeSolutions
    process: HomeProcess
    why: HomeWhy
    faq: HomeFaq
    cta: HomeCta
  }

  type Query {
    articles(locale: Locale!): [Article!]!
    article(locale: Locale!, slug: String!): Article
    serviceFamilies(locale: Locale!): [ServiceFamily!]!
    legalPages(locale: Locale!): [LegalPage!]!
    homePage(locale: Locale!): HomePage
  }
`;
