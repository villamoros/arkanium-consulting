import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, leads, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { fakeIdentity, INTERNAL } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let identity: ReturnType<typeof fakeIdentity>;
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
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Empresa Demo', kind: 'client', clerkOrgId: 'org_CLIENT' })
    .returning();
  clientOrgId = org!.id;
  identity = fakeIdentity();
  app = buildApp({ identity, internalOrgId: INTERNAL, db });
});

function invite(orgId: string, body: object, token = 'token-owner') {
  return app.inject({
    method: 'POST',
    url: `/organizations/${orgId}/invitations`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

describe('D-03 invitaciones desde core', () => {
  it('el owner invita por correo con rol miembro y queda en la bitácora', async () => {
    const response = await invite(clientOrgId, { email: 'persona@empresa.test', role: 'org:member' });
    expect(response.statusCode).toBe(201);
    expect(identity.invited).toEqual([{ orgId: 'org_CLIENT', email: 'persona@empresa.test', role: 'org:member' }]);

    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'member.invited' && e.actor === 'user_owner')).toBe(true);
  });

  it('el owner puede invitar con rol administrador', async () => {
    const response = await invite(clientOrgId, { email: 'admin@empresa.test', role: 'org:admin' });
    expect(response.statusCode).toBe(201);
    expect(identity.invited[0]!.role).toBe('org:admin');
  });

  it('un administrador de cliente no puede invitar: la invitación es del owner', async () => {
    const response = await invite(clientOrgId, { email: 'x@empresa.test', role: 'org:member' }, 'token-client');
    expect(response.statusCode).toBe(403);
    expect(identity.invited).toHaveLength(0);
  });

  it('un rol fuera de los dos permitidos responde 400', async () => {
    const response = await invite(clientOrgId, { email: 'x@empresa.test', role: 'org:super' });
    expect(response.statusCode).toBe(400);
    expect(identity.invited).toHaveLength(0);
  });

  it('un correo inválido responde 400', async () => {
    const response = await invite(clientOrgId, { email: 'no-es-correo', role: 'org:member' });
    expect(response.statusCode).toBe(400);
  });

  it('una organización inexistente responde 404', async () => {
    const response = await invite('00000000-0000-4000-8000-000000000000', { email: 'x@empresa.test', role: 'org:member' });
    expect(response.statusCode).toBe(404);
  });

  it('retirar a una persona llama a Clerk y queda en la bitácora', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/organizations/${clientOrgId}/members/user_client_2`,
      headers: { authorization: 'Bearer token-owner' },
    });
    expect(response.statusCode).toBe(204);
    expect(identity.removed).toEqual([{ orgId: 'org_CLIENT', userId: 'user_client_2' }]);

    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'member.removed')).toBe(true);
  });

  it('un miembro del equipo no puede retirar a nadie', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/organizations/${clientOrgId}/members/user_client_2`,
      headers: { authorization: 'Bearer token-member' },
    });
    expect(response.statusCode).toBe(403);
    expect(identity.removed).toHaveLength(0);
  });
});
