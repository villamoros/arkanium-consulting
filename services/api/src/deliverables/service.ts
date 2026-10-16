/**
 * F-08 y A-02/A-03: entregables. El owner sube y publica. El cliente descarga, deja correcciones
 * y, si es administrador, aprueba. Cada aprobación y cada corrección quedan en el registro de decisiones.
 */
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { corrections, deliverables, projects } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import { recordDecision } from '../decisions/service.js';
import type { DeliverableContent } from '@arkanium/contracts';

export type Deliverable = typeof deliverables.$inferSelect;
export type Correction = typeof corrections.$inferSelect;

/** Estados que el cliente puede descargar: ya fueron publicados por Arkanium. */
export const downloadableStatuses = ['publicado', 'con_correcciones', 'aprobado'] as const;

export async function findDeliverable(db: Db, id: string): Promise<Deliverable> {
  const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, id));
  if (!deliverable) throw new ServiceError(404, 'not_found', 'Entregable no encontrado.');
  return deliverable;
}

/** Organización dueña de un entregable, a través de su proyecto. */
export async function organizationOfDeliverable(db: Db, deliverable: Deliverable): Promise<string> {
  const [project] = await db.select().from(projects).where(eq(projects.id, deliverable.projectId));
  return project!.organizationId;
}

export async function createDeliverable(db: Db, projectId: string, title: string, actor: string): Promise<Deliverable> {
  const [deliverable] = await db.insert(deliverables).values({ projectId, title }).returning();
  await audit(db, { actor, action: 'deliverable.created', subjectType: 'deliverable', subjectId: deliverable!.id, detail: { projectId } });
  return deliverable!;
}

/** El owner sube o reemplaza el archivo mientras el entregable no esté publicado. */
export async function uploadContent(db: Db, id: string, input: DeliverableContent, actor: string): Promise<Deliverable> {
  const current = await findDeliverable(db, id);
  if (current.status !== 'en_revision' && current.status !== 'con_correcciones') {
    throw new ServiceError(409, 'invalid_state', 'Solo se puede cambiar el archivo antes de publicarlo.');
  }
  const content = Buffer.from(input.contentBase64, 'base64');
  if (content.length === 0) throw new ServiceError(400, 'invalid', 'El archivo está vacío.');
  if (content.length > 5 * 1024 * 1024) throw new ServiceError(400, 'invalid', 'El archivo supera 5 MB.');

  const [updated] = await db
    .update(deliverables)
    .set({
      content,
      fileName: input.fileName,
      mimeType: input.mimeType,
      contentSha256: createHash('sha256').update(content).digest('hex'),
      version: current.version + (current.content ? 1 : 0),
      status: 'en_revision',
    })
    .where(eq(deliverables.id, id))
    .returning();
  await audit(db, { actor, action: 'deliverable.content_uploaded', subjectType: 'deliverable', subjectId: id, detail: { fileName: input.fileName, bytes: content.length } });
  return updated!;
}

/** F-08: el owner publica. Sin archivo no se puede publicar. */
export async function publishDeliverable(db: Db, id: string, actor: string): Promise<Deliverable> {
  const current = await findDeliverable(db, id);
  if (current.status !== 'en_revision') throw new ServiceError(409, 'invalid_state', 'Este entregable ya está publicado.');
  if (!current.content) throw new ServiceError(409, 'invalid_state', 'Primero sube el archivo del entregable.');

  const [updated] = await db
    .update(deliverables)
    .set({ status: 'publicado', publishedAt: new Date() })
    .where(eq(deliverables.id, id))
    .returning();
  await audit(db, { actor, action: 'deliverable.published', subjectType: 'deliverable', subjectId: id, detail: { version: updated!.version } });
  return updated!;
}

/** Archivo para el cliente. Solo después de la publicación, y cada descarga queda en la bitácora. */
export async function clientFile(db: Db, deliverable: Deliverable, actorId: string) {
  if (!downloadableStatuses.includes(deliverable.status as (typeof downloadableStatuses)[number]) || !deliverable.content) {
    throw new ServiceError(409, 'invalid_state', 'Este entregable todavía no está disponible para descargar.');
  }
  await audit(db, { actor: actorId, action: 'deliverable.downloaded', subjectType: 'deliverable', subjectId: deliverable.id, detail: { version: deliverable.version } });
  return {
    fileName: deliverable.fileName ?? 'entregable',
    mimeType: deliverable.mimeType ?? 'application/octet-stream',
    content: deliverable.content,
    sha256: deliverable.contentSha256 ?? '',
  };
}

