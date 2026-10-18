/**
 * Mercadeo (Core): campañas, landing pages, buyer personas, contactos directos y artículos de Insights.
 *
 * Reglas:
 *  - Un contacto directo cuenta para el límite diario (10 en total, por día laboral de Bogotá).
 *  - Pasar a Leads crea un lead con el origen del perfil; el lead entra por la misma vía que cualquier otro.
 *  - Un artículo sale del sitio solo después de tu aprobación (Aprobaciones).
 *  - Nada de esto envía mensajes: los contactos se registran después de hacerse a mano.
 */
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { articles, buyerPersonas, campaignPersonas, campaignPieces, campaigns, landingPages, leads, personaContacts } from '../db/schema.js';
import { pieceDto } from './briefs.js';
import { ServiceError } from '../errors.js';
import { createManualLead } from '../leads/service.js';
import { DAILY_CONTACT_CAP, type ArticleCreate, type CampaignCreate, type LeadManual, type PersonaCreate } from '@arkanium/contracts';

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Inicio del día en Bogotá (UTC-5, sin horario de verano) para contar los contactos de hoy. */
export function bogotaDayStart(now: Date): Date {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BOGOTA_OFFSET_MS);
}

async function contactsSince(db: Db, since: Date): Promise<Array<{ personaId: string; total: number }>> {
  return db
    .select({ personaId: personaContacts.personaId, total: sql<number>`count(*)::int` })
    .from(personaContacts)
    .where(gte(personaContacts.occurredAt, since))
    .groupBy(personaContacts.personaId);
}

// ───────────── Campañas y landing pages ─────────────

export async function listCampaigns(db: Db) {
  const rows = await db.select().from(campaigns).where(isNull(campaigns.deletedAt)).orderBy(desc(campaigns.createdAt));
  const landings = await db.select().from(landingPages).orderBy(asc(landingPages.createdAt));
  const leadCounts = await db
    .select({ campaignId: leads.campaignId, total: sql<number>`count(*)::int` })
    .from(leads)
    .where(sql`${leads.campaignId} is not null`)
    .groupBy(leads.campaignId);
  const personaRows = await db.select().from(campaignPersonas);
  const pieceRows = await db
    .select()
    .from(campaignPieces)
    .where(isNull(campaignPieces.deletedAt))
    .orderBy(asc(campaignPieces.createdAt));
  return rows.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    service: campaign.service,
    status: campaign.status,
    objective: campaign.objective,
    message: campaign.message,
    cta: campaign.cta,
    constraints: campaign.constraints,
    kpis: campaign.kpis,
    budgetCents: campaign.budgetCents,
    networks: campaign.networks,
    briefStatus: campaign.briefStatus,
    personaIds: personaRows.filter((row) => row.campaignId === campaign.id).map((row) => row.personaId),
    pieces: pieceRows.filter((piece) => piece.campaignId === campaign.id).map(pieceDto),
    createdAt: campaign.createdAt.toISOString(),
    leads: leadCounts.find((count) => count.campaignId === campaign.id)?.total ?? 0,
    landings: landings.filter((landing) => landing.campaignId === campaign.id).map(landingDto),
  }));
}

function landingDto(landing: typeof landingPages.$inferSelect) {
  return { id: landing.id, title: landing.title, url: landing.url, campaignId: landing.campaignId };
}

/** Landing pages que todavía no pertenecen a ninguna campaña. */
export async function listUnassignedLandings(db: Db) {
  const rows = await db.select().from(landingPages).where(isNull(landingPages.campaignId)).orderBy(asc(landingPages.createdAt));
  return rows.map(landingDto);
}

export async function createCampaign(db: Db, input: CampaignCreate, actor: string) {
  const [campaign] = await db
    .insert(campaigns)
    .values({ name: input.name, service: input.service, buyerPersonaId: input.buyerPersonaId ?? null, status: input.status, createdBy: actor })
    .returning();
  await audit(db, { actor, action: 'campaign.created', subjectType: 'campaign', subjectId: campaign!.id, detail: { name: input.name } });
  return campaign!;
}

