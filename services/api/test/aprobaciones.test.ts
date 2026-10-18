import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, meetings, organizations, proposalVersions, proposals } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let orgId: string;

const DAY = 24 * 60 * 60_000;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(contacts);
  await db.delete(organizations);
  const [org] = await db.insert(organizations).values({ name: 'Cliente cola', kind: 'client', clerkOrgId: CLIENT }).returning();
  orgId = org!.id;
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function queue() {
  const response = await app.inject({ method: 'GET', url: '/approvals', headers: { authorization: 'Bearer token-owner' } });
  expect(response.statusCode).toBe(200);
  return response.json().approvals as Array<{ action: string; approvable: boolean; dueAt: string | null; targetName: string | null }>;
}

async function meeting(values: Partial<typeof meetings.$inferInsert>) {
  const [row] = await db
    .insert(meetings)
    .values({ organizationId: orgId, topic: 'Reunión', requestedBy: 'user', preferredWindows: [], status: 'solicitada', ...values })
    .returning();
  return row!;
}

describe('cola de aprobaciones', () => {
  it('incluye propuestas enviadas a aprobación, pero no los borradores', async () => {
    await db.insert(proposals).values({ organizationId: orgId, title: 'En aprobación', templateCode: 'PL-03', status: 'en_aprobacion', currentVersion: 1 });
    await db.insert(proposals).values({ organizationId: orgId, title: 'Borrador', templateCode: 'PL-03', status: 'borrador', currentVersion: 1 });
    const items = await queue();
    expect(items.map((i) => i.action)).toEqual(['enviar_propuesta']);
    expect(items[0]).toMatchObject({ approvable: true, targetName: 'Cliente cola' });
  });

  it('una solicitud de reunión espera agendarse, en Reuniones y no se aprueba desde la cola', async () => {
    await meeting({ topic: 'Avance pedido', status: 'solicitada' });
    const items = await queue();
    expect(items).toEqual([expect.objectContaining({ action: 'agendar_reunion', approvable: false })]);
  });

  it('una reunión confirmada sin evento en Calendar se puede crear desde la cola, ordenada por fecha', async () => {
    await meeting({ topic: 'Sin evento', status: 'confirmada', startsAt: new Date(Date.now() + 2 * DAY), calendarStatus: 'pendiente' });
    await meeting({ topic: 'Con evento', status: 'confirmada', startsAt: new Date(Date.now() + 3 * DAY), calendarStatus: 'sincronizada', calendarEventId: 'evt_1' });
    const items = await queue();
    expect(items).toEqual([expect.objectContaining({ action: 'crear_evento', approvable: true, dueAt: expect.any(String) })]);
  });

  it('una reunión pasada sin acta pide publicarla; con acta ya no aparece', async () => {
    const past = await meeting({ topic: 'Pasada', status: 'confirmada', startsAt: new Date(Date.now() - DAY), calendarStatus: 'sincronizada', calendarEventId: 'evt_2' });
    expect((await queue()).map((i) => i.action)).toEqual(['publicar_acta']);

    await db.update(meetings).set({ minutesPublishedAt: new Date(), minutesText: 'Acta', status: 'realizada' }).where((await import('drizzle-orm')).eq(meetings.id, past.id));
    expect(await queue()).toEqual([]);
  });

  it('las reuniones eliminadas, rechazadas o canceladas no aparecen', async () => {
    await meeting({ topic: 'Eliminada', status: 'solicitada', deletedAt: new Date() });
    await meeting({ topic: 'Rechazada', status: 'rechazada' });
    await meeting({ topic: 'Cancelada', status: 'cancelada' });
    expect(await queue()).toEqual([]);
  });

  it('solo el owner ve la cola', async () => {
    const response = await app.inject({ method: 'GET', url: '/approvals', headers: { authorization: 'Bearer token-client' } });
    expect(response.statusCode).toBe(403);
  });
});
