import type { Seo, ServiceRef } from '../catalog/types';
import type { OfferingRef } from '../case-studies/types';
import type { RtNode } from './richtext';

/** Formatos editoriales (contrato ARK-BLOG-002 v2). */
export const ARTICLE_FORMATS = ['analysis', 'guide'] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export interface ArticleImage {
  url: string;
  /** Texto alternativo de la portada (campo `coverAlt`). Obligatorio cuando hay portada. */
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ArticleCategory {
  slug: string;
  name: string;
}

export interface ArticleSummary {
  /** Identidad estable entre idiomas (el slug SÍ cambia por idioma). */
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured: boolean;
  /** Fecha editorial real de publicación (nunca se inventa ni se sustituye por updatedAt). */
  publishedAt: string;
  updatedAt?: string;
  format: ArticleFormat;
  /** Categoría principal (una sola). */
  category: ArticleCategory;
  featuredImage?: ArticleImage;
  /** Autor resuelto desde content/authors. Opcional. */
  author?: { name: string; slug?: string };
  noIndex: boolean;
}

export interface Article extends ArticleSummary {
  content: RtNode[];
  readingMinutes: number;
  tags: Array<{ slug: string; name: string }>;
  authorDetail?: { name: string; role?: string; bio?: string; avatar?: string; linkedin?: string; website?: string };
  services: ServiceRef[];
  offerings: OfferingRef[];
  caseStudies: string[];
  relatedArticleIds: string[];
  seo: Seo;
}
