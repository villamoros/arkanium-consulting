/**
 * Reglas de acceso. La membresía la decide Clerk; aquí solo se comprueba.
 *  - Owner: administrador de la organización interna. Actúa desde core.
 *  - Administrador de cliente (org:admin): decide por su organización (aprueba, paga, gestiona su equipo).
 *  - Miembro de cliente (org:member): ve y deja correcciones, pide reuniones; no aprueba ni paga.
 * Una organización suspendida solo es accesible para el owner.
 */
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IdentityGateway } from './auth/clerk.js';
import type { Db } from './db/client.js';
import { organizations } from './db/schema.js';
import { ServiceError } from './errors.js';

export interface Membership {
  orgId: string;
  role: string;
}

export interface Caller {
  userId: string;
  memberships: Membership[];
}

export type Organization = typeof organizations.$inferSelect;

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

/** Identifica a quien llama. Responde 401 y devuelve null si el token no es válido. */
export async function loadCaller(request: FastifyRequest, reply: FastifyReply, identity: IdentityGateway): Promise<Caller | null> {
  const token = bearerToken(request);
  const userId = token ? await identity.verifyBearer(token) : null;
  if (!userId) {
    await reply.code(401).send({ error: 'unauthorized' });
    return null;
  }
  return { userId, memberships: await identity.listOrganizations(userId) };
}

/** Rol que tiene la persona en una organización de Clerk, o null si no es miembro. */
export function roleIn(caller: Caller, clerkOrgId: string | null): string | null {
  if (!clerkOrgId) return null;
  return caller.memberships.find((m) => m.orgId === clerkOrgId)?.role ?? null;
}

export function isOwner(caller: Caller, internalOrgId: string): boolean {
  return caller.memberships.some((m) => m.orgId === internalOrgId && m.role === 'org:admin');
}

/** Lanza 403 si la persona no es owner. */
export function requireOwnerCaller(caller: Caller, internalOrgId: string): void {
  if (!isOwner(caller, internalOrgId)) throw new ServiceError(403, 'forbidden', 'Solo el owner puede hacer esto.');
}

export async function findOrganization(db: Db, id: string): Promise<Organization> {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!organization) throw new ServiceError(404, 'not_found', 'Organización no encontrada.');
  return organization;
}

/**
 * Acceso de cliente a una organización. El owner pasa siempre, incluso si está suspendida.
 * Miembros y administradores pasan solo si la organización está activa.
 */
export function requireClientAccess(caller: Caller, organization: Organization, internalOrgId: string, options: { admin?: boolean } = {}): string {
  if (isOwner(caller, internalOrgId)) return 'owner';
  const role = roleIn(caller, organization.clerkOrgId);
  if (!role) throw new ServiceError(403, 'forbidden', 'No perteneces a esta organización.');
  if (organization.status === 'suspended') throw new ServiceError(403, 'suspended', 'El acceso de esta organización está suspendido.');
  if (options.admin && role !== 'org:admin') throw new ServiceError(403, 'forbidden', 'Solo un administrador de la organización puede hacer esto.');
  return role;
}

/** Errores de servicio se traducen a respuestas HTTP en un solo lugar. */
export function sendServiceError(reply: FastifyReply, error: ServiceError) {
  return reply.code(error.status).send({ error: error.code, message: error.message });
}
