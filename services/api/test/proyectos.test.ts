import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, milestones, organizations, projects } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let clientOrgId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(milestones);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Proyectos', kind: 'client', clerkOrgId: CLIENT }).returning();
  clientOrgId = client!.id;

  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

async function createProject(name = 'Modernización ERP') {
  const response = await call('POST', `/organizations/${clientOrgId}/projects`, 'token-owner', {
    name,
    serviceFamily: 'architecture',
    phase: 'evaluar',
    progress: 'Entrevistas completas',
    nextStep: 'Revisión del informe',
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe('listar y editar proyectos', () => {
  it('el owner ve todos los proyectos con su cliente; el cliente no ve la lista de Core', async () => {
    await createProject();
    const forOwner = await call('GET', '/projects', 'token-owner');
    expect(forOwner.statusCode).toBe(200);
    expect(forOwner.json().projects[0]).toMatchObject({ name: 'Modernización ERP', organizationName: 'Empresa Proyectos', phase: 'evaluar' });

    const forClient = await call('GET', '/projects', 'token-client');
    expect(forClient.statusCode).toBe(403);
  });

  it('el owner cambia fase, avance y siguiente paso; un cambio vacío responde 400', async () => {
    const id = await createProject();
    const updated = await call('PATCH', `/projects/${id}`, 'token-owner', { phase: 'arquitectar', progress: 'Mapa de sistemas', nextStep: 'Aprobar arquitectura' });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ phase: 'arquitectar', progress: 'Mapa de sistemas', nextStep: 'Aprobar arquitectura', name: 'Modernización ERP' });

    const empty = await call('PATCH', `/projects/${id}`, 'token-owner', {});
    expect(empty.statusCode).toBe(400);
  });

  it('el cliente no puede editar un proyecto desde Core', async () => {
    const id = await createProject();
    const response = await call('PATCH', `/projects/${id}`, 'token-client', { phase: 'escalar' });
    expect(response.statusCode).toBe(403);
  });
});

describe('archivar proyectos', () => {
  it('archivar lo quita de las listas y de la vista del cliente, pero conserva el registro y la bitácora', async () => {
    const id = await createProject();
    const archived = await call('DELETE', `/projects/${id}`, 'token-owner', { reason: 'Duplicado de otro proyecto' });
    expect(archived.statusCode).toBe(200);

    expect((await call('GET', '/projects', 'token-owner')).json().projects).toHaveLength(0);
    expect((await call('GET', `/organizations/${clientOrgId}/projects`, 'token-client')).json().projects).toHaveLength(0);
    expect((await call('GET', `/projects/${id}`, 'token-client')).statusCode).toBe(404);

    const [row] = await db.select().from(projects).where(eq(projects.id, id));
    expect(row!.archivedAt).not.toBeNull();
    const entries = await db.select().from(auditLog).where(eq(auditLog.action, 'project.archived'));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.detail).toMatchObject({ reason: 'Duplicado de otro proyecto' });
  });

  it('un proyecto archivado no admite hitos nuevos ni cambios', async () => {
    const id = await createProject();
    await call('DELETE', `/projects/${id}`, 'token-owner', { reason: 'Error de alta' });
    expect((await call('POST', `/projects/${id}/milestones`, 'token-owner', { name: 'Hito' })).statusCode).toBe(404);
    expect((await call('PATCH', `/projects/${id}`, 'token-owner', { phase: 'escalar' })).statusCode).toBe(404);
  });

  it('el cliente no puede archivar', async () => {
    const id = await createProject();
    expect((await call('DELETE', `/projects/${id}`, 'token-client', { reason: 'no' })).statusCode).toBe(403);
  });
});
