import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, leads, meetings, organizations, proposalVersions, proposals, suppressions } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let clientOrgId: string;
let leadId: string;

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
  await db.delete(suppressions);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Propuestas', kind: 'client', clerkOrgId: CLIENT }).returning();
  clientOrgId = client!.id;
  await db.insert(contacts).values({ name: 'Ana Cliente', email: 'ana@empresa.test', organizationId: clientOrgId, isPrimary: true });
  const [lead] = await db
    .insert(leads)
    .values({ name: 'Lead calificado', email: 'lead@prospecto.test', priorityChoice: 'architecture', locale: 'es', status: 'calificado' })
    .returning();
  leadId = lead!.id;

  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

const CONFIRMED = { summary: 'Diagnóstico en tres semanas.', priceStatus: 'confirmado', priceCents: 450000 };

async function clientProposal(overrides: Record<string, unknown> = {}) {
  const response = await call('POST', '/proposals', 'token-owner', {
    kind: 'cliente',
    organizationId: clientOrgId,
    title: 'Diagnóstico de arquitectura',
    serviceFamily: 'architecture',
    templateCode: 'PL-03',
    summary: 'Borrador inicial.',
    priceStatus: 'por_confirmar',
    ...overrides,
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe('crear y versionar', () => {
  it('se crea como borrador con el precio por confirmar, y cada versión queda registrada', async () => {
    const id = await clientProposal();
    const detail = await call('GET', `/proposals/${id}`, 'token-owner');
    expect(detail.json()).toMatchObject({ status: 'borrador', currentVersion: 1, priceStatus: 'por_confirmar', targetName: 'Empresa Propuestas' });

    const next = await call('POST', `/proposals/${id}/versions`, 'token-owner', CONFIRMED);
    expect(next.statusCode).toBe(200);
    expect(next.json().currentVersion).toBe(2);
    const after = await call('GET', `/proposals/${id}`, 'token-owner');
    expect(after.json().versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
  });

  it('un precio confirmado necesita monto o nota', async () => {
    const response = await call('POST', '/proposals', 'token-owner', {
      kind: 'cliente',
      organizationId: clientOrgId,
      title: 'Sin precio',
      templateCode: 'PL-03',
      summary: 'x',
      priceStatus: 'confirmado',
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('enviar y decidir', () => {
  it('no se envía a aprobación con el precio por confirmar', async () => {
    const id = await clientProposal();
    const response = await call('POST', `/proposals/${id}/approval`, 'token-owner');
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('invalid_state');
  });

  it('con precio confirmado pasa a aprobación, y ya no admite versiones nuevas', async () => {
    const id = await clientProposal();
    await call('POST', `/proposals/${id}/versions`, 'token-owner', CONFIRMED);
    expect((await call('POST', `/proposals/${id}/approval`, 'token-owner')).json().status).toBe('en_aprobacion');
    const late = await call('POST', `/proposals/${id}/versions`, 'token-owner', CONFIRMED);
    expect(late.statusCode).toBe(409);
  });

  it('el owner registra el envío; la aceptación exige la propuesta enviada y su firma', async () => {
    const id = await clientProposal({ ...CONFIRMED });
    await call('POST', `/proposals/${id}/approval`, 'token-owner');
    expect((await call('POST', `/proposals/${id}/accept`, 'token-owner', { note: 'firma' })).statusCode).toBe(409);

    expect((await call('POST', `/proposals/${id}/sent`, 'token-owner')).json().status).toBe('enviada');
    const accepted = await call('POST', `/proposals/${id}/accept`, 'token-owner', { note: 'Firma adjunta del 20 de octubre' });
    expect(accepted.json()).toMatchObject({ status: 'aceptada' });
    const detail = await call('GET', `/proposals/${id}`, 'token-owner');
    expect(detail.json().decisionNote).toBe('Firma adjunta del 20 de octubre');
  });

  it('el rechazo queda con su motivo', async () => {
    const id = await clientProposal({ ...CONFIRMED });
    await call('POST', `/proposals/${id}/approval`, 'token-owner');
    await call('POST', `/proposals/${id}/sent`, 'token-owner');
    const rejected = await call('POST', `/proposals/${id}/reject`, 'token-owner', { note: 'Presupuesto fuera de rango' });
    expect(rejected.json()).toMatchObject({ status: 'rechazada' });
  });

  it('no se marca como enviada si un correo del cliente está suprimido', async () => {
    const id = await clientProposal({ ...CONFIRMED });
    await call('POST', `/proposals/${id}/approval`, 'token-owner');
    await db.insert(suppressions).values({ email: 'ana@empresa.test', reason: 'Baja', createdBy: 'owner' });
    const response = await call('POST', `/proposals/${id}/sent`, 'token-owner');
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('suppressed');
  });
});

describe('a leads y permisos', () => {
  it('solo se propone a un lead calificado', async () => {
    const [nuevo] = await db.insert(leads).values({ name: 'Lead nuevo', email: 'nuevo@prospecto.test', priorityChoice: 'product', locale: 'es' }).returning();
    const response = await call('POST', '/proposals', 'token-owner', {
      kind: 'lead',
      leadId: nuevo!.id,
      title: 'Para lead nuevo',
      templateCode: 'PL-04',
      summary: 'x',
      priceStatus: 'por_confirmar',
    });
    expect(response.statusCode).toBe(409);

    const ok = await call('POST', '/proposals', 'token-owner', {
      kind: 'lead',
      leadId,
      title: 'CTO fraccional',
      templateCode: 'PL-04',
      summary: 'x',
      priceStatus: 'por_confirmar',
    });
    expect(ok.statusCode).toBe(201);
  });

  it('el cliente no ve ni crea propuestas desde Core', async () => {
    expect((await call('GET', '/proposals', 'token-client')).statusCode).toBe(403);
    expect((await call('POST', '/proposals', 'token-client', { kind: 'cliente', organizationId: clientOrgId, title: 'x', templateCode: 'PL', summary: 'x', priceStatus: 'por_confirmar' })).statusCode).toBe(403);
  });

  it('la lista trae la versión vigente de cada propuesta', async () => {
    const id = await clientProposal({ ...CONFIRMED });
    const list = await call('GET', '/proposals', 'token-owner');
    expect(list.json().proposals[0]).toMatchObject({ id, priceStatus: 'confirmado', priceCents: 450000, targetName: 'Empresa Propuestas', status: 'borrador' });
    const stored = await db.select().from(proposals).where(eq(proposals.id, id));
    expect(stored[0]!.currentVersion).toBe(1);
  });
});
