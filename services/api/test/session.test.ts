import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { IdentityGateway } from '../src/auth/clerk.js';
import { decideDestination } from '../src/session/destination.js';

const INTERNAL = 'org_INTERNAL';
const CLIENT = 'org_CLIENT';

/** Doble de Clerk: tokens y membresías fijas, sin red. */
function fakeIdentity(tokens: Record<string, string>, memberships: Record<string, Array<{ orgId: string; role: string }>>): IdentityGateway {
  return {
    verifyBearer: async (token) => tokens[token] ?? null,
    listOrganizations: async (userId) => memberships[userId] ?? [],
  };
}

const identity = fakeIdentity(
  { 'token-team': 'user_team', 'token-client': 'user_client', 'token-none': 'user_none' },
  {
    user_team: [{ orgId: INTERNAL, role: 'org:admin' }],
    user_client: [{ orgId: CLIENT, role: 'org:member' }],
    user_none: [],
  },
);

function appWith(gateway: IdentityGateway) {
  return buildApp({ identity: gateway, internalOrgId: INTERNAL });
}

describe('decideDestination', () => {
  it('miembro de la organización interna va a core', () => {
    expect(decideDestination([{ orgId: INTERNAL }], INTERNAL)).toEqual({ destination: 'core', orgId: INTERNAL });
  });
  it('miembro solo de organizaciones de cliente va a app', () => {
    expect(decideDestination([{ orgId: CLIENT }], INTERNAL)).toEqual({ destination: 'app', orgId: CLIENT });
  });
  it('sin organizaciones: none', () => {
    expect(decideDestination([], INTERNAL)).toEqual({ destination: 'none' });
  });
  it('si pertenece a la interna y a un cliente, prevalece core', () => {
    expect(decideDestination([{ orgId: CLIENT }, { orgId: INTERNAL }], INTERNAL)).toEqual({ destination: 'core', orgId: INTERNAL });
  });
});

describe('GET /session/destination', () => {
  it('sin token responde 401', async () => {
    const app = appWith(identity);
    const response = await app.inject({ method: 'GET', url: '/session/destination' });
    await app.close();
    expect(response.statusCode).toBe(401);
  });

  it('con token inválido responde 401', async () => {
    const app = appWith(identity);
    const response = await app.inject({
      method: 'GET',
      url: '/session/destination',
      headers: { authorization: 'Bearer token-falso' },
    });
    await app.close();
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized' });
  });

  it('equipo interno recibe core', async () => {
    const app = appWith(identity);
    const response = await app.inject({
      method: 'GET',
      url: '/session/destination',
      headers: { authorization: 'Bearer token-team' },
    });
    await app.close();
    expect(response.json()).toEqual({ destination: 'core', orgId: INTERNAL });
  });

  it('cliente recibe app', async () => {
    const app = appWith(identity);
    const response = await app.inject({
      method: 'GET',
      url: '/session/destination',
      headers: { authorization: 'Bearer token-client' },
    });
    await app.close();
    expect(response.json()).toEqual({ destination: 'app', orgId: CLIENT });
  });

  it('persona sin organización recibe none', async () => {
    const app = appWith(identity);
    const response = await app.inject({
      method: 'GET',
      url: '/session/destination',
      headers: { authorization: 'Bearer token-none' },
    });
    await app.close();
    expect(response.json()).toEqual({ destination: 'none' });
  });

  it('sin configuración de identidad la ruta no existe', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/session/destination' });
    await app.close();
    expect(response.statusCode).toBe(404);
  });
});
