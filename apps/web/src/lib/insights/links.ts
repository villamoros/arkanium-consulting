/**
 * Regla editorial: todo artículo público está ligado a al menos un caso de estudio publicado en su MISMO idioma.
 * Si no, el build falla (fail-closed): un artículo sin caso no promociona servicios con evidencia de uso.
 */
export function assertCaseLinks(article: { slug: string; caseStudies: string[] }, locale: string, publishedCaseSlugs: ReadonlySet<string>): void {
  if (article.caseStudies.length === 0) {
    throw new Error(`[insights] "${article.slug}" (${locale}): todo artículo debe estar ligado a al menos un caso de estudio.`);
  }
  const missing = article.caseStudies.filter((slug) => !publishedCaseSlugs.has(slug));
  if (missing.length > 0) {
    throw new Error(`[insights] "${article.slug}" (${locale}): caso(s) de estudio no publicados en este idioma: ${missing.join(', ')}.`);
  }
}
