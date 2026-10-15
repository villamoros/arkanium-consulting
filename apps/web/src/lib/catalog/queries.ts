/**
 * Consulta del catálogo contra el contenido local. Los alias devuelven la forma que ya consume normalize.ts:
 * `value` → slug, `solution` → approach, `description` → shortDescription (la descripción corta es la del servicio).
 */
export const CATALOG_QUERY = /* GraphQL */ `
  query Catalog($locale: Locale!) {
    serviceFamilies(locale: $locale) {
      slug: value
      name
      categories {
        slug: value
        name
        services {
          slug: value
          label
          name
          duration
          shortDescription: description
          problem
          approach: solution
          outcomes
        }
      }
    }
  }
`;
