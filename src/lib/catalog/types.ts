/** Modelo de dominio del catálogo (lo que consumen páginas y componentes). */
export type InvestmentVisibility = 'PUBLIC' | 'FROM' | 'CONTACT' | 'HIDDEN';
export type EngagementType = 'FIXED_SCOPE' | 'PROJECT' | 'RETAINER';

export interface Seo {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex: boolean;
}

export interface Offering {
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  problem?: string;
  solution?: string;
  /** Texto libre (p. ej. "2–4 weeks"). Si no está definido formalmente, no se muestra. */
  duration?: string;
  engagementType?: EngagementType;
  /** Importe localizado (p. ej. "$4,500"). Se muestra solo según `investmentVisibility`. */
  investment?: string;
  investmentVisibility: InvestmentVisibility;
  deliverables: string[];
  outcomes: string[];
  seo: Seo;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface ServiceRef {
  family: string;
  slug: string;
}

export interface Service {
  slug: string;
  familySlug: string;
  categorySlug: string;
  name: string;
  /** Nombre corto para menús y tarjetas. Si no se define, es el nombre. */
  label: string;
  /** Duración libre (p. ej. "2–4 weeks"). Si no está definida, no se muestra. */
  duration?: string;
  shortDescription?: string;
  description?: string;
  problem?: string;
  approach?: string;
  outcomes: string[];
  deliverables: string[];
  engagementModels: string[];
  ctaLabel?: string;
  featured: boolean;
  faqs: Faq[];
  offerings: Offering[];
  /** Relaciones explícitas del CMS. Si están vacías se usan los servicios hermanos de la categoría. */
  relatedServices: ServiceRef[];
  seo: Seo;
}

export interface Category {
  slug: string;
  name: string;
  services: Service[];
}

export interface Family {
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  icon?: string;
  featured: boolean;
  categories: Category[];
}

export interface Catalog {
  families: Family[];
}
