import type { Seo, ServiceRef } from '../catalog/types';

/** Naturaleza editorial del caso. REPRESENTATIVE nunca afirma que algo ocurrió con un cliente. */
export type CaseType = 'REAL' | 'REPRESENTATIVE' | 'ANONYMIZED';
/** PRIVATE nunca llega al dominio (se descarta al normalizar). */
export type CaseVisibility = 'PUBLIC' | 'UNLISTED';
export type ApproachPhase = 'ASSESSMENT' | 'STRATEGY' | 'ARCHITECTURE' | 'IMPLEMENTATION' | 'GOVERNANCE';

/** Solo existen métricas verificadas: las demás se descartan al normalizar. */
export interface CaseMetric {
  label: string;
  value: string;
  unit?: string;
  context?: string;
  source?: string;
}

export interface OfferingRef extends ServiceRef {
  /** Slug del servicio al que pertenece el offering. */
  service: string;
}

export interface CaseStudy {
  slug: string;
  type: CaseType;
  visibility: CaseVisibility;
  featured: boolean;
  publishedAt?: string;
  title: string;
  /** Resumen para tarjetas (si el CMS no lo define, se usa challengeSummary). */
  summary: string;
  industry?: { slug: string; name: string };
  /** Solo REAL + clientVisibility PUBLIC. En cualquier otro caso es undefined. */
  client?: { name: string; logo?: string; website?: string };
  /** Solo ANONYMIZED: descriptor no identificable (p. ej. "B2B financial services company"). */
  clientDescriptor?: string;
  challengeSummary?: string;
  challengeDetails?: string;
  approach?: string;
  approachSteps: Array<{ phase: ApproachPhase; body: string }>;
  solution?: string;
  outcomes: string[];
  deliverables: string[];
  timeline?: string;
  metrics: CaseMetric[];
  technologies: Array<{ slug: string; name: string; category?: string }>;
  services: ServiceRef[];
  offerings: OfferingRef[];
  relatedCaseStudies: string[];
  featuredImage?: string;
  seo: Seo;
}
