import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, invoiceCreditNotes, invoiceLines, invoices, meetings, organizations, proposalVersions, proposals, projects } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let orgId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(invoiceCreditNotes);
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(organizations);
  const [org] = await db.insert(organizations).values({ name: 'Cliente actas', kind: 'client', clerkOrgId: CLIENT }).returning();
  orgId = org!.id;
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Reunión confirmada que ya empezó: el acta solo se puede crear después de la hora. */
async function pastMeeting(startsAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) {
  const [meeting] = await db
    .insert(meetings)
    .values({ organizationId: orgId, topic: 'Avance del diagnóstico', status: 'confirmada', requestedBy: 'token-client', startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) })
    .returning();
  return meeting!.id;
}

async function ownerView(id: string) {
  const list = await call('GET', '/meetings', 'token-owner');
  return list.json().meetings.find((m: { id: string }) => m.id === id);
}

describe('actas de reuniones finalizadas', () => {
  it('se crea el acta de una reunión que ya empezó y la ve el cliente', async () => {
    const id = await pastMeeting();
    const created = await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Acuerdos: cerrar la frontera.' });
    expect(created.statusCode).toBe(200);

    expect(await ownerView(id)).toMatchObject({ minutesPublished: true, minutesText: 'Acuerdos: cerrar la frontera.', status: 'realizada' });
    const forClient = await call('GET', `/organizations/${orgId}/meetings`, 'token-client');
    expect(forClient.json().meetings[0].minutesText).toBe('Acuerdos: cerrar la frontera.');
  });

  it('no se crea un acta dos veces ni antes de la hora de la reunión', async () => {
    const id = await pastMeeting();
    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Primera' });
    expect((await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Segunda' })).statusCode).toBe(409);

    const future = await pastMeeting(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
    expect((await call('POST', `/meetings/${future}/minutes`, 'token-owner', { text: 'Anticipada' })).statusCode).toBe(409);
  });

  it('el acta se edita y la bitácora guarda el texto anterior y el nuevo', async () => {
    const id = await pastMeeting();
    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Borrador inicial' });

    const edited = await call('PUT', `/meetings/${id}/minutes`, 'token-owner', { text: 'Acta corregida' });
    expect(edited.statusCode).toBe(200);
    expect(await ownerView(id)).toMatchObject({ minutesText: 'Acta corregida' });

    const history = await call('GET', `/meetings/${id}/minutes/history`, 'token-owner');
    const editedEntry = history.json().history.find((h: { action: string }) => h.action === 'minutes.edited');
    expect(editedEntry).toMatchObject({ previousText: 'Borrador inicial', text: 'Acta corregida' });
  });

  it('no se edita ni se elimina un acta que no existe', async () => {
    const id = await pastMeeting();
    expect((await call('PUT', `/meetings/${id}/minutes`, 'token-owner', { text: 'Nueva' })).statusCode).toBe(409);
    expect((await call('DELETE', `/meetings/${id}/minutes`, 'token-owner')).statusCode).toBe(409);
  });

  it('el acta se elimina: el cliente deja de verla, la reunión queda sin acta y el texto queda en la bitácora', async () => {
    const id = await pastMeeting();
    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Acuerdos importantes' });

    const deleted = await call('DELETE', `/meetings/${id}/minutes`, 'token-owner');
    expect(deleted.statusCode).toBe(204);

    expect(await ownerView(id)).toMatchObject({ minutesPublished: false, minutesText: null });
    const forClient = await call('GET', `/organizations/${orgId}/meetings`, 'token-client');
    expect(forClient.json().meetings[0].minutesText).toBeNull();

    const history = await call('GET', `/meetings/${id}/minutes/history`, 'token-owner');
    expect(history.json().history[0]).toMatchObject({ action: 'minutes.deleted', previousText: 'Acuerdos importantes' });

    // Tras eliminarla, la reunión vuelve a pedir acta y se puede crear una nueva.
    expect((await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Nueva acta' })).statusCode).toBe(200);
  });

  it('el historial muestra la creación, las ediciones y la eliminación, del más reciente al más antiguo', async () => {
    const id = await pastMeeting();
    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'v1' });
    await call('PUT', `/meetings/${id}/minutes`, 'token-owner', { text: 'v2' });
    await call('DELETE', `/meetings/${id}/minutes`, 'token-owner');

    const history = await call('GET', `/meetings/${id}/minutes/history`, 'token-owner');
    expect(history.json().history.map((h: { action: string }) => h.action)).toEqual(['minutes.deleted', 'minutes.edited', 'minutes.created']);
  });

  it('solo el owner gestiona actas y lee la bitácora', async () => {
    const id = await pastMeeting();
    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Acta' });
    expect((await call('PUT', `/meetings/${id}/minutes`, 'token-client', { text: 'Cambio' })).statusCode).toBe(403);
    expect((await call('DELETE', `/meetings/${id}/minutes`, 'token-client')).statusCode).toBe(403);
    expect((await call('GET', `/meetings/${id}/minutes/history`, 'token-client')).statusCode).toBe(403);
  });
});
