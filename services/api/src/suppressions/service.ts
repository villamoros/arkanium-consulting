/**
 * Supresión: correos que no deben recibir contactos de Arkanium. Se consulta antes de invitar
 * a una reunión o de confirmarla. Solo el owner la administra y cada alta queda en la bitácora.
 */
import { desc, eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { suppressions } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import { normalizeEmail } from '../meetings/service.js';
import type { Suppression } from '@arkanium/contracts';

export async function listSuppressions(db: Db) {
  return db.select().from(suppressions).orderBy(desc(suppressions.createdAt));
}

export async function addSuppression(db: Db, input: Suppression, actor: string) {
  const email = normalizeEmail(input.email);
  const [existing] = await db.select({ id: suppressions.id }).from(suppressions).where(eq(suppressions.email, email));
  if (existing) throw new ServiceError(409, 'conflict', 'Ese correo ya está en la lista de supresión.');

  const [row] = await db.insert(suppressions).values({ email, reason: input.reason, createdBy: actor }).returning();
  await audit(db, { actor, action: 'suppression.added', subjectType: 'suppression', subjectId: row!.id, detail: { email } });
  return row!;
}
