/**
 * Primer contrato (ARK-ARCH-002): F-01 captar, F-02 calificar y F-04 convertir en organización.
 * Cada paso deja registro en la bitácora. La decisión de calificar, posponer o descartar es del owner.
 */
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { IdentityGateway } from '../auth/clerk.js';
import type { Db } from '../db/client.js';
import { audit as auditEntry } from '../audit.js';
import { auditLog, campaigns, contacts, leads, meetings, organizations } from '../db/schema.js';
import type { LeadDecision, LeadIntake, LeadManual, LeadProposal, LeadUpdate } from '@arkanium/contracts';

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
  // Una campaña desconocida o eliminada no rechaza a la persona: el lead se guarda sin campaña.
  let campaignId: string | null = null;
  if (input.campaignId) {
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, input.campaignId), isNull(campaigns.deletedAt)));
    campaignId = campaign?.id ?? null;
  }
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
      campaignId,
    })
    .returning();
  await auditEntry(db, { subjectType: 'lead', actor: `sitio:${input.source}`, action: 'lead.captured', subjectId: lead!.id });
  return lead!;
}

export async function listLeads(db: Db, status?: Lead['status']): Promise<Lead[]> {
  // Los leads eliminados no aparecen en la lista; su registro se conserva.
  const conditions = [isNull(leads.deletedAt)];
  if (status) conditions.push(eq(leads.status, status));
  return db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.receivedAt));
}

/** F-02: el owner decide sobre el lead. Calificar, posponer o descartar. */
export async function decideLead(db: Db, leadId: string, decision: LeadDecision, ownerId: string): Promise<Lead> {
  const current = await findLead(db, leadId);
  if (current.status === 'convertido') {
    throw new LeadError('invalid_state', 'Un lead convertido ya no puede recalificarse.');
  }

  const status = decision.decision === 'calificar' ? 'calificado' : decision.decision === 'posponer' ? 'pospuesto' : 'descartado';
  // Solo al posponer se guarda cuándo volver a revisar; al calificar o descartar, la fecha se limpia.
  const revisitAt = decision.decision === 'posponer' && decision.revisitAt ? new Date(decision.revisitAt) : null;
  const [updated] = await db
    .update(leads)
    .set({ status, decisionNote: decision.reason, revisitAt, updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning();

  await auditEntry(db, {
    subjectType: 'lead',
    actor: ownerId,
    action: `lead.${decision.decision}`,
    subjectId: leadId,
    detail: { reason: decision.reason, revisitAt: revisitAt?.toISOString() ?? null },
  });
  return updated!;
}

/** Historial del lead: sus decisiones y cambios de la bitácora, y sus reuniones. Más reciente primero. */
export async function leadHistory(db: Db, leadId: string) {
  await findLead(db, leadId);
  const events = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.subjectType, 'lead'), eq(auditLog.subjectId, leadId)))
    .orderBy(desc(auditLog.at));
  const leadMeetings = await db.select().from(meetings).where(eq(meetings.leadId, leadId)).orderBy(desc(meetings.createdAt));
  return {
    events: events.map((event) => ({ id: event.id, at: event.at.toISOString(), actor: event.actor, action: event.action, detail: event.detail })),
    meetings: leadMeetings.map((meeting) => ({ id: meeting.id, topic: meeting.topic, status: meeting.status, startsAt: meeting.startsAt?.toISOString() ?? null })),
  };
}

/** Posibles duplicados: otros leads activos con el mismo correo, sin distinguir mayúsculas. */
export async function duplicatesOf(db: Db, leadId: string): Promise<Lead[]> {
  const lead = await findLead(db, leadId);
  return db
    .select()
    .from(leads)
    .where(and(isNull(leads.deletedAt), ne(leads.id, leadId), sql`lower(${leads.email}) = lower(${lead.email})`))
    .orderBy(desc(leads.receivedAt));
}

/**
 * Responde a la propuesta del agente. Aceptar la usa como motivo y califica el lead;
 * rechazarla solo queda registrado. En ambos casos la decisión es del owner.
 */
