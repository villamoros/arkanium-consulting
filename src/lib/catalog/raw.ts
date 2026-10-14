/**
 * Forma cruda del catálogo tal como llega del CMS. Proveedor pendiente (Storyblok): mapear aquí y en normalize.ts.
 */

/** Forma cruda del CMS (todo opcional: no se confía en el origen). */
export interface RawSeo { title?: string | null; description?: string | null; canonical?: string | null; noIndex?: boolean | null; ogImage?: { url?: string | null } | null }
export interface RawOffering {
  slug?: string | null; name?: string | null; shortDescription?: string | null; description?: string | null;
  problem?: string | null; solution?: string | null; duration?: string | null; engagementType?: string | null;
  investment?: string | null; investmentVisibility?: string | null; deliverables?: string[] | null; outcomes?: string[] | null; seo?: RawSeo | null;
}
export interface RawService {
  slug?: string | null; name?: string | null; label?: string | null; duration?: string | null; shortDescription?: string | null; description?: string | null;
  problem?: string | null; approach?: string | null; outcomes?: string[] | null; deliverables?: string[] | null;
  engagementModels?: string[] | null; ctaLabel?: string | null; faqs?: Array<{ question?: string | null; answer?: string | null }> | null; featured?: boolean | null; seo?: RawSeo | null;
  relatedServices?: Array<{ slug?: string | null; family?: { slug?: string | null } | null }> | null;
  offerings?: RawOffering[] | null;
}
export interface RawCategory { slug?: string | null; name?: string | null; services?: RawService[] | null }
export interface RawFamily {
  slug?: string | null; name?: string | null; shortDescription?: string | null; description?: string | null;
  icon?: string | null; featured?: boolean | null; categories?: RawCategory[] | null;
}
export interface RawCatalog { serviceFamilies: RawFamily[] }