export async function updateCampaign(
  db: Db,
  id: string,
  input: { name?: string; service?: string; buyerPersonaId?: string | null; status?: CampaignCreate["status"] },
  actor: string,
) {
  const current = await findCampaign(db, id);
  // Una campaña no se activa sin brief aprobado: el agente no produce nada fuera de un brief aprobado.
  if (input.status === 'activa' && current.briefStatus !== 'aprobado') {
    throw new ServiceError(409, 'invalid_state', 'Aprueba el brief antes de activar la campaña.');
  }
  const values: Partial<typeof campaigns.$inferInsert> = {};
  if (input.name !== undefined) values.name = input.name;
  if (input.service !== undefined) values.service = input.service;
  if (input.buyerPersonaId !== undefined) values.buyerPersonaId = input.buyerPersonaId;
  if (input.status !== undefined) values.status = input.status;
  const [updated] = await db.update(campaigns).set(values).where(eq(campaigns.id, id)).returning();
  await audit(db, { actor, action: 'campaign.updated', subjectType: 'campaign', subjectId: id, detail: { from: current.status, to: updated!.status } });
  return updated!;
}

async function findCampaign(db: Db, id: string) {
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), isNull(campaigns.deletedAt)));
  if (!campaign) throw new ServiceError(404, 'not_found', 'Campaña no encontrada.');
  return campaign;
}

export async function createLanding(db: Db, input: { title: string; url?: string; campaignId?: string }, actor: string) {
  if (input.campaignId) await findCampaign(db, input.campaignId);
  const [landing] = await db
    .insert(landingPages)
    .values({ title: input.title, url: input.url ?? null, campaignId: input.campaignId ?? null })
    .returning();
  await audit(db, { actor, action: 'landing.created', subjectType: 'landing', subjectId: landing!.id, detail: { title: input.title } });
  return landingDto(landing!);
}

export async function updateLanding(db: Db, id: string, input: { title?: string; url?: string | null; campaignId?: string | null }, actor: string) {
  const [current] = await db.select().from(landingPages).where(eq(landingPages.id, id));
  if (!current) throw new ServiceError(404, 'not_found', 'Landing page no encontrada.');
  if (input.campaignId) await findCampaign(db, input.campaignId);
  const [updated] = await db
    .update(landingPages)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
    })
    .where(eq(landingPages.id, id))
    .returning();
  await audit(db, { actor, action: 'landing.updated', subjectType: 'landing', subjectId: id, detail: {} });
  return landingDto(updated!);
}

// ───────────── Buyer personas y contactos ─────────────

export async function listPersonas(db: Db, now: Date) {
  const rows = await db.select().from(buyerPersonas).where(isNull(buyerPersonas.deletedAt)).orderBy(asc(buyerPersonas.name));
  const today = await contactsSince(db, bogotaDayStart(now));
  const totalToday = today.reduce((sum, row) => sum + row.total, 0);
  return {
    cap: DAILY_CONTACT_CAP,
    totalToday,
    personas: rows.map((persona) => ({
      id: persona.id,
      name: persona.name,
      segment: persona.segment,
      service: persona.service,
      channel: persona.channel,
      note: persona.note,
      status: persona.status,
      contactsToday: today.find((row) => row.personaId === persona.id)?.total ?? 0,
    })),
  };
}

export async function createPersona(db: Db, input: PersonaCreate, actor: string) {
  const [persona] = await db
    .insert(buyerPersonas)
    .values({ name: input.name, segment: input.segment, service: input.service, channel: input.channel, note: input.note ?? null, createdBy: actor })
    .returning();
  await audit(db, { actor, action: 'persona.created', subjectType: 'buyer_persona', subjectId: persona!.id, detail: { name: input.name } });
  return persona!;
}

async function findPersona(db: Db, id: string) {
  const [persona] = await db.select().from(buyerPersonas).where(and(eq(buyerPersonas.id, id), isNull(buyerPersonas.deletedAt)));
  if (!persona) throw new ServiceError(404, 'not_found', 'Perfil no encontrado.');
  return persona;
}

export async function updatePersona(
  db: Db,
  id: string,
  input: { name?: string; segment?: string; service?: string; channel?: PersonaCreate['channel']; note?: string | null; status?: 'activo' | 'pausado' },
  actor: string,
) {
  const current = await findPersona(db, id);
  const [updated] = await db
    .update(buyerPersonas)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.segment !== undefined ? { segment: input.segment } : {}),
      ...(input.service !== undefined ? { service: input.service } : {}),
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .where(eq(buyerPersonas.id, id))
    .returning();
  const action = input.status && input.status !== current.status ? (input.status === 'pausado' ? 'persona.paused' : 'persona.resumed') : 'persona.updated';
  await audit(db, { actor, action, subjectType: 'buyer_persona', subjectId: id, detail: {} });
  return updated!;
}

