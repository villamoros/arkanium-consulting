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

/**
 * Todos los destinos a los que puede entrar la persona, para el menú del sitio.
 * Core si pertenece a la organización interna; un dashboard de cliente por cada organización de cliente.
 * Es navegación: cada app y cada endpoint vuelven a comprobar el acceso.
 */
export interface Destinations {
  destination: 'core' | 'app';
  orgId: string;
}

export function listDestinations(memberships: Array<{ orgId: string }>, internalOrgId: string): Destinations[] {
  const seen = new Set<string>();
  const result: Destinations[] = [];
  for (const membership of memberships) {
    if (seen.has(membership.orgId)) continue;
    seen.add(membership.orgId);
    result.push({ destination: membership.orgId === internalOrgId ? 'core' : 'app', orgId: membership.orgId });
  }
  // Core primero: es el panel del equipo.
  return result.sort((a, b) => (a.destination === b.destination ? 0 : a.destination === 'core' ? -1 : 1));
}
