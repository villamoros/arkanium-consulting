import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, buyerPersonas, campaignPersonas, campaignPieces, campaigns, contacts, decisions, invoiceCreditNotes, invoiceLines, invoices, landingPages, leads, meetings, organizations, personaContacts, projects, proposalVersions, proposals } from '../src/db/schema.js';
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

/** Campaña con dos perfiles y un brief completo, listo para revisar. */
async function campaignWithBrief() {
  const persona = (name: string) =>
    call('POST', '/buyer-personas', 'token-owner', { name, segment: 'Manufactura', service: 'Diagnóstico', channel: 'linkedin' });
  const first = (await persona('Director de operaciones')).json().id as string;
  const second = (await persona('Gerente de TI')).json().id as string;
  const campaign = (await call('POST', '/campaigns', 'token-owner', { name: 'Modernización ERP', service: 'Diagnóstico' })).json().id as string;
  const brief = {
    objective: 'reuniones',
    message: 'Un diagnóstico antes de tocar el ERP.',
    cta: 'Agenda 20 minutos',
    networks: ['linkedin', 'x'],
    personaIds: [first, second],
    budgetCents: 150000,
  };
  const saved = await call('PUT', `/campaigns/${campaign}/brief`, 'token-owner', brief);
  expect(saved.statusCode).toBe(200);
  return { campaign, first, second };
}

async function approvedBrief() {
  const { campaign, first, second } = await campaignWithBrief();
  expect((await call('POST', `/campaigns/${campaign}/brief/review`, 'token-owner')).statusCode).toBe(200);
  expect((await call('POST', `/campaigns/${campaign}/brief/approve`, 'token-owner')).statusCode).toBe(200);
  return { campaign, first, second };
}

describe('brief de campaña', () => {
  it('el brief guarda los perfiles y las redes, y la lista de campañas los muestra', async () => {
    const { campaign, first, second } = await campaignWithBrief();
    const list = await call('GET', '/campaigns', 'token-owner');
    const found = list.json().campaigns.find((c: { id: string }) => c.id === campaign);
    expect(found).toMatchObject({ briefStatus: 'borrador', networks: ['linkedin', 'x'], objective: 'reuniones' });
    expect(found.personaIds.sort()).toEqual([first, second].sort());
  });

  it('un perfil que ya no existe impide guardar el brief', async () => {
    const { campaign } = await campaignWithBrief();
    const response = await call('PUT', `/campaigns/${campaign}/brief`, 'token-owner', {
      objective: 'leads',
      message: 'Mensaje',
      cta: 'Escríbenos',
      networks: ['linkedin'],
      personaIds: ['00000000-0000-4000-8000-000000000000'],
    });
    expect(response.statusCode).toBe(409);
  });

  it('una campaña no se activa sin brief aprobado; con el brief aprobado sí', async () => {
    const { campaign } = await campaignWithBrief();
    expect((await call('PATCH', `/campaigns/${campaign}`, 'token-owner', { status: 'activa' })).statusCode).toBe(409);

    await call('POST', `/campaigns/${campaign}/brief/review`, 'token-owner');
    await call('POST', `/campaigns/${campaign}/brief/approve`, 'token-owner');
    expect((await call('PATCH', `/campaigns/${campaign}`, 'token-owner', { status: 'activa' })).json().status).toBe('activa');
  });

  it('cambiar un brief aprobado lo devuelve a borrador y pausa la campaña activa', async () => {
    const { campaign } = await approvedBrief();
    await call('PATCH', `/campaigns/${campaign}`, 'token-owner', { status: 'activa' });
    await call('PUT', `/campaigns/${campaign}/brief`, 'token-owner', {
      objective: 'leads',
      message: 'Nuevo mensaje',
      cta: 'Descarga la guía',
      networks: ['linkedin'],
      personaIds: [(await db.select({ id: buyerPersonas.id }).from(buyerPersonas))[0]!.id],
    });
    const list = await call('GET', '/campaigns', 'token-owner');
    expect(list.json().campaigns[0]).toMatchObject({ briefStatus: 'borrador', status: 'pausada' });
  });
});

describe('piezas por red', () => {
  it('no se crean piezas antes de aprobar el brief', async () => {
    const { campaign } = await campaignWithBrief();
    const response = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'linkedin', format: 'texto', copy: 'Texto' });
    expect(response.statusCode).toBe(409);
  });

  it('solo se crean piezas para las redes del brief', async () => {
    const { campaign } = await approvedBrief();
    const refused = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'tiktok', format: 'video', copy: 'Texto' });
    expect(refused.statusCode).toBe(409);
    const created = await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'linkedin', format: 'texto', copy: 'Texto' });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe('borrador');
  });

  it('una pieza pasa por revisión y aprobación en Aprobaciones; una aprobada no se edita', async () => {
    const { campaign } = await approvedBrief();
    const piece = (await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'linkedin', format: 'imagen', copy: 'Texto' })).json().id as string;
    await call('POST', `/campaign-pieces/${piece}/review`, 'token-owner');

    const approvals = await call('GET', '/approvals', 'token-owner');
    expect(approvals.json().approvals).toEqual([expect.objectContaining({ action: 'aprobar_pieza', module: 'Campañas', subjectId: piece })]);

    const approved = await call('POST', `/campaign-pieces/${piece}/approve`, 'token-owner');
    expect(approved.json().status).toBe('aprobada');
    expect((await call('PATCH', `/campaign-pieces/${piece}`, 'token-owner', { copy: 'Otro' })).statusCode).toBe(409);
  });

  it('editar una pieza en revisión la devuelve a borrador', async () => {
    const { campaign } = await approvedBrief();
    const piece = (await call('POST', `/campaigns/${campaign}/pieces`, 'token-owner', { network: 'x', format: 'texto', copy: 'Texto' })).json().id as string;
    await call('POST', `/campaign-pieces/${piece}/review`, 'token-owner');
    const edited = await call('PATCH', `/campaign-pieces/${piece}`, 'token-owner', { copy: 'Texto corregido' });
    expect(edited.json().status).toBe('borrador');
  });

  it('el brief en revisión aparece en Aprobaciones y se aprueba desde ahí', async () => {
    const { campaign } = await campaignWithBrief();
    await call('POST', `/campaigns/${campaign}/brief/review`, 'token-owner');
    const approvals = await call('GET', '/approvals', 'token-owner');
    expect(approvals.json().approvals).toEqual([expect.objectContaining({ action: 'aprobar_brief', module: 'Campañas', subjectId: campaign })]);
  });

  it('un cliente no gestiona briefs ni piezas', async () => {
    const { campaign } = await approvedBrief();
    expect((await call('POST', `/campaigns/${campaign}/pieces`, 'token-client', { network: 'linkedin', format: 'texto', copy: 'Texto' })).statusCode).toBe(403);
    expect((await call('POST', `/campaigns/${campaign}/brief/approve`, 'token-client')).statusCode).toBe(403);
  });
});
