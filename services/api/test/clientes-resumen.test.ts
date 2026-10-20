import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, milestones, organizations, projects } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let orgId: string;

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
  const [org] = await db.insert(organizations).values({ name: 'Cliente con resumen', kind: 'client', clerkOrgId: CLIENT }).returning();
  orgId = org!.id;
});

/** Identidad con invitaciones pendientes modificables: al invitar, la lista de pendientes crece. */
function identityWithPending() {
  const pending: Array<{ id: string; email: string; role: string; createdAt: string }> = [];
  const base = fakeIdentity();
  return {
    pending,
    identity: {
      ...base,
      listMembers: async () => [
        { userId: 'user_a', role: 'org:admin', email: 'laura@ejemplo.test', name: 'Laura Ruiz' },
        { userId: 'user_b', role: 'org:member', email: 'pablo@ejemplo.test', name: null },
      ],
      listInvitations: async () => pending,
      inviteMember: async ({ email, role }: { email: string; role: string }) => {
        pending.push({ id: `inv_${pending.length + 1}`, email, role, createdAt: new Date().toISOString() });
        return { invitationId: `inv_${pending.length}` };
      },
    },
  };
}

describe('resumen del cliente en la lista', () => {
  it('cuenta personas, guarda nombres y correos para buscar, y cuenta invitaciones pendientes', async () => {
    const { identity, pending } = identityWithPending();
    pending.push({ id: 'inv_0', email: 'nuevo@ejemplo.test', role: 'org:member', createdAt: new Date().toISOString() });
    const app = buildApp({ identity, internalOrgId: INTERNAL, db });

    const response = await app.inject({ method: 'GET', url: '/client-organizations', headers: { authorization: 'Bearer token-owner' } });
    expect(response.statusCode).toBe(200);
    const [client] = response.json().organizations;
    expect(client).toMatchObject({ name: 'Cliente con resumen', status: 'active', memberCount: 2, pendingInvitations: 1, membersUnavailable: false });
    expect(client.people).toEqual(expect.arrayContaining(['Laura Ruiz', 'laura@ejemplo.test', 'pablo@ejemplo.test']));
    expect(client).not.toHaveProperty('clerkOrgId');
  });

  it('al invitar, el resumen se actualiza en la siguiente consulta', async () => {
    const { identity } = identityWithPending();
    const app = buildApp({ identity, internalOrgId: INTERNAL, db });
    const before = await app.inject({ method: 'GET', url: '/client-organizations', headers: { authorization: 'Bearer token-owner' } });
    expect(before.json().organizations[0].pendingInvitations).toBe(0);

    const invited = await app.inject({
      method: 'POST',
      url: `/organizations/${orgId}/invitations`,
      headers: { authorization: 'Bearer token-owner' },
      payload: { email: 'nueva@ejemplo.test', role: 'org:member' },
    });
    expect(invited.statusCode).toBe(201);

    const after = await app.inject({ method: 'GET', url: '/client-organizations', headers: { authorization: 'Bearer token-owner' } });
    expect(after.json().organizations[0].pendingInvitations).toBe(1);
  });

  it('si Clerk no reconoce la organización, el resumen avisa en lugar de fallar', async () => {
    const base = fakeIdentity();
    const app = buildApp({
      identity: { ...base, listMembers: async () => { throw new Error('404'); }, listInvitations: async () => { throw new Error('404'); } },
      internalOrgId: INTERNAL,
      db,
    });
    const response = await app.inject({ method: 'GET', url: '/client-organizations', headers: { authorization: 'Bearer token-owner' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().organizations[0]).toMatchObject({ memberCount: 0, membersUnavailable: true });
  });
});

describe('ficha del cliente', () => {
  it('muestra las invitaciones pendientes y el motivo de la suspensión registrado en la bitácora', async () => {
    const { identity, pending } = identityWithPending();
    pending.push({ id: 'inv_9', email: 'pendiente@ejemplo.test', role: 'org:admin', createdAt: new Date().toISOString() });
    const app = buildApp({ identity, internalOrgId: INTERNAL, db });

    const suspended = await app.inject({
      method: 'POST',
      url: `/organizations/${orgId}/suspend`,
      headers: { authorization: 'Bearer token-owner' },
      payload: { reason: 'Factura vencida sin respuesta' },
    });
    expect(suspended.statusCode).toBe(200);

    const detail = await app.inject({ method: 'GET', url: `/organizations/${orgId}`, headers: { authorization: 'Bearer token-owner' } });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.organization).toMatchObject({ status: 'suspended', suspendedReason: 'Factura vencida sin respuesta' });
    expect(body.invitations).toEqual([expect.objectContaining({ email: 'pendiente@ejemplo.test', role: 'org:admin' })]);
    expect(body.invitationsUnavailable).toBe(false);
  });

  it('una organización activa no trae motivo de suspensión', async () => {
    const { identity } = identityWithPending();
    const app = buildApp({ identity, internalOrgId: INTERNAL, db });
    const detail = await app.inject({ method: 'GET', url: `/organizations/${orgId}`, headers: { authorization: 'Bearer token-owner' } });
    expect(detail.json().organization.suspendedReason).toBeNull();
  });
});
