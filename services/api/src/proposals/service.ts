/**
 * Propuestas (Core): qué ofrecemos a un lead calificado o a un cliente, en qué versión está y en qué estado.
 * Reglas: solo un borrador recibe versiones nuevas; no se envía a aprobación con el precio por confirmar;
 * enviar y registrar la decisión del cliente son acciones del owner; ningún correo suprimido recibe una propuesta.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { leads, organizations, proposalVersions, proposals } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import { assertNotSuppressed, resolveInvitees } from '../meetings/service.js';
import type { ProposalCreate, ProposalDecision, ProposalVersion } from '@arkanium/contracts';

export type Proposal = typeof proposals.$inferSelect;
export type ProposalVersionRow = typeof proposalVersions.$inferSelect;

async function findProposal(db: Db, id: string): Promise<Proposal> {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
  if (!proposal) throw new ServiceError(404, 'not_found', 'Propuesta no encontrada.');
  return proposal;
}

async function currentVersionOf(db: Db, proposal: Proposal): Promise<ProposalVersionRow> {
  const [version] = await db
    .select()
    .from(proposalVersions)
    .where(and(eq(proposalVersions.proposalId, proposal.id), eq(proposalVersions.version, proposal.currentVersion)));
  if (!version) throw new ServiceError(409, 'invalid_state', 'La propuesta no tiene versión vigente.');
  return version;
}

function requireStatus(proposal: Proposal, allowed: Proposal['status'][], message: string) {
  if (!allowed.includes(proposal.status)) throw new ServiceError(409, 'invalid_state', message);
}

export async function createProposal(db: Db, input: ProposalCreate, actor: string): Promise<{ proposal: Proposal; version: ProposalVersionRow }> {
  let organizationId: string | null = null;
  let leadId: string | null = null;

  if (input.kind === 'cliente') {
    const [organization] = await db.select({ id: organizations.id, kind: organizations.kind }).from(organizations).where(eq(organizations.id, input.organizationId!));
    if (!organization || organization.kind !== 'client') throw new ServiceError(404, 'not_found', 'Cliente no encontrado.');
    organizationId = organization.id;
  } else {
    const [lead] = await db.select().from(leads).where(and(eq(leads.id, input.leadId!), isNull(leads.deletedAt)));
    if (!lead) throw new ServiceError(404, 'not_found', 'Lead no encontrado.');
    if (lead.status !== 'calificado') throw new ServiceError(409, 'invalid_state', 'Solo se propone a un lead calificado.');
    leadId = lead.id;
  }

  const [proposal] = await db
    .insert(proposals)
    .values({ organizationId, leadId, title: input.title, serviceFamily: input.serviceFamily, templateCode: input.templateCode, status: 'borrador', currentVersion: 1 })
    .returning();
  const [version] = await db
    .insert(proposalVersions)
    .values({
      proposalId: proposal!.id,
      version: 1,
      summary: input.summary,
      priceStatus: input.priceStatus,
      priceCents: input.priceCents ?? null,
      priceNote: input.priceNote ?? null,
      createdBy: actor,
    })
    .returning();
  await audit(db, { actor, action: 'proposal.created', subjectType: 'proposal', subjectId: proposal!.id, detail: { organizationId, leadId } });
  return { proposal: proposal!, version: version! };
}

/** Nueva versión: solo en borrador. Lo enviado no se reescribe; se crea otra propuesta si hace falta. */
export async function addVersion(db: Db, id: string, input: ProposalVersion, actor: string): Promise<{ proposal: Proposal; version: ProposalVersionRow }> {
  const proposal = await findProposal(db, id);
  requireStatus(proposal, ['borrador'], 'Solo un borrador recibe versiones nuevas.');
  const next = proposal.currentVersion + 1;
  const [version] = await db
    .insert(proposalVersions)
    .values({
      proposalId: id,
      version: next,
      summary: input.summary,
      priceStatus: input.priceStatus,
      priceCents: input.priceCents ?? null,
      priceNote: input.priceNote ?? null,
      createdBy: actor,
    })
    .returning();
  const [updated] = await db.update(proposals).set({ currentVersion: next, updatedAt: new Date() }).where(eq(proposals.id, id)).returning();
  await audit(db, { actor, action: 'proposal.version_created', subjectType: 'proposal', subjectId: id, detail: { version: next } });
  return { proposal: updated!, version: version! };
}

/** Enviar a aprobación: exige precio confirmado en la versión vigente. */
export async function sendToApproval(db: Db, id: string, actor: string): Promise<Proposal> {
  const proposal = await findProposal(db, id);
  requireStatus(proposal, ['borrador'], 'Solo un borrador se envía a aprobación.');
  const version = await currentVersionOf(db, proposal);
  if (version.priceStatus !== 'confirmado') {
    throw new ServiceError(409, 'invalid_state', 'Confirma el precio antes de enviar la propuesta a aprobación.');
  }
  const [updated] = await db.update(proposals).set({ status: 'en_aprobacion', updatedAt: new Date() }).where(eq(proposals.id, id)).returning();
  await audit(db, { actor, action: 'proposal.sent_to_approval', subjectType: 'proposal', subjectId: id, detail: { version: proposal.currentVersion } });
  return updated!;
}

