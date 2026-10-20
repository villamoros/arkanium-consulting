import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, milestones, organizations, projects } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, OTHER_CLIENT, fakeIdentity } from './support/identity.js';

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
  await db.delete(milestones);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Activa', kind: 'client', clerkOrgId: CLIENT }).returning();
  const [suspended] = await db.insert(organizations).values({ name: 'Empresa Suspendida', kind: 'client', clerkOrgId: OTHER_CLIENT, status: 'suspended' }).returning();
  await db.insert(projects).values([
    { organizationId: client!.id, name: 'Proyecto activo', serviceFamily: 'architecture', phase: 'evaluar' },
    { organizationId: client!.id, name: 'Proyecto archivado', serviceFamily: 'product', phase: 'escalar', archivedAt: new Date() },
  ]);
  void suspended;

  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET', url: string, token: string) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });
}

describe('lista de clientes para Core', () => {
  it('trae el estado de acceso y solo los proyectos activos de cada cliente', async () => {
    const response = await call('GET', '/client-organizations', 'token-owner');
    expect(response.statusCode).toBe(200);
    const byName = Object.fromEntries(response.json().organizations.map((o: { name: string }) => [o.name, o]));
    expect(byName['Empresa Activa']).toMatchObject({ status: 'active', projectCount: 1 });
    expect(byName['Empresa Suspendida']).toMatchObject({ status: 'suspended', projectCount: 0 });
  });

  it('solo el owner ve la lista de clientes', async () => {
    expect((await call('GET', '/client-organizations', 'token-client')).statusCode).toBe(403);
  });
});
