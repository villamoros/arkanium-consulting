/**
 * Decide a qué aplicación va una persona después de iniciar sesión, y qué organización activar.
 *
 * - Miembro de la organización interna  → core (activa la interna)
 * - Miembro de al menos una organización de cliente → app (activa la primera)
 * - Sin organizaciones                  → none (página «sin acceso»)
 *
 * Es comodidad de navegación, no seguridad: cada app y cada endpoint vuelven a comprobar el acceso.
 * Limitación conocida: si una persona pertenece a varias organizaciones de cliente, se elige la primera;
 * un selector de organización llegará con la fase 4.
 */
export type Destination =
  | { destination: 'core'; orgId: string }
  | { destination: 'app'; orgId: string }
  | { destination: 'none' };

export function decideDestination(memberships: Array<{ orgId: string }>, internalOrgId: string): Destination {
  if (memberships.some((m) => m.orgId === internalOrgId)) return { destination: 'core', orgId: internalOrgId };
  const first = memberships[0];
  if (first) return { destination: 'app', orgId: first.orgId };
  return { destination: 'none' };
}