/** Borrado lógico: el perfil deja de aparecer; sus contactos se conservan en la bitácora. */
export async function deletePersona(db: Db, id: string, actor: string): Promise<void> {
  await findPersona(db, id);
  await db.update(buyerPersonas).set({ deletedAt: new Date() }).where(eq(buyerPersonas.id, id));
  await audit(db, { actor, action: 'persona.deleted', subjectType: 'buyer_persona', subjectId: id, detail: {} });
}

export async function listContacts(db: Db, personaId: string) {
  await findPersona(db, personaId);
  const rows = await db
    .select()
    .from(personaContacts)
    .where(eq(personaContacts.personaId, personaId))
    .orderBy(desc(personaContacts.occurredAt));
  return rows.map((row) => ({ id: row.id, channel: row.channel, note: row.note, occurredAt: row.occurredAt.toISOString(), actor: row.actor }));
}

/** Registra un contacto directo. Respeta el límite diario y no contacta a perfiles en pausa. */
export async function addContact(db: Db, personaId: string, input: { channel: string; note: string }, actor: string, now: Date) {
  const persona = await findPersona(db, personaId);
  if (persona.status === 'pausado') throw new ServiceError(409, 'invalid_state', 'Este perfil está en pausa. No se registran contactos.');
  const [today] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(personaContacts)
    .where(gte(personaContacts.occurredAt, bogotaDayStart(now)));
  if ((today?.total ?? 0) >= DAILY_CONTACT_CAP) {
    throw new ServiceError(409, 'invalid_state', `Límite diario alcanzado (${DAILY_CONTACT_CAP} contactos). Los contactos se reanudan mañana.`);
  }
  const [contact] = await db
    .insert(personaContacts)
    .values({ personaId, channel: input.channel, note: input.note, actor })
    .returning();
  await audit(db, { actor, action: 'persona.contacted', subjectType: 'buyer_persona', subjectId: personaId, detail: { channel: input.channel } });
  return contact!;
}

/** Pasa un perfil a Leads: crea el lead con el origen del perfil y lo deja vinculado a él. */
export async function convertPersona(db: Db, personaId: string, input: { name: string; email: string; company?: string }, actor: string) {
  const persona = await findPersona(db, personaId);
  if (persona.status === 'pausado') throw new ServiceError(409, 'invalid_state', 'Este perfil está en pausa. Reanúdalo antes de pasarlo a Leads.');
  const lead = await createManualLead(
    db,
    {
      name: input.name,
      email: input.email,
      company: input.company,
      priority: 'unsure',
      locale: 'es',
      // El canal del perfil se valida al crearlo con la misma lista de orígenes de leads.
      source: persona.channel as LeadManual['source'],
      sourceReference: persona.name,
    },
    actor,
  );
  await db.update(leads).set({ buyerPersonaId: persona.id }).where(eq(leads.id, lead.id));
  await audit(db, { actor, action: 'persona.converted', subjectType: 'buyer_persona', subjectId: personaId, detail: { leadId: lead.id } });
  return { leadId: lead.id };
}

// ───────────── Insights (artículos) ─────────────

export async function listArticles(db: Db) {
  const rows = await db.select().from(articles).where(isNull(articles.deletedAt)).orderBy(desc(articles.updatedAt));
  return rows.map(articleDto);
}

function articleDto(article: typeof articles.$inferSelect) {
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    caseRef: article.caseRef,
    langs: article.langs,
    content: article.content,
    status: article.status,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    updatedAt: article.updatedAt.toISOString(),
  };
}

/** Un artículo con todo su contenido, para el editor. */
export async function getArticle(db: Db, id: string) {
  return articleDto(await findArticle(db, id));
}

/** Cierto si el cuerpo tiene algún texto escrito. Un cuerpo vacío no se revisa ni se publica. */
export function bodyHasText(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const record = node as { type?: string; text?: unknown; content?: unknown };
  if (record.type === 'text' && typeof record.text === 'string' && record.text.trim().length > 0) return true;
  return Array.isArray(record.content) && record.content.some(bodyHasText);
}

async function findArticle(db: Db, id: string) {
  const [article] = await db.select().from(articles).where(and(eq(articles.id, id), isNull(articles.deletedAt)));
  if (!article) throw new ServiceError(404, 'not_found', 'Artículo no encontrado.');
  return article;
}

