import { describe, expect, it } from 'vitest';
import { withMembershipCache } from '../src/auth/membership-cache.js';
import { fakeIdentity, CLIENT } from './support/identity.js';

describe('caché de membresías', () => {
  it('no vuelve a preguntar a Clerk dentro del minuto siguiente', async () => {
    let calls = 0;
    const base = fakeIdentity();
    const original = base.listOrganizations;
    base.listOrganizations = async (userId) => {
      calls++;
      return original(userId);
    };
    let clock = 0;
    const cached = withMembershipCache(base, 60_000, () => clock);

    await cached.listOrganizations('user_owner');
    await cached.listOrganizations('user_owner');
    expect(calls).toBe(1);

    clock = 61_000;
    await cached.listOrganizations('user_owner');
    expect(calls).toBe(2);
  });

  it('retirar o cambiar el rol de una persona invalida su membresía en la caché', async () => {
    // Fuente de membresías que sí cambia cuando la API actualiza un rol.
    let role = 'org:admin';
    const base = fakeIdentity();
    base.listOrganizations = async () => [{ orgId: CLIENT, role }];
    base.updateMemberRole = async (input) => {
      role = input.role;
    };
    let clock = 0;
    const cached = withMembershipCache(base, 60_000, () => clock);
    expect(await cached.listOrganizations('user_client')).toEqual([{ orgId: CLIENT, role: 'org:admin' }]);

    await cached.updateMemberRole({ orgId: CLIENT, userId: 'user_client', role: 'org:member' });
    expect(await cached.listOrganizations('user_client')).toEqual([{ orgId: CLIENT, role: 'org:member' }]);
  });
});
