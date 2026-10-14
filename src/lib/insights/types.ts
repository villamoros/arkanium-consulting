import type { Seo, ServiceRef } from '../catalog/types';
import type { OfferingRef } from '../case-studies/types';
import type { RtNode } from './richtext';

export interface ArticleImage {
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
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
  featuredImage?: ArticleImage;
  categories: Array<{ slug: string; name: string }>;
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
