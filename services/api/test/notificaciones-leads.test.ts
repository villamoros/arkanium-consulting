import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, buyerPersonas, campaignPersonas, campaignPieces, campaignChannels, campaigns, contacts, decisions, invoiceCreditNotes, invoiceLines, invoices, landingPages, leads, meetings, organizations, personaContacts, projects, proposalVersions, proposals } from '../src/db/schema.js';
import { createManualLead } from '../src/leads/service.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
const INTAKE = 'token-sitio-notificaciones';
const SECRET = 'secreto-n8n-de-prueba';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(campaignPieces);
  await db.delete(campaignPersonas);
  await db.delete(personaContacts);
  await db.delete(landingPages);
  await db.delete(invoiceCreditNotes);
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(campaignChannels);
  await db.delete(campaigns);
  await db.delete(buyerPersonas);
  await db.delete(organizations);
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, leadIntakeToken: INTAKE, internalSecret: SECRET });
});

const intake = {
  name: 'Ana Pérez',
  email: 'ana@empresa.test',
  priority: 'architecture',
  locale: 'es',
  source: 'website',
  consent: { accepted: true, textVersion: '2026-10-v1' },
};

async function capture(payload: object = intake) {
  return app.inject({ method: 'POST', url: '/leads', headers: { authorization: `Bearer ${INTAKE}` }, payload });
}

async function pending() {
  const response = await app.inject({ method: 'GET', url: '/internal/leads/pending-notification', headers: { 'x-arkanium-secret': SECRET } });
  expect(response.statusCode).toBe(200);
  return response.json().leads as Array<{ id: string; email: string; consentTextVersion: string; notifyAttempts: number }>;
}

describe('consentimiento del formulario', () => {
  it('sin consentimiento aceptado no se guarda el lead', async () => {
    const response = await capture({ ...intake, consent: { accepted: false, textVersion: '2026-10-v1' } });
    expect(response.statusCode).toBe(400);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it('el lead guarda la versión del texto y el momento en que se aceptó', async () => {
    const response = await capture();
    expect(response.statusCode).toBe(201);
    const [lead] = await db.select().from(leads).where(eq(leads.id, response.json().id));
    expect(lead).toMatchObject({ consentTextVersion: '2026-10-v1' });
    expect(lead!.consentAcceptedAt).toBeInstanceOf(Date);
  });
});

describe('cola de avisos para n8n', () => {
  it('un lead nuevo queda pendiente de aviso', async () => {
    await capture();
    const list = await pending();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'ana@empresa.test', consentTextVersion: '2026-10-v1', notifyAttempts: 0 });
  });

  it('los endpoints internos exigen el secreto', async () => {
    expect((await app.inject({ method: 'GET', url: '/internal/leads/pending-notification' })).statusCode).toBe(401);
    const id = (await capture()).json().id as string;
    expect((await app.inject({ method: 'POST', url: `/internal/leads/${id}/notified` })).statusCode).toBe(401);
  });

  it('marcar como avisado saca el lead de la cola; repetirlo no cambia nada', async () => {
    const id = (await capture()).json().id as string;
    const first = await app.inject({ method: 'POST', url: `/internal/leads/${id}/notified`, headers: { 'x-arkanium-secret': SECRET } });
    expect(first.statusCode).toBe(204);
    expect(await pending()).toHaveLength(0);

    const again = await app.inject({ method: 'POST', url: `/internal/leads/${id}/notified`, headers: { 'x-arkanium-secret': SECRET } });
    expect(again.statusCode).toBe(204);
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    expect(lead!.notifiedAt).toBeInstanceOf(Date);
  });

  it('un aviso fallido deja el lead pendiente y cuenta el intento', async () => {
    const id = (await capture()).json().id as string;
    await app.inject({
      method: 'POST',
      url: `/internal/leads/${id}/notify-failed`,
      headers: { 'x-arkanium-secret': SECRET },
      payload: { error: 'Resend respondió 503' },
    });
    const list = await pending();
    expect(list).toHaveLength(1);
    expect(list[0]!.notifyAttempts).toBe(1);
  });

  it('un lead creado a mano por el owner no entra en la cola', async () => {
    await createManualLead(db, { name: 'Luis Gómez', email: 'luis@ejemplo.test', priority: 'unsure', locale: 'es', source: 'referido' }, 'owner');
    expect(await pending()).toHaveLength(0);
  });
});

describe('límite de intentos de aviso', () => {
  it('un lead que agotó los intentos sale de la cola y queda atascado para revisión', async () => {
    const id = (await capture()).json().id as string;
    await db.update(leads).set({ notifyAttempts: 10, notifyLastError: 'correo: error de envío' }).where(eq(leads.id, id));
    expect(await pending()).toHaveLength(0);

    const detail = await app.inject({ method: 'GET', url: `/leads/${id}`, headers: { authorization: 'Bearer token-owner' } });
    expect(detail.json()).toMatchObject({ notifiedAt: null, notifyAttempts: 10, notifyLastError: 'correo: error de envío' });
  });
});
