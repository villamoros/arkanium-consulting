/**
 * Cola de aprobaciones de Core: todo lo que espera tu decisión, leído de los estados reales de cada módulo.
 * No hay una segunda fuente de verdad: cada elemento se aprueba con la acción que ya existe en su módulo.
 *   - Propuesta en aprobación → enviarla (se registra el envío).
 *   - Solicitud de reunión → agendarla (se confirma con fecha en Reuniones).
 *   - Reunión confirmada sin evento en Calendar → reintentar la creación del evento.
 *   - Reunión pasada sin acta publicada → publicar el acta.
 */
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { articles, invoices, leads, meetings, organizations, proposals } from '../db/schema.js';
import { campaignsAwaitingApproval } from '../marketing/briefs.js';

export type ApprovalKind = 'propuesta' | 'reunion' | 'factura' | 'articulo' | 'brief' | 'pieza';
export type ApprovalAction = 'enviar_propuesta' | 'agendar_reunion' | 'crear_evento' | 'publicar_acta' | 'emitir_factura' | 'publicar_articulo' | 'aprobar_brief' | 'aprobar_pieza';

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  subjectId: string;
  action: ApprovalAction;
  actionLabel: string;
  title: string;
  targetName: string | null;
  /** Módulo al que pertenece la acción, para saber dónde se resuelve. */
  module: 'Propuestas' | 'Reuniones' | 'Cobros y facturas' | 'Insights' | 'Campañas';
  /** Fecha que marca la urgencia (inicio de la reunión), si la hay. */
  dueAt: string | null;
  /** true cuando se puede aprobar desde la cola; si no, se resuelve en su módulo. */
  approvable: boolean;
}

const ACTION_LABEL: Record<ApprovalAction, string> = {
  enviar_propuesta: 'Enviar propuesta',
  agendar_reunion: 'Agendar reunión',
  crear_evento: 'Crear evento en Calendar',
  publicar_acta: 'Publicar acta',
  emitir_factura: 'Emitir factura',
  publicar_articulo: 'Publicar artículo',
  aprobar_brief: 'Aprobar brief de campaña',
  aprobar_pieza: 'Aprobar pieza publicitaria',
};

export async function approvalQueue(db: Db, now: Date = new Date()): Promise<ApprovalItem[]> {
  const items: ApprovalItem[] = [];

  const sending = await db
    .select({ proposal: proposals, orgName: organizations.name, leadName: leads.name })
    .from(proposals)
    .leftJoin(organizations, eq(proposals.organizationId, organizations.id))
    .leftJoin(leads, eq(proposals.leadId, leads.id))
    .where(eq(proposals.status, 'en_aprobacion'));
  for (const row of sending) {
    items.push({
      id: `propuesta:${row.proposal.id}`,
      kind: 'propuesta',
      subjectId: row.proposal.id,
      action: 'enviar_propuesta',
      actionLabel: ACTION_LABEL.enviar_propuesta,
      title: row.proposal.title,
      targetName: row.orgName ?? row.leadName ?? null,
      module: 'Propuestas',
      dueAt: null,
      approvable: true,
    });
  }

  const openMeetings = await db
    .select({ meeting: meetings, orgName: organizations.name, leadName: leads.name })
    .from(meetings)
    .leftJoin(organizations, eq(meetings.organizationId, organizations.id))
    .leftJoin(leads, eq(meetings.leadId, leads.id))
    .where(and(isNull(meetings.deletedAt), ne(meetings.status, 'rechazada'), ne(meetings.status, 'cancelada')))
    .orderBy(asc(meetings.startsAt));
  for (const row of openMeetings) {
    const meeting = row.meeting;
    const targetName = row.orgName ?? row.leadName ?? null;
    const base = { kind: 'reunion' as const, subjectId: meeting.id, title: meeting.topic, targetName, module: 'Reuniones' as const };

    if (meeting.status === 'solicitada') {
      items.push({ ...base, id: `reunion:${meeting.id}:agendar`, action: 'agendar_reunion', actionLabel: ACTION_LABEL.agendar_reunion, dueAt: null, approvable: false });
    } else if (meeting.status === 'confirmada' && meeting.startsAt && meeting.startsAt.getTime() > now.getTime()) {
      if (meeting.calendarStatus === 'pendiente' || meeting.calendarStatus === 'no_configurada') {
        items.push({ ...base, id: `reunion:${meeting.id}:evento`, action: 'crear_evento', actionLabel: ACTION_LABEL.crear_evento, dueAt: meeting.startsAt.toISOString(), approvable: true });
      }
    } else if ((meeting.status === 'confirmada' || meeting.status === 'realizada') && meeting.startsAt && meeting.startsAt.getTime() <= now.getTime() && !meeting.minutesPublishedAt) {
      items.push({ ...base, id: `reunion:${meeting.id}:acta`, action: 'publicar_acta', actionLabel: ACTION_LABEL.publicar_acta, dueAt: null, approvable: false });
    }
  }

  // Artículos de Insights listos para publicar: la publicación sale al sitio, así que pasa por tu decisión.
  const awaitingArticles = await db
    .select({ id: articles.id, title: articles.title, caseRef: articles.caseRef })
    .from(articles)
    .where(and(eq(articles.status, 'en_revision'), isNull(articles.deletedAt)));
  // Briefs y piezas de campaña en revisión: nada se produce ni se publica sin tu aprobación.
  const awaitingCampaigns = await campaignsAwaitingApproval(db);
  for (const brief of awaitingCampaigns.briefs) {
    items.push({
      id: `brief:${brief.id}`,
      kind: 'brief',
      subjectId: brief.id,
      action: 'aprobar_brief',
      actionLabel: ACTION_LABEL.aprobar_brief,
      title: `Brief · ${brief.name}`,
      targetName: brief.name,
      module: 'Campañas',
      dueAt: null,
      approvable: true,
    });
  }
  for (const piece of awaitingCampaigns.pieces) {
    items.push({
      id: `pieza:${piece.id}`,
      kind: 'pieza',
      subjectId: piece.id,
      action: 'aprobar_pieza',
      actionLabel: ACTION_LABEL.aprobar_pieza,
      title: `${piece.network} · ${piece.format}`,
      targetName: piece.campaignName,
      module: 'Campañas',
      dueAt: null,
      approvable: true,
    });
  }

  for (const article of awaitingArticles) {
    items.push({
      id: `articulo:${article.id}`,
      kind: 'articulo',
      subjectId: article.id,
      action: 'publicar_articulo',
      actionLabel: ACTION_LABEL.publicar_articulo,
      title: article.title,
      targetName: article.caseRef,
      module: 'Insights',
      dueAt: null,
      approvable: true,
    });
  }

  const drafts = await db
    .select({ invoice: invoices, orgName: organizations.name })
    .from(invoices)
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .where(and(eq(invoices.status, 'borrador'), isNull(invoices.deletedAt)));
  for (const row of drafts) {
    items.push({
      id: `factura:${row.invoice.id}`,
      kind: 'factura',
      subjectId: row.invoice.id,
      action: 'emitir_factura',
      actionLabel: ACTION_LABEL.emitir_factura,
      title: `${row.invoice.number} · ${row.invoice.concept}`,
      targetName: row.orgName,
      module: 'Cobros y facturas',
      dueAt: null,
      approvable: true,
    });
  }

  // Urgentes primero (con fecha), luego el resto en orden de creación.
  return items.sort((a, b) => (a.dueAt && b.dueAt ? a.dueAt.localeCompare(b.dueAt) : a.dueAt ? -1 : b.dueAt ? 1 : 0));
}
