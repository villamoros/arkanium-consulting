import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, buyerPersonas, campaignChannels, campaignPersonas, campaignPieces, campaigns, invoiceCreditNotes, invoiceLines, invoices, landingPages, leads, meetings, organizations, personaContacts, projects, proposalVersions, proposals, contacts, decisions } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(personaContacts);
  await db.delete(campaignPieces);
  await db.delete(campaignChannels);
  await db.delete(campaignPersonas);
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
  await db.delete(campaigns);
  await db.delete(buyerPersonas);
  await db.delete(organizations);
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Campaña con brief aprobado en redes sociales (linkedin y x), sin canales extra. */
async function approvedCampaign() {
  const persona = (await call('POST', '/buyer-personas', 'token-owner', { name: 'Director', segment: 'Manufactura', service: 'Diagnóstico', channel: 'linkedin' })).json().id as string;
  const campaign = (await call('POST', '/campaigns', 'token-owner', { name: 'Modernización ERP', service: 'Diagnóstico' })).json().id as string;
  const saved = await call('PUT', `/campaigns/${campaign}/brief`, 'token-owner', {
    objective: 'reuniones',
    message: 'Un diagnóstico antes de tocar el ERP.',
    cta: 'Agenda 20 minutos',
    networks: ['linkedin', 'x'],
    personaIds: [persona],
  });
  expect(saved.statusCode).toBe(200);
  expect((await call('POST', `/campaigns/${campaign}/brief/review`, 'token-owner')).statusCode).toBe(200);
  expect((await call('POST', `/campaigns/${campaign}/brief/approve`, 'token-owner')).statusCode).toBe(200);
  return campaign;
}

const newsletter = { kind: 'newsletter', platform: 'Resend', budgetCents: 0, startsOn: '2026-11-01', endsOn: '2026-12-31' };

describe('canales de campaña', () => {
  it('crea un canal newsletter con presupuesto y fechas, y lo lista con la campaña', async () => {
    const campaign = await approvedCampaign();
    const created = await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ kind: 'newsletter', platform: 'Resend', budgetCents: 0, startsOn: '2026-11-01', endsOn: '2026-12-31' });

    const list = await call('GET', '/campaigns', 'token-owner');
    expect(list.json().campaigns[0].channels).toEqual([expect.objectContaining({ kind: 'newsletter', platform: 'Resend' })]);
  });

  it('no acepta un fin anterior al inicio', async () => {
    const campaign = await approvedCampaign();
    const response = await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', { ...newsletter, startsOn: '2026-12-01', endsOn: '2026-11-01' });
    expect(response.statusCode).toBe(400);
    expect(await db.select().from(campaignChannels)).toHaveLength(0);
  });

  it('una campaña cerrada no recibe canales nuevos', async () => {
    const campaign = await approvedCampaign();
    await call('PATCH', `/campaigns/${campaign}`, 'token-owner', { status: 'cerrada' });
    const response = await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter);
    expect(response.statusCode).toBe(409);
  });

  it('solo el owner crea y quita canales', async () => {
    const campaign = await approvedCampaign();
    expect((await call('POST', `/campaigns/${campaign}/channels`, 'token-client', newsletter)).statusCode).toBe(403);
  });

  it('registra la creación y la baja del canal en la bitácora', async () => {
    const campaign = await approvedCampaign();
    const channel = (await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter)).json().id as string;
    await call('DELETE', `/campaign-channels/${channel}`, 'token-owner');
    const actions = (await db.select().from(auditLog)).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['channel.created', 'channel.removed']));
  });
});

describe('piezas de newsletter', () => {
  it('no crea una pieza de newsletter sin canal newsletter', async () => {
    const campaign = await approvedCampaign();
    const response = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'newsletter', format: 'texto', copy: 'Edición de noviembre' });
    expect(response.statusCode).toBe(409);
  });

  it('crea la pieza de newsletter cuando la campaña tiene el canal', async () => {
    const campaign = await approvedCampaign();
    await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter);
    const response = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'newsletter', format: 'texto', copy: 'Edición de noviembre' });
    expect(response.statusCode).toBe(201);
  });

  it('una red social sigue exigiendo que esté en el brief', async () => {
    const campaign = await approvedCampaign();
    await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter);
    const response = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'instagram', format: 'imagen', copy: 'Texto' });
    expect(response.statusCode).toBe(409);
  });

  it('no quita un canal newsletter con piezas vivas; sí lo deja quitar cuando se descartan', async () => {
    const campaign = await approvedCampaign();
    const channel = (await call('POST', `/campaigns/${campaign}/channels`, 'token-owner', newsletter)).json().id as string;
    const piece = (await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'newsletter', format: 'texto', copy: 'Edición de noviembre' })).json().id as string;

    expect((await call('DELETE', `/campaign-channels/${channel}`, 'token-owner')).statusCode).toBe(409);

    expect((await call('DELETE', `/campaign-pieces/${piece}`, 'token-owner')).statusCode).toBe(204);
    expect((await call('DELETE', `/campaign-channels/${channel}`, 'token-owner')).statusCode).toBe(204);
  });
});
