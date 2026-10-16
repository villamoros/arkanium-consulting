import type { Db } from './db/client.js';
import { auditLog } from './db/schema.js';

/** Registra una acción en la bitácora (ARK-ARCH-002, C-07). Toda acción de personas o agentes pasa por aquí. */
export async function audit(
  db: Db,
  entry: { actor: string; action: string; subjectType: string; subjectId: string | null; detail?: Record<string, unknown> },
): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    detail: entry.detail ?? {},
  });
}
