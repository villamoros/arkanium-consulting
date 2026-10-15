/**
 * Forma cruda de Case Studies tal como llega del CMS. Proveedor pendiente (Storyblok): mapear aquí y en normalize.ts.
 */

type S = string | null | undefined;
export interface RawCaseStudy {
  slug?: S; type?: S; status?: S; visibility?: S; featured?: boolean | null; publishedAt?: S;
  title?: S; summary?: S;
  industry?: { slug?: S; name?: S } | null;
  clientName?: S; clientVisibility?: S; clientWebsite?: S; clientLogo?: { url?: S } | null; clientDescriptor?: S;
  challengeSummary?: S; challengeDetails?: S; approach?: S;
  approachSteps?: Array<{ phase?: S; body?: S }> | null;
  solution?: S; outcomes?: string[] | null; deliverables?: string[] | null; timeline?: S;
  metrics?: Array<{ label?: S; value?: S; unit?: S; context?: S; verified?: boolean | null; source?: S }> | null;
  technologies?: Array<{ slug?: S; name?: S; category?: S }> | null;
  services?: Array<{ slug?: S; family?: { slug?: S } | null }> | null;
  offerings?: Array<{ slug?: S; service?: { slug?: S; family?: { slug?: S } | null } | null }> | null;
  relatedCaseStudies?: Array<{ slug?: S }> | null;
  featuredImage?: { url?: S } | null;
  engagementReference?: S; evidenceStatus?: S;
  publicationAuthorization?: { status?: S } | null;
  seo?: { title?: S; description?: S; canonical?: S; noIndex?: boolean | null; ogImage?: { url?: S } | null } | null;
}
export interface RawCaseStudies { caseStudies: RawCaseStudy[] }
