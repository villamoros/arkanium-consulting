/**
 * Poder sobre una organización de cliente.
 *  - El owner suspende y reactiva (corta el acceso sin borrar nada) y ve el equipo completo.
 *  - El administrador del cliente gestiona su equipo: cambia roles y retira personas.
 *    Nunca puede dejar la organización sin administrador.
 * Todo queda en la bitácora.
 */
import { eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { IdentityGateway } from '../auth/clerk.js';
import type { Db } from '../db/client.js';
import { organizations } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { Organization } from '../access.js';

export async function setOrganizationStatus(
  db: Db,
  organization: Organization,
  status: 'active' | 'suspended',
  input: { actor: string; reason?: string },
): Promise<Organization> {
  if (organization.status === status) {
    throw new ServiceError(409, 'invalid_state', status === 'suspended' ? 'La organización ya está suspendida.' : 'La organización ya está activa.');
  }
  const [updated] = await db.update(organizations).set({ status }).where(eq(organizations.id, organization.id)).returning();
  await audit(db, {
    actor: input.actor,
    action: status === 'suspended' ? 'organization.suspended' : 'organization.reactivated',
    subjectType: 'organization',
    subjectId: organization.id,
    detail: { reason: input.reason ?? null },
  });
  return updated!;
}

export async function listMembers(identity: IdentityGateway, organization: Organization) {
  if (!organization.clerkOrgId) throw new ServiceError(409, 'invalid_state', 'La organización no está vinculada a Clerk.');
  return identity.listMembers(organization.clerkOrgId);
}

/** Cambia el rol de una persona. No deja la organización sin ningún administrador. */
export async function changeMemberRole(
  db: Db,
  identity: IdentityGateway,
  organization: Organization,
  input: { userId: string; role: 'org:admin' | 'org:member'; actor: string },
): Promise<void> {
  if (!organization.clerkOrgId) throw new ServiceError(409, 'invalid_state', 'La organización no está vinculada a Clerk.');
  const members = await identity.listMembers(organization.clerkOrgId);
  const target = members.find((m) => m.userId === input.userId);
  if (!target) throw new ServiceError(404, 'not_found', 'Esa persona no es miembro de la organización.');

  const admins = members.filter((m) => m.role === 'org:admin').length;
  if (target.role === 'org:admin' && input.role === 'org:member' && admins <= 1) {
    throw new ServiceError(409, 'conflict', 'No puedes quitar el último administrador de la organización.');
  }

  await identity.updateMemberRole({ orgId: organization.clerkOrgId, userId: input.userId, role: input.role });
  await audit(db, {
    actor: input.actor,
    action: 'member.role_changed',
    subjectType: 'organization',
    subjectId: organization.id,
    detail: { userId: input.userId, from: target.role, to: input.role },
  });
}

/** Retira a una persona. Igual que el cambio de rol, no deja la organización sin administrador. */
export async function removeMemberGuarded(
  db: Db,
  identity: IdentityGateway,
  organization: Organization,
  input: { userId: string; actor: string },
): Promise<void> {
  if (!organization.clerkOrgId) throw new ServiceError(409, 'invalid_state', 'La organización no está vinculada a Clerk.');
  const members = await identity.listMembers(organization.clerkOrgId);
  const target = members.find((m) => m.userId === input.userId);
  if (!target) throw new ServiceError(404, 'not_found', 'Esa persona no es miembro de la organización.');

  const admins = members.filter((m) => m.role === 'org:admin').length;
  if (target.role === 'org:admin' && admins <= 1) {
    throw new ServiceError(409, 'conflict', 'No puedes retirar al último administrador de la organización.');
  }

  await identity.removeMember({ orgId: organization.clerkOrgId, userId: input.userId });
  await audit(db, { actor: input.actor, action: 'member.removed', subjectType: 'organization', subjectId: organization.id, detail: { userId: input.userId } });
}