/** A-03: el cliente deja una corrección. El entregable pasa a «con correcciones» y no cambia solo. */
export async function addCorrection(db: Db, deliverable: Deliverable, organizationId: string, text: string, actor: { id: string; role: string }): Promise<Correction> {
  if (deliverable.status !== 'publicado' && deliverable.status !== 'con_correcciones') {
    throw new ServiceError(409, 'invalid_state', 'Solo se puede corregir un entregable publicado.');
  }
  const [correction] = await db
    .insert(corrections)
    .values({ deliverableId: deliverable.id, authorId: actor.id, text })
    .returning();
  await db.update(deliverables).set({ status: 'con_correcciones' }).where(eq(deliverables.id, deliverable.id));
  await recordDecision(db, {
    organizationId,
    projectId: deliverable.projectId,
    kind: 'correccion',
    subjectType: 'deliverable',
    subjectId: deliverable.id,
    text,
    actorId: actor.id,
    actorRole: actor.role,
    documentSha256: deliverable.contentSha256,
  });
  await audit(db, { actor: actor.id, action: 'correction.created', subjectType: 'deliverable', subjectId: deliverable.id, detail: { correctionId: correction!.id } });
  return correction!;
}

/** El owner atiende una corrección. Si no quedan abiertas, el entregable vuelve a revisión interna. */
export async function resolveCorrection(db: Db, correctionId: string, note: string, actor: string): Promise<Correction> {
  const [current] = await db.select().from(corrections).where(eq(corrections.id, correctionId));
  if (!current) throw new ServiceError(404, 'not_found', 'Corrección no encontrada.');
  if (current.status === 'resuelta') throw new ServiceError(409, 'invalid_state', 'La corrección ya está resuelta.');

  const [updated] = await db
    .update(corrections)
    .set({ status: 'resuelta', resolutionNote: note, resolvedAt: new Date() })
    .where(eq(corrections.id, correctionId))
    .returning();

  const open = await db
    .select({ id: corrections.id })
    .from(corrections)
    .where(and(eq(corrections.deliverableId, current.deliverableId), eq(corrections.status, 'abierta')));
  if (open.length === 0) {
    await db.update(deliverables).set({ status: 'en_revision' }).where(eq(deliverables.id, current.deliverableId));
  }
  await audit(db, { actor, action: 'correction.resolved', subjectType: 'correction', subjectId: correctionId, detail: { note } });
  return updated!;
}

/** A-02: el administrador del cliente aprueba con su texto exacto. Queda en el registro de decisiones. */
export async function approveByClient(db: Db, deliverable: Deliverable, organizationId: string, text: string, actor: { id: string; role: string }): Promise<Deliverable> {
  if (deliverable.status !== 'publicado') {
    throw new ServiceError(409, 'invalid_state', 'Solo se aprueba un entregable publicado sin correcciones abiertas.');
  }
  const [updated] = await db
    .update(deliverables)
    .set({ status: 'aprobado', approvedAt: new Date() })
    .where(eq(deliverables.id, deliverable.id))
    .returning();
  await recordDecision(db, {
    organizationId,
    projectId: deliverable.projectId,
    kind: 'aprobacion_entregable',
    subjectType: 'deliverable',
    subjectId: deliverable.id,
    text,
    actorId: actor.id,
    actorRole: actor.role,
    documentSha256: deliverable.contentSha256,
  });
  await audit(db, { actor: actor.id, action: 'deliverable.approved_by_client', subjectType: 'deliverable', subjectId: deliverable.id, detail: { version: deliverable.version } });
  return updated!;
}

export async function listDeliverables(db: Db, projectId: string): Promise<Deliverable[]> {
  return db.select().from(deliverables).where(eq(deliverables.projectId, projectId)).orderBy(asc(deliverables.createdAt));
}

export async function listOpenCorrections(db: Db, deliverableIds: string[]): Promise<Correction[]> {
  if (deliverableIds.length === 0) return [];
  return db
    .select()
    .from(corrections)
    .where(and(inArray(corrections.deliverableId, deliverableIds), eq(corrections.status, 'abierta')));
}
