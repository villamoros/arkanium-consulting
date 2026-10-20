/**
 * Resumen de cada cliente para Core: cuántas personas tiene, sus nombres y correos (para buscar),
 * cuántas invitaciones siguen pendientes y, si está suspendido, el motivo que quedó en la bitácora.
 * Las personas viven en Clerk; se guardan 60 segundos para no esperar a Clerk en cada carga.
 */
import { and, desc, eq } from 'drizzle-orm';
import type { IdentityGateway } from '../auth/clerk.js';
import type { Db } from '../db/client.js';
import { auditLog } from '../db/schema.js';

export interface ClientSummary {
  memberCount: number;
  /** Nombres y correos de las personas, para la búsqueda en Core. */
  people: string[];
  pendingInvitations: number;
  /** true cuando Clerk no reconoce la organización o no responde. */
  membersUnavailable: boolean;
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: ClientSummary }>();

export async function clientSummary(identity: IdentityGateway, organization: { id: string; clerkOrgId: string | null }): Promise<ClientSummary> {
  if (!organization.clerkOrgId) return { memberCount: 0, people: [], pendingInvitations: 0, membersUnavailable: true };

  const hit = cache.get(organization.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: ClientSummary;
  try {
    const [members, invitations] = await Promise.all([identity.listMembers(organization.clerkOrgId), identity.listInvitations(organization.clerkOrgId)]);
    value = {
      memberCount: members.length,
      people: members.flatMap((member) => [member.name, member.email].filter((item): item is string => Boolean(item))),
      pendingInvitations: invitations.length,
      membersUnavailable: false,
    };
  } catch {
    value = { memberCount: 0, people: [], pendingInvitations: 0, membersUnavailable: true };
  }
  cache.set(organization.id, { at: Date.now(), value });
  return value;
}

/** Olvida el resumen de una organización: se llama al invitar, cambiar un rol o retirar a alguien. */
export function forgetSummary(organizationId: string): void {
  cache.delete(organizationId);
}

/** Motivo de la última suspensión, tomado de la bitácora. Vacío si nunca se registró. */
export async function suspensionReason(db: Db, organizationId: string): Promise<string | null> {
  const [entry] = await db
    .select({ detail: auditLog.detail })
    .from(auditLog)
    .where(and(eq(auditLog.subjectType, 'organization'), eq(auditLog.subjectId, organizationId), eq(auditLog.action, 'organization.suspended')))
    .orderBy(desc(auditLog.at))
    .limit(1);
  const reason = (entry?.detail as { reason?: string | null } | undefined)?.reason;
  return reason ?? null;
}
