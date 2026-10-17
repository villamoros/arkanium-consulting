/**
 * Invitaciones y bajas de miembros. Solo el owner las ejecuta (D-03, ARK-ARCH-001).
 * Clerk es la fuente de la membresía; aquí solo se registra la acción en la bitácora.
 */
import { eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { IdentityGateway } from '../auth/clerk.js';
import type { Db } from '../db/client.js';
import { organizations } from '../db/schema.js';
import { forgetSummary } from './summary.js';

export type MemberRole = 'org:admin' | 'org:member';

export class OrganizationError extends Error {
  constructor(
    public readonly code: 'not_found' | 'not_linked',
    message: string,
  ) {
    super(message);
  }
}

async function findOrganization(db: Db, id: string) {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!organization) throw new OrganizationError('not_found', 'Organización no encontrada.');
  if (!organization.clerkOrgId) throw new OrganizationError('not_linked', 'La organización no está vinculada a Clerk.');
  return organization;
}

/** Invita a una persona por correo con un rol. La invitación la envía Clerk. */
export async function inviteMember(
  db: Db,
  identity: IdentityGateway,
  input: { organizationId: string; email: string; role: MemberRole; ownerId: string },
): Promise<{ invitationId: string }> {
  const organization = await findOrganization(db, input.organizationId);
  const { invitationId } = await identity.inviteMember({
    orgId: organization.clerkOrgId!,
    email: input.email,
    role: input.role,
  });
  forgetSummary(organization.id);
  await audit(db, {
    actor: input.ownerId,
    action: 'member.invited',
    subjectType: 'organization',
    subjectId: organization.id,
    detail: { email: input.email, role: input.role, invitationId },
  });
  return { invitationId };
}

/** Retira a una persona de la organización. */
export async function removeMember(
  db: Db,
  identity: IdentityGateway,
  input: { organizationId: string; userId: string; ownerId: string },
): Promise<void> {
  const organization = await findOrganization(db, input.organizationId);
  await identity.removeMember({ orgId: organization.clerkOrgId!, userId: input.userId });
  forgetSummary(organization.id);
  await audit(db, {
    actor: input.ownerId,
    action: 'member.removed',
    subjectType: 'organization',
    subjectId: organization.id,
    detail: { userId: input.userId },
  });
}
