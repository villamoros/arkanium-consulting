/**
 * Consulta de Case Studies contra el contenido local. Pide todos los campos que usa normalize.ts:
 * el filtrado por estado y visibilidad se hace allí (fail-closed), no en la consulta.
 */
export const CASE_STUDIES_QUERY = /* GraphQL */ `
  query CaseStudies($locale: Locale!) {
    caseStudies(locale: $locale) {
      slug
      type
      status
      visibility
      featured
      publishedAt
      title
      summary
      industry { slug name }
      clientName
      clientVisibility
      clientWebsite
      clientLogo { url }
      clientDescriptor
      challengeSummary
      challengeDetails
      approach
      approachSteps { phase body }
      solution
      outcomes
      deliverables
      timeline
      metrics { label value unit context verified source }
      technologies { slug name category }
      services { slug family { slug } }
      offerings { slug service { slug family { slug } } }
      relatedCaseStudies { slug }
      featuredImage { url }
      engagementReference
      evidenceStatus
      publicationAuthorization { status }
      seo { title description canonical noIndex ogImage { url } }
    }
  }
`;
