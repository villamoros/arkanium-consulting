/**
 * Registro de decisiones del cliente (app → Decisiones). Solo se agrega: nunca se edita una decisión.
 * Guarda el texto exacto que escribió la persona y, si aplica, la huella del documento.
 */
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { decisions } from '../db/schema.js';

export type Decision = typeof decisions.$inferSelect;

export async function recordDecision(
  db: Db,
  input: {
    organizationId: string;
    projectId?: string | null;
    kind: 'aprobacion_entregable' | 'correccion' | 'solicitud_reunion' | 'aceptacion_propuesta';
    subjectType: string;
    subjectId: string;
    text: string;
    actorId: string;
    actorRole: string;
    documentSha256?: string | null;
  },
): Promise<Decision> {
  const [row] = await db
    .insert(decisions)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      text: input.text,
      actorId: input.actorId,
      actorRole: input.actorRole,
      documentSha256: input.documentSha256 ?? null,
    })
    .returning();
  return row!;
}

export async function listDecisions(db: Db, organizationId: string): Promise<Decision[]> {
  return db.select().from(decisions).where(eq(decisions.organizationId, organizationId)).orderBy(desc(decisions.createdAt));
}
