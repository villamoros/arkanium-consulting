/**
 * Primer contrato (ARK-ARCH-002): F-01 captar, F-02 calificar y F-04 convertir en organización.
 * Cada paso deja registro en la bitácora. La decisión de calificar, posponer o descartar es del owner.
 */
import { eq, desc } from 'drizzle-orm';
import type { IdentityGateway } from '../auth/clerk.js';
import type { Db } from '../db/client.js';
import { audit as auditEntry } from '../audit.js';
import { auditLog, contacts, leads, organizations } from '../db/schema.js';
import type { LeadDecision, LeadIntake } from '@arkanium/contracts';

export type Lead = typeof leads.$inferSelect;

export class LeadError extends Error {
  constructor(
    public readonly code: 'not_found' | 'invalid_state',
    message: string,
  ) {
    super(message);
  }
}

/** F-01: registra un lead que llega desde el sitio. */
export async function captureLead(db: Db, input: LeadIntake): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      priorityChoice: input.priority,
      context: input.context ?? null,
      locale: input.locale,
      source: input.source,
    })
    .returning();
  await auditEntry(db, { subjectType: 'lead', actor: `sitio:${input.source}`, action: 'lead.captured', subjectId: lead!.id });
  return lead!;
}

export async function listLeads(db: Db, status?: Lead['status']): Promise<Lead[]> {
  const query = db.select().from(leads).orderBy(desc(leads.receivedAt));
  return status ? query.where(eq(leads.status, status)) : query;
}

/** F-02: el owner decide sobre el lead. Calificar, posponer o descartar. */
export async function decideLead(db: Db, leadId: string, decision: LeadDecision, ownerId: string): Promise<Lead> {
  const current = await findLead(db, leadId);
  if (current.status === 'convertido') {
    throw new LeadError('invalid_state', 'Un lead convertido ya no puede recalificarse.');
  }

  const status = decision.decision === 'calificar' ? 'calificado' : decision.decision === 'posponer' ? 'pospuesto' : 'descartado';
  const [updated] = await db
    .update(leads)
    .set({ status, decisionNote: decision.reason, updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning();

  await auditEntry(db, { subjectType: 'lead', actor: ownerId, action: `lead.${decision.decision}`, subjectId: leadId, detail: { reason: decision.reason } });
  return updated!;
}

/**
 * F-04: convierte un lead calificado en organización de cliente.
 * Crea la organización en Clerk y en nuestra base, y el contacto principal.
 */
export async function convertLead(db: Db, leadId: string, ownerId: string, identity: IdentityGateway): Promise<{ lead: Lead; organizationId: string }> {
  const current = await findLead(db, leadId);
  if (current.status !== 'calificado') {
    throw new LeadError('invalid_state', 'Solo se puede convertir un lead calificado.');
  }

  const name = current.company?.trim() || current.name;
  // Primero Clerk: si falla, no queda nada a medias. Si la base falla después, la organización de Clerk
  // queda sin registro local y se registra en la bitácora para retirarla a mano.
  const clerkOrg = await identity.createOrganization({ name, createdBy: ownerId });

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({ name, kind: 'client', clerkOrgId: clerkOrg.orgId })
      .returning();

    await tx.insert(contacts).values({
      name: current.name,
      email: current.email,
      leadId: current.id,
      organizationId: organization!.id,
      isPrimary: true,
    });

    const [lead] = await tx
      .update(leads)
      .set({ status: 'convertido', organizationId: organization!.id, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    await tx.insert(auditLog).values({
      actor: ownerId,
      action: 'lead.converted',
      subjectType: 'lead',
      subjectId: leadId,
      detail: { organizationId: organization!.id, clerkOrgId: clerkOrg.orgId },
    });

    return { lead: lead!, organizationId: organization!.id };
  });
}

async function findLead(db: Db, leadId: string): Promise<Lead> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new LeadError('not_found', 'Lead no encontrado.');
  return lead;
}

