import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, leads, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { fakeIdentity, INTERNAL } from './support/identity.js';

const INTAKE = 'intake-secret-for-tests';
const intake = {
  name: 'Ana Pérez',
  email: 'ana@empresa.test',
  company: 'Empresa Demo',
  priority: 'architecture',
  context: 'Nuestro ERP responde lento.',
  locale: 'es',
  source: 'website',
  consent: { accepted: true, textVersion: "2026-10" },
};

let db: Db;
let close: () => Promise<void>;
let identity: ReturnType<typeof fakeIdentity>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  // Estado limpio en cada prueba.
  // Orden por claves foráneas: contactos y leads antes que organizaciones.
  await db.delete(auditLog);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);
  identity = fakeIdentity();
  app = buildApp({ identity, internalOrgId: INTERNAL, db, leadIntakeToken: INTAKE });
});

function capture(body: Record<string, unknown> = intake, token: string | null = INTAKE) {
  return app.inject({
    method: 'POST',
    url: '/leads',
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function asUser(method: 'GET' | 'POST', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

describe('F-01 captar lead', () => {
  it('con token de servicio registra el lead y responde 201', async () => {
    const response = await capture();
    expect(response.statusCode).toBe(201);
    const lead = response.json();
    expect(lead.status).toBe('nuevo');
    expect(lead.priorityChoice).toBe('architecture');
    expect(lead.email).toBe('ana@empresa.test');
  });

  it('deja registro en la bitácora', async () => {
    const lead = (await capture()).json();
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'lead.captured' && e.subjectId === lead.id)).toBe(true);
  });

  it('sin token o con token incorrecto responde 401', async () => {
    expect((await capture(intake, null)).statusCode).toBe(401);
    expect((await capture(intake, 'otro-token')).statusCode).toBe(401);
  });

  it('con datos inválidos responde 400 y no guarda nada', async () => {
    const response = await capture({ ...intake, email: 'no-es-correo' });
    expect(response.statusCode).toBe(400);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it('sin token de servicio configurado responde 503', async () => {
    const sinToken = buildApp({ identity, internalOrgId: INTERNAL, db });
    const response = await sinToken.inject({ method: 'POST', url: '/leads', payload: intake });
    expect(response.statusCode).toBe(503);
  });
});

describe('listar leads', () => {
  it('el owner ve los leads', async () => {
    await capture();
    const response = await asUser('GET', '/leads', 'token-owner');
    expect(response.statusCode).toBe(200);
    expect(response.json().leads).toHaveLength(1);
  });

  it('un miembro del equipo no ve leads: solo el owner (rol admin)', async () => {
    expect((await asUser('GET', '/leads', 'token-member')).statusCode).toBe(403);
  });

  it('un cliente no ve leads', async () => {
    expect((await asUser('GET', '/leads', 'token-client')).statusCode).toBe(403);
  });

  it('sin sesión responde 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/leads' })).statusCode).toBe(401);
  });
});

describe('F-02 decisión del owner', () => {
  async function capturedLead() {
    return (await capture()).json() as { id: string };
  }

  it('calificar cambia el estado y guarda el motivo', async () => {
    const lead = await capturedLead();
    const response = await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'calificar', reason: 'Encaja con arquitectura.' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('calificado');
  });

  it('posponer y descartar son decisiones válidas', async () => {
    const lead = await capturedLead();
    expect((await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'posponer', reason: 'Después del verano.', revisitAt: '2026-11-15T15:00:00.000Z' })).json().status).toBe('pospuesto');
    expect((await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'descartar', reason: 'Fuera de alcance.' })).json().status).toBe('descartado');
  });

  it('un miembro del equipo no puede decidir', async () => {
    const lead = await capturedLead();
    const response = await asUser('POST', `/leads/${lead.id}/decision`, 'token-member', { decision: 'calificar', reason: 'x' });
    expect(response.statusCode).toBe(403);
  });

  it('lead inexistente responde 404', async () => {
    const response = await asUser('POST', '/leads/00000000-0000-4000-8000-000000000000/decision', 'token-owner', { decision: 'calificar', reason: 'x' });
    expect(response.statusCode).toBe(404);
  });

  it('una decisión sin motivo responde 400', async () => {
    const lead = await capturedLead();
    const response = await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'calificar', reason: '' });
    expect(response.statusCode).toBe(400);
  });
});

describe('F-04 convertir en organización', () => {
  async function qualifiedLead() {
    const lead = (await capture()).json() as { id: string };
    await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'calificar', reason: 'Listo para convertir.' });
    return lead.id;
  }

  it('crea la organización en Clerk y en la base, con su contacto principal', async () => {
    const leadId = await qualifiedLead();
    const response = await asUser('POST', `/leads/${leadId}/convert`, 'token-owner');
    expect(response.statusCode).toBe(200);

    expect(identity.created).toEqual([{ name: 'Empresa Demo', createdBy: 'user_owner', orgId: 'org_NEW_1' }]);

    const [org] = await db.select().from(organizations);
    expect(org!.kind).toBe('client');
    expect(org!.clerkOrgId).toBe('org_NEW_1');

    const [contact] = await db.select().from(contacts);
    expect(contact!.isPrimary).toBe(true);
    expect(contact!.email).toBe('ana@empresa.test');
    expect(contact!.organizationId).toBe(org!.id);
  });

  it('el lead queda como convertido y ligado a la organización', async () => {
    const leadId = await qualifiedLead();
    const response = await asUser('POST', `/leads/${leadId}/convert`, 'token-owner');
    expect(response.json().lead.status).toBe('convertido');
    expect(response.json().lead.organizationId).toBe(response.json().organizationId);
  });

  it('usa el nombre de la persona si el lead no tiene empresa', async () => {
    const lead = (await capture({ ...intake, company: undefined })).json() as { id: string };
    await asUser('POST', `/leads/${lead.id}/decision`, 'token-owner', { decision: 'calificar', reason: 'ok' });
    await asUser('POST', `/leads/${lead.id}/convert`, 'token-owner');
    expect(identity.created[0]!.name).toBe('Ana Pérez');
  });

  it('solo se convierte un lead calificado', async () => {
    const lead = (await capture()).json() as { id: string };
    const response = await asUser('POST', `/leads/${lead.id}/convert`, 'token-owner');
    expect(response.statusCode).toBe(409);
    expect(identity.created).toHaveLength(0);
  });

  it('no se convierte dos veces', async () => {
    const leadId = await qualifiedLead();
    await asUser('POST', `/leads/${leadId}/convert`, 'token-owner');
    expect((await asUser('POST', `/leads/${leadId}/convert`, 'token-owner')).statusCode).toBe(409);
    expect(identity.created).toHaveLength(1);
  });

  it('un miembro del equipo no puede convertir', async () => {
    const leadId = await qualifiedLead();
    expect((await asUser('POST', `/leads/${leadId}/convert`, 'token-member')).statusCode).toBe(403);
    expect(identity.created).toHaveLength(0);
  });

  it('la conversión queda en la bitácora', async () => {
    const leadId = await qualifiedLead();
    await asUser('POST', `/leads/${leadId}/convert`, 'token-owner');
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'lead.converted' && e.actor === 'user_owner')).toBe(true);
  });
});