export async function respondToProposal(db: Db, leadId: string, input: LeadProposal, ownerId: string): Promise<Lead> {
  const current = await findLead(db, leadId);
  if (current.status === 'convertido' || current.status === 'descartado') {
    throw new LeadError('invalid_state', 'Solo se responde a la propuesta de un lead activo.');
  }
  if (!current.proposedReason) {
    throw new LeadError('invalid_state', 'Este lead no tiene propuesta del agente.');
  }

  if (input.accepted) {
    const reason = input.note ? `${current.proposedReason} · ${input.note}` : current.proposedReason;
    const [updated] = await db
      .update(leads)
      .set({ status: 'calificado', decisionNote: reason, revisitAt: null, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();
    await auditEntry(db, { subjectType: 'lead', actor: ownerId, action: 'lead.propuesta_aceptada', subjectId: leadId, detail: { reason } });
    return updated!;
  }

  await auditEntry(db, {
    subjectType: 'lead',
    actor: ownerId,
    action: 'lead.propuesta_rechazada',
    subjectId: leadId,
    detail: { proposedReason: current.proposedReason, note: input.note ?? null },
  });
  return current;
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

export async function findLead(db: Db, leadId: string): Promise<Lead> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead || lead.deletedAt) throw new LeadError('not_found', 'Lead no encontrado.');
  return lead;
}


/** Alta manual (owner): mensaje directo, comentario, referido o evento. Queda en la bitácora con su origen. */
export async function createManualLead(db: Db, input: LeadManual, ownerId: string): Promise<Lead> {
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
      sourceReference: input.sourceReference ?? null,
    })
    .returning();
  await auditEntry(db, { subjectType: 'lead', actor: ownerId, action: 'lead.created_manual', subjectId: lead!.id, detail: { source: input.source } });
  return lead!;
}

/** Datos de contacto que se pueden cambiar en un lead convertido: se sincronizan con su contacto principal. */
const CONTACT_FIELDS = ['name', 'email'] as const;

/**
 * Edición de datos (owner). Un lead no convertido se edita completo.
 * Un lead convertido solo cambia nombre y correo, que se reflejan en el contacto principal de su organización.
 * Empresa, mensaje, origen e interés quedan como historial del lead.
 */
export async function updateLead(db: Db, leadId: string, input: LeadUpdate, ownerId: string): Promise<Lead> {
  const current = await findLead(db, leadId);
  const changedKeys = Object.keys(input) as Array<keyof LeadUpdate>;

  if (current.status === 'convertido') {
    const outside = changedKeys.filter((key) => !(CONTACT_FIELDS as readonly string[]).includes(key));
    if (outside.length > 0) {
      throw new LeadError('invalid_state', 'Un lead convertido solo permite cambiar nombre y correo; el resto queda como historial.');
    }
  }

  const changes: Partial<typeof leads.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) changes.name = input.name;
  if (input.email !== undefined) changes.email = input.email;
  if (input.company !== undefined) changes.company = input.company;
  if (input.priority !== undefined) changes.priorityChoice = input.priority;
  if (input.context !== undefined) changes.context = input.context;
  if (input.source !== undefined) changes.source = input.source;
  if (input.sourceReference !== undefined) changes.sourceReference = input.sourceReference;

  const [updated] = await db.update(leads).set(changes).where(eq(leads.id, leadId)).returning();

  // El contacto principal de la organización sigue al lead convertido.
  if (current.status === 'convertido' && (input.name !== undefined || input.email !== undefined)) {
    await db
      .update(contacts)
      .set({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.email !== undefined ? { email: input.email } : {}) })
      .where(and(eq(contacts.leadId, leadId), eq(contacts.isPrimary, true)));
  }

  await auditEntry(db, { subjectType: 'lead', actor: ownerId, action: 'lead.updated', subjectId: leadId, detail: { fields: changedKeys } });
  return updated!;
}

/** Eliminación suave (owner). Exige motivo. Un lead convertido no se elimina: su organización depende de él. */
export async function deleteLead(db: Db, leadId: string, reason: string, ownerId: string): Promise<void> {
  const current = await findLead(db, leadId);
  if (current.status === 'convertido') {
    throw new LeadError('invalid_state', 'Un lead convertido no se elimina: ya es una organización.');
  }
  await db.update(leads).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));
  await auditEntry(db, { subjectType: 'lead', actor: ownerId, action: 'lead.deleted', subjectId: leadId, detail: { reason } });
}
