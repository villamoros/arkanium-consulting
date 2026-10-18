/**
 * Brief de campaña y piezas publicitarias.
 *
 * Reglas:
 *  - Una campaña no se activa sin brief aprobado.
 *  - El agente solo produce piezas con el brief aprobado, y solo para las redes del brief.
 *  - Cada pieza se aprueba por separado antes de publicarse. Publicar y pausar lo hace el agente desde Control.
 *  - Editar un brief o una pieza ya aprobados los devuelve a borrador: la aprobación anterior ya no aplica.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { buyerPersonas, campaignPersonas, campaignPieces, campaigns } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { CampaignBrief, PieceCreate, PieceUpdate } from '@arkanium/contracts';

export type Campaign = typeof campaigns.$inferSelect;
export type Piece = typeof campaignPieces.$inferSelect;

export async function findCampaignRow(db: Db, id: string): Promise<Campaign> {
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), isNull(campaigns.deletedAt)));
  if (!campaign) throw new ServiceError(404, 'not_found', 'Campaña no encontrada.');
  return campaign;
}

async function findPiece(db: Db, id: string): Promise<Piece> {
  const [piece] = await db.select().from(campaignPieces).where(and(eq(campaignPieces.id, id), isNull(campaignPieces.deletedAt)));
  if (!piece) throw new ServiceError(404, 'not_found', 'Pieza no encontrada.');
  return piece;
}

/** Identificadores de los perfiles de una campaña. */
export async function campaignPersonaIds(db: Db, campaignId: string): Promise<string[]> {
  const rows = await db.select({ personaId: campaignPersonas.personaId }).from(campaignPersonas).where(eq(campaignPersonas.campaignId, campaignId));
  return rows.map((row) => row.personaId);
}

/** Piezas de una campaña, sin las eliminadas. */
export async function campaignPiecesOf(db: Db, campaignId: string) {
  const rows = await db
    .select()
    .from(campaignPieces)
    .where(and(eq(campaignPieces.campaignId, campaignId), isNull(campaignPieces.deletedAt)))
    .orderBy(asc(campaignPieces.createdAt));
  return rows.map(pieceDto);
}

export function pieceDto(piece: Piece) {
  return {
    id: piece.id,
    network: piece.network,
    format: piece.format,
    copy: piece.copy,
    assetUrl: piece.assetUrl,
    status: piece.status,
    updatedAt: piece.updatedAt.toISOString(),
  };
}

/** Brief completo de una campaña, para la pantalla y para el agente. */
export async function campaignBriefOf(db: Db, campaign: Campaign) {
  return {
    objective: campaign.objective,
    message: campaign.message,
    cta: campaign.cta,
    constraints: campaign.constraints,
    kpis: campaign.kpis,
    budgetCents: campaign.budgetCents,
    networks: campaign.networks,
    personaIds: await campaignPersonaIds(db, campaign.id),
    status: campaign.briefStatus,
    approvedAt: campaign.briefApprovedAt?.toISOString() ?? null,
  };
}

/** Guarda el brief y sus perfiles. Si ya estaba aprobado, vuelve a borrador. */
export async function saveBrief(db: Db, campaignId: string, input: CampaignBrief, actor: string) {
  const current = await findCampaignRow(db, campaignId);
  const personas = await db
    .select({ id: buyerPersonas.id })
    .from(buyerPersonas)
    .where(and(inArray(buyerPersonas.id, input.personaIds), isNull(buyerPersonas.deletedAt)));
  if (personas.length !== new Set(input.personaIds).size) {
    throw new ServiceError(409, 'invalid_state', 'Alguno de los perfiles elegidos ya no existe.');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({
        objective: input.objective,
        message: input.message,
        cta: input.cta,
        constraints: input.constraints ?? null,
        kpis: input.kpis ?? null,
        budgetCents: input.budgetCents ?? null,
        networks: input.networks,
        briefStatus: 'borrador',
        briefApprovedAt: null,
        // Si el brief cambia, una campaña activa vuelve a pausada hasta que se apruebe de nuevo.
        status: current.status === 'activa' ? 'pausada' : current.status,
      })
      .where(eq(campaigns.id, campaignId));
    await tx.delete(campaignPersonas).where(eq(campaignPersonas.campaignId, campaignId));
    await tx.insert(campaignPersonas).values([...new Set(input.personaIds)].map((personaId) => ({ campaignId, personaId })));
  });
  await audit(db, { actor, action: 'campaign.brief_updated', subjectType: 'campaign', subjectId: campaignId, detail: { networks: input.networks } });
  return findCampaignRow(db, campaignId);
}