export async function createArticle(db: Db, input: ArticleCreate, actor: string) {
  const [article] = await db
    .insert(articles)
    .values({ title: input.title, excerpt: input.excerpt ?? null, caseRef: input.caseRef ?? null, langs: input.langs, createdBy: actor })
    .returning();
  await audit(db, { actor, action: 'article.created', subjectType: 'article', subjectId: article!.id, detail: { title: input.title } });
  return articleDto(article!);
}

export async function updateArticle(
  db: Db,
  id: string,
  input: {
    title?: string;
    excerpt?: string | null;
    caseRef?: string | null;
    langs?: string[];
    content?: Record<string, { title: string; subtitle?: string; body: Record<string, unknown> }>;
  },
  actor: string,
) {
  const current = await findArticle(db, id);
  if (current.status === 'publicado') throw new ServiceError(409, 'invalid_state', 'Un artículo publicado no se edita. Crea una versión nueva.');

  // Escribir en un idioma nuevo lo añade a los idiomas del artículo.
  const contentLangs = input.content ? Object.keys(input.content) : [];
  const langs = input.langs !== undefined || contentLangs.length > 0 ? [...new Set([...(input.langs ?? current.langs), ...contentLangs])] : undefined;
  const content = input.content ? { ...current.content, ...input.content } : undefined;
  // El título de la lista es el del idioma principal (español) cuando existe.
  const title = input.title ?? content?.es?.title ?? undefined;

  const [updated] = await db
    .update(articles)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.caseRef !== undefined ? { caseRef: input.caseRef } : {}),
      ...(langs !== undefined ? { langs } : {}),
      ...(content !== undefined ? { content } : {}),
      // Si cambia algo de una revisión, vuelve a borrador: la revisión anterior ya no aplica.
      status: 'borrador',
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
    .returning();
  await audit(db, { actor, action: 'article.updated', subjectType: 'article', subjectId: id, detail: { langs: contentLangs } });
  return articleDto(updated!);
}

/** Lo manda a revisión. Un artículo sin resumen, sin caso o sin título no sale. */
export async function sendArticleToReview(db: Db, id: string, actor: string) {
  const article = await findArticle(db, id);
  if (article.status !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo un borrador va a revisión.');
  if (!article.excerpt || !article.caseRef) {
    throw new ServiceError(409, 'invalid_state', 'Antes de revisarlo, el artículo necesita resumen y caso relacionado.');
  }
  // Cada idioma del artículo necesita título y cuerpo escrito.
  const missing = article.langs.filter((lang) => {
    const entry = article.content[lang];
    return !entry?.title || !bodyHasText(entry.body);
  });
  if (missing.length > 0) {
    throw new ServiceError(409, 'invalid_state', `Falta el contenido en ${missing.map((lang) => lang.toUpperCase()).join(', ')}.`);
  }
  const [updated] = await db.update(articles).set({ status: 'en_revision', updatedAt: new Date() }).where(eq(articles.id, id)).returning();
  await audit(db, { actor, action: 'article.review_requested', subjectType: 'article', subjectId: id, detail: {} });
  return articleDto(updated!);
}

/** Publicación: solo desde revisión. La llama la aprobación del owner en Aprobaciones. */
export async function publishArticle(db: Db, id: string, actor: string) {
  const article = await findArticle(db, id);
  if (article.status !== 'en_revision') throw new ServiceError(409, 'invalid_state', 'Solo se publica un artículo en revisión.');
  const [updated] = await db
    .update(articles)
    .set({ status: 'publicado', publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(articles.id, id))
    .returning();
  await audit(db, { actor, action: 'article.published', subjectType: 'article', subjectId: id, detail: {} });
  return articleDto(updated!);
}

/** Descarta un borrador. Borrado lógico. */
export async function discardArticle(db: Db, id: string, actor: string): Promise<void> {
  const article = await findArticle(db, id);
  if (article.status !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo se descarta un borrador.');
  await db.update(articles).set({ deletedAt: new Date() }).where(eq(articles.id, id));
  await audit(db, { actor, action: 'article.discarded', subjectType: 'article', subjectId: id, detail: {} });
}

/** Artículos en revisión, para la cola de Aprobaciones. */
export async function articlesAwaitingApproval(db: Db) {
  return db
    .select({ id: articles.id, title: articles.title, caseRef: articles.caseRef })
    .from(articles)
    .where(and(eq(articles.status, 'en_revision'), isNull(articles.deletedAt)));
}

