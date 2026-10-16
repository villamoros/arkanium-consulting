import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, leads, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { fakeIdentity, INTERNAL } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
const INTAKE = 'token-sitio-prueba';

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
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, leadIntakeToken: INTAKE });
});

async function captureLead() {
  const response = await app.inject({
    method: 'POST',
    url: '/leads',
    headers: { authorization: `Bearer ${INTAKE}` },
    payload: { name: 'Lucía Romero', email: 'lucia@ejemplo.test', company: 'Distribuidora Norte', priority: 'architecture', context: 'Nuestro ERP tiene doce años.', locale: 'es' },
  });
  return response.json().id as string;
}

describe('detalle de lead para el owner', () => {
  it('el owner ve el mensaje del formulario y la fuente, y la propuesta vacía mientras no hay agente', async () => {
    const id = await captureLead();
    const response = await app.inject({ method: 'GET', url: `/leads/${id}`, headers: { authorization: 'Bearer token-owner' } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.context).toBe('Nuestro ERP tiene doce años.');
    expect(body.source).toBe('website');
    expect(body.proposedFamily).toBe('unknown');
    expect(body.decisionNote).toBeNull();
  });

  it('tras calificar, el motivo escrito por el owner queda visible en el detalle', async () => {
    const id = await captureLead();
    await app.inject({
      method: 'POST',
      url: `/leads/${id}/decision`,
      headers: { authorization: 'Bearer token-owner' },
      payload: { decision: 'calificar', reason: 'Encaja con evaluación de arquitectura.' },
    });
    const response = await app.inject({ method: 'GET', url: `/leads/${id}`, headers: { authorization: 'Bearer token-owner' } });
    expect(response.json().status).toBe('calificado');
    expect(response.json().decisionNote).toBe('Encaja con evaluación de arquitectura.');
  });

  it('un lead que no existe responde 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/leads/00000000-0000-4000-8000-000000000000',
      headers: { authorization: 'Bearer token-owner' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('un miembro del equipo no ve leads', async () => {
    const id = await captureLead();
    const response = await app.inject({ method: 'GET', url: `/leads/${id}`, headers: { authorization: 'Bearer token-member' } });
    expect(response.statusCode).toBe(403);
  });
});