/** El owner aprueba el envío y lo registra como enviado. Ningún correo suprimido recibe la propuesta. */
export async function markSent(db: Db, id: string, actor: string): Promise<Proposal> {
  const proposal = await findProposal(db, id);
  requireStatus(proposal, ['en_aprobacion'], 'Solo una propuesta en aprobación se marca como enviada.');
  const recipients = await resolveInvitees(db, { leadId: proposal.leadId, organizationId: proposal.organizationId }, []);
  await assertNotSuppressed(db, recipients);
  const [updated] = await db.update(proposals).set({ status: 'enviada', updatedAt: new Date() }).where(eq(proposals.id, id)).returning();
  await audit(db, { actor, action: 'proposal.sent', subjectType: 'proposal', subjectId: id, detail: { version: proposal.currentVersion, recipients } });
  return updated!;
}

/** Aceptación: se registra con la referencia de la firma adjunta. */
export async function acceptProposal(db: Db, id: string, input: ProposalDecision, actor: string): Promise<Proposal> {
  const proposal = await findProposal(db, id);
  requireStatus(proposal, ['enviada'], 'Solo una propuesta enviada se puede aceptar.');
  const [updated] = await db
    .update(proposals)
    .set({ status: 'aceptada', decisionNote: input.note, decidedAt: new Date(), updatedAt: new Date() })
    .where(eq(proposals.id, id))
    .returning();
  await audit(db, { actor, action: 'proposal.accepted', subjectType: 'proposal', subjectId: id, detail: { signature: input.note } });
  return updated!;
}

/** Rechazo: queda el motivo en la bitácora. */
export async function rejectProposal(db: Db, id: string, input: ProposalDecision, actor: string): Promise<Proposal> {
  const proposal = await findProposal(db, id);
  requireStatus(proposal, ['enviada'], 'Solo una propuesta enviada se puede rechazar.');
  const [updated] = await db
    .update(proposals)
    .set({ status: 'rechazada', decisionNote: input.note, decidedAt: new Date(), updatedAt: new Date() })
    .where(eq(proposals.id, id))
    .returning();
  await audit(db, { actor, action: 'proposal.rejected', subjectType: 'proposal', subjectId: id, detail: { reason: input.note } });
  return updated!;
}

function viewOf(proposal: Proposal, version: ProposalVersionRow | undefined, targetName: string | null) {
  return {
    id: proposal.id,
    kind: proposal.organizationId ? ('cliente' as const) : ('lead' as const),
    organizationId: proposal.organizationId,
    leadId: proposal.leadId,
    targetName,
    title: proposal.title,
    serviceFamily: proposal.serviceFamily,
    templateCode: proposal.templateCode,
    status: proposal.status,
    currentVersion: proposal.currentVersion,
    summary: version?.summary ?? '',
    priceStatus: version?.priceStatus ?? 'por_confirmar',
    priceCents: version?.priceCents ?? null,
    priceNote: version?.priceNote ?? null,
    decisionNote: proposal.decisionNote,
    decidedAt: proposal.decidedAt?.toISOString() ?? null,
    updatedAt: proposal.updatedAt.toISOString(),
  };
}

/** Lista para Core: cada propuesta con su versión vigente y a quién va. */
export async function listProposals(db: Db) {
  const rows = await db
    .select({ proposal: proposals, orgName: organizations.name, leadName: leads.name })
    .from(proposals)
    .leftJoin(organizations, eq(proposals.organizationId, organizations.id))
    .leftJoin(leads, eq(proposals.leadId, leads.id))
    .orderBy(desc(proposals.updatedAt));
  const versions = await db.select().from(proposalVersions);
  return rows.map((row) => {
    const current = versions.find((v) => v.proposalId === row.proposal.id && v.version === row.proposal.currentVersion);
    return viewOf(row.proposal, current, row.orgName ?? row.leadName ?? null);
  });
}

/** Detalle: la propuesta, su versión vigente y el historial de versiones. */
export async function proposalDetail(db: Db, id: string) {
  const [row] = await db
    .select({ proposal: proposals, orgName: organizations.name, leadName: leads.name })
    .from(proposals)
    .leftJoin(organizations, eq(proposals.organizationId, organizations.id))
    .leftJoin(leads, eq(proposals.leadId, leads.id))
    .where(eq(proposals.id, id));
  if (!row) throw new ServiceError(404, 'not_found', 'Propuesta no encontrada.');
  const versions = await db.select().from(proposalVersions).where(eq(proposalVersions.proposalId, id)).orderBy(asc(proposalVersions.version));
  const current = versions.find((v) => v.version === row.proposal.currentVersion);
  return {
    ...viewOf(row.proposal, current, row.orgName ?? row.leadName ?? null),
    versions: versions.map((v) => ({
      version: v.version,
      summary: v.summary,
      priceStatus: v.priceStatus,
      priceCents: v.priceCents,
      priceNote: v.priceNote,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}