/** Envía el brief a revisión. Exige lo mínimo para que el agente pueda trabajar. */
export async function requestBriefReview(db: Db, campaignId: string, actor: string) {
  const campaign = await findCampaignRow(db, campaignId);
  if (campaign.briefStatus !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo un brief en borrador va a revisión.');
  const personaIds = await campaignPersonaIds(db, campaignId);
  const missing = [
    !campaign.objective && 'objetivo',
    !campaign.message && 'mensaje',
    !campaign.cta && 'llamada a la acción',
    campaign.networks.length === 0 && 'redes',
    personaIds.length === 0 && 'perfiles',
  ].filter(Boolean);
  if (missing.length > 0) throw new ServiceError(409, 'invalid_state', `Faltan en el brief: ${missing.join(', ')}.`);
  const [updated] = await db.update(campaigns).set({ briefStatus: 'en_revision' }).where(eq(campaigns.id, campaignId)).returning();
  await audit(db, { actor, action: 'campaign.brief_review_requested', subjectType: 'campaign', subjectId: campaignId, detail: {} });
  return updated!;
}

/** Aprobación del brief: se hace desde Aprobaciones. Desde aquí el agente puede empezar a producir piezas. */
export async function approveBrief(db: Db, campaignId: string, actor: string) {
  const campaign = await findCampaignRow(db, campaignId);
  if (campaign.briefStatus !== 'en_revision') throw new ServiceError(409, 'invalid_state', 'Solo se aprueba un brief en revisión.');
  const [updated] = await db
    .update(campaigns)
    .set({ briefStatus: 'aprobado', briefApprovedAt: new Date() })
    .where(eq(campaigns.id, campaignId))
    .returning();
  await audit(db, { actor, action: 'campaign.brief_approved', subjectType: 'campaign', subjectId: campaignId, detail: {} });
  return updated!;
}

/** Crea una pieza para una red del brief. Solo con el brief aprobado. */
export async function createPiece(db: Db, campaignId: string, input: PieceCreate, actor: string) {
  const campaign = await findCampaignRow(db, campaignId);
  if (campaign.briefStatus !== 'aprobado') throw new ServiceError(409, 'invalid_state', 'Aprueba el brief antes de crear piezas.');
  if (!campaign.networks.includes(input.network)) {
    throw new ServiceError(409, 'invalid_state', `La campaña no incluye la red ${input.network}.`);
  }
  const [piece] = await db
    .insert(campaignPieces)
    .values({ campaignId, network: input.network, format: input.format, copy: input.copy, assetUrl: input.assetUrl ?? null, createdBy: actor })
    .returning();
  await audit(db, { actor, action: 'piece.created', subjectType: 'campaign_piece', subjectId: piece!.id, detail: { network: input.network, format: input.format } });
  return pieceDto(piece!);
}

/** Corrige una pieza en borrador o en revisión. Una aprobada no se edita. */
export async function updatePiece(db: Db, id: string, input: PieceUpdate, actor: string) {
  const current = await findPiece(db, id);
  if (current.status === 'aprobada' || current.status === 'publicada' || current.status === 'pausada') {
    throw new ServiceError(409, 'invalid_state', 'Una pieza aprobada no se edita. Crea una pieza nueva.');
  }
  const [updated] = await db
    .update(campaignPieces)
    .set({
      ...(input.format !== undefined ? { format: input.format } : {}),
      ...(input.copy !== undefined ? { copy: input.copy } : {}),
      ...(input.assetUrl !== undefined ? { assetUrl: input.assetUrl } : {}),
      status: 'borrador',
      updatedAt: new Date(),
    })
    .where(eq(campaignPieces.id, id))
    .returning();
  await audit(db, { actor, action: 'piece.updated', subjectType: 'campaign_piece', subjectId: id, detail: {} });
  return pieceDto(updated!);
}

export async function sendPieceToReview(db: Db, id: string, actor: string) {
  const piece = await findPiece(db, id);
  if (piece.status !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo una pieza en borrador va a revisión.');
  const [updated] = await db.update(campaignPieces).set({ status: 'en_revision', updatedAt: new Date() }).where(eq(campaignPieces.id, id)).returning();
  await audit(db, { actor, action: 'piece.review_requested', subjectType: 'campaign_piece', subjectId: id, detail: {} });
  return pieceDto(updated!);
}

/** Aprobación de la pieza: se hace desde Aprobaciones. Publicarla es un paso posterior del agente. */
export async function approvePiece(db: Db, id: string, actor: string) {
  const piece = await findPiece(db, id);
  if (piece.status !== 'en_revision') throw new ServiceError(409, 'invalid_state', 'Solo se aprueba una pieza en revisión.');
  const [updated] = await db.update(campaignPieces).set({ status: 'aprobada', updatedAt: new Date() }).where(eq(campaignPieces.id, id)).returning();
  await audit(db, { actor, action: 'piece.approved', subjectType: 'campaign_piece', subjectId: id, detail: { network: piece.network } });
  return pieceDto(updated!);
}

export async function discardPiece(db: Db, id: string, actor: string): Promise<void> {
  const piece = await findPiece(db, id);
  if (piece.status !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo se descarta una pieza en borrador.');
  await db.update(campaignPieces).set({ deletedAt: new Date() }).where(eq(campaignPieces.id, id));
  await audit(db, { actor, action: 'piece.discarded', subjectType: 'campaign_piece', subjectId: id, detail: {} });
}

/** Piezas en revisión y briefs en revisión, para la cola de Aprobaciones. */
export async function campaignsAwaitingApproval(db: Db) {
  const briefs = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(and(eq(campaigns.briefStatus, 'en_revision'), isNull(campaigns.deletedAt)));
  const pieces = await db
    .select({ id: campaignPieces.id, network: campaignPieces.network, format: campaignPieces.format, campaignName: campaigns.name })
    .from(campaignPieces)
    .innerJoin(campaigns, eq(campaignPieces.campaignId, campaigns.id))
    .where(and(eq(campaignPieces.status, 'en_revision'), isNull(campaignPieces.deletedAt)));
  return { briefs, pieces };
}
