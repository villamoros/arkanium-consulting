import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(organizations);
});

describe('ficha de cliente cuando Clerk no reconoce la organización', () => {
  it('responde 200 con la ficha y sin personas, avisando que no están disponibles', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Cliente de prueba', kind: 'client', clerkOrgId: 'org_NO_EXISTE' }).returning();
    const identity = fakeIdentity();
    const app = buildApp({
      identity: { ...identity, listMembers: async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); } },
      internalOrgId: INTERNAL,
      db,
    });
    const response = await app.inject({ method: 'GET', url: `/organizations/${org!.id}`, headers: { authorization: 'Bearer token-owner' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ organization: { name: 'Cliente de prueba' }, members: [], membersUnavailable: true });
  });

  it('con Clerk disponible, las personas llegan y membersUnavailable es falso', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Cliente real', kind: 'client', clerkOrgId: CLIENT }).returning();
    const app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
    const response = await app.inject({ method: 'GET', url: `/organizations/${org!.id}`, headers: { authorization: 'Bearer token-owner' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().membersUnavailable).toBe(false);
  });
});
