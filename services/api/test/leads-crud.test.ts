import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, leads, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { fakeIdentity, INTERNAL } from './support/identity.js';

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
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, leadIntakeToken: 'token-sitio' });
});

function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token = 'token-owner', payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

async function manualLead(overrides: Record<string, unknown> = {}) {
  const response = await call('POST', '/leads/manual', 'token-owner', {
    name: 'Carla Méndez',
    email: 'carla@ejemplo.test',
    company: 'Logística Andina',
    priority: 'strategy',
    context: 'Me escribió por mensaje directo tras un comentario sobre deuda técnica.',
    locale: 'es',
    source: 'mensaje-directo',
    sourceReference: '@carla.mendez en LinkedIn',
    ...overrides,
  });
  return response;
}

describe('alta manual de leads (redes y captación directa)', () => {
  it('el owner crea un lead con su origen y la referencia de la red', async () => {
    const response = await manualLead();
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: 'Carla Méndez',
      source: 'mensaje-directo',
      sourceReference: '@carla.mendez en LinkedIn',
      status: 'nuevo',
    });
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'lead.created_manual' && e.actor === 'user_owner')).toBe(true);
  });

  it('un origen fuera de la lista se rechaza', async () => {
    const response = await manualLead({ source: 'pinterest' });
    expect(response.statusCode).toBe(400);
  });

  it('un miembro del equipo no puede crear leads', async () => {
    const response = await call('POST', '/leads/manual', 'token-member', { name: 'X', email: 'x@ejemplo.test', source: 'otro' });
    expect(response.statusCode).toBe(403);
  });
});

describe('edición de leads', () => {
  it('el owner cambia datos y el cambio queda en la bitácora', async () => {
    const created = await manualLead();
    const response = await call('PATCH', `/leads/${created.json().id}`, 'token-owner', { company: 'Logística Andina S.A.', source: 'linkedin' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ company: 'Logística Andina S.A.', source: 'linkedin' });
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'lead.updated')).toBe(true);
  });

  it('sin ningún dato para cambiar se responde 400', async () => {
    const created = await manualLead();
    const response = await call('PATCH', `/leads/${created.json().id}`, 'token-owner', {});
    expect(response.statusCode).toBe(400);
  });

  it('un lead convertido permite cambiar nombre y correo, y el contacto principal de la organización sigue el cambio', async () => {
    const created = await manualLead();
    const id = created.json().id;
    await call('POST', `/leads/${id}/decision`, 'token-owner', { decision: 'calificar', reason: 'Encaja con el servicio.' });
    const converted = await call('POST', `/leads/${id}/convert`, 'token-owner');
    const organizationId = converted.json().organizationId;

    const response = await call('PATCH', `/leads/${id}`, 'token-owner', { name: 'Carla M. Méndez', email: 'carla.m@ejemplo.test' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Carla M. Méndez', email: 'carla.m@ejemplo.test' });

    const [contact] = await db.select().from(contacts).where(eq(contacts.leadId, id));
    expect(contact).toMatchObject({ name: 'Carla M. Méndez', email: 'carla.m@ejemplo.test', organizationId });
  });

  it('un lead convertido no cambia empresa, mensaje ni origen: quedan como historial', async () => {
    const created = await manualLead();
    const id = created.json().id;
    await call('POST', `/leads/${id}/decision`, 'token-owner', { decision: 'calificar', reason: 'Encaja.' });
    await call('POST', `/leads/${id}/convert`, 'token-owner');
    const response = await call('PATCH', `/leads/${id}`, 'token-owner', { company: 'Otra empresa' });
    expect(response.statusCode).toBe(409);
  });
});

describe('eliminación de leads', () => {
  it('eliminar exige motivo', async () => {
    const created = await manualLead();
    const response = await call('DELETE', `/leads/${created.json().id}`, 'token-owner', {});
    expect(response.statusCode).toBe(400);
  });

  it('eliminar oculta el lead de la lista y del detalle, pero conserva el registro', async () => {
    const created = await manualLead();
    const id = created.json().id;
    const removed = await call('DELETE', `/leads/${id}`, 'token-owner', { reason: 'Mensaje duplicado.' });
    expect(removed.statusCode).toBe(204);

    const list = await call('GET', '/leads', 'token-owner');
    expect(list.json().leads).toHaveLength(0);
    const detail = await call('GET', `/leads/${id}`, 'token-owner');
    expect(detail.statusCode).toBe(404);

    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(row?.deletedAt).toBeInstanceOf(Date);
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'lead.deleted' && e.detail && (e.detail as { reason?: string }).reason === 'Mensaje duplicado.')).toBe(true);
  });

  it('un lead convertido no se elimina: ya es una organización', async () => {
    const created = await manualLead();
    const id = created.json().id;
    await call('POST', `/leads/${id}/decision`, 'token-owner', { decision: 'calificar', reason: 'Encaja.' });
    await call('POST', `/leads/${id}/convert`, 'token-owner');
    const response = await call('DELETE', `/leads/${id}`, 'token-owner', { reason: 'Error.' });
    expect(response.statusCode).toBe(409);
  });

  it('un miembro del equipo no puede eliminar leads', async () => {
    const created = await manualLead();
    const response = await call('DELETE', `/leads/${created.json().id}`, 'token-member', { reason: 'No debería.' });
    expect(response.statusCode).toBe(403);
  });
});
