/**
 * Estado actual: no hay CMS conectado. Hygraph fue retirado y Storyblok (GraphQL) aún no está integrado.
 * Catálogo, casos e insights se construyen vacíos (sin datos de prueba). Al integrar Storyblok,
 * sustituir los cargadores (catalog/index.ts, case-studies/index.ts, insights/index.ts) por la consulta real.
 */
const warned = new Set<string>();

export function warnCmsPending(scope: string): void {
  if (warned.has(scope)) return;
  warned.add(scope);
  console.warn(`[${scope}] Sin CMS conectado (Storyblok pendiente): se devuelven datos vacíos.`);
}
