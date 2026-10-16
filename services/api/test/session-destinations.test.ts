import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { listDestinations } from '../src/session/destination.js';
import { CLIENT, INTERNAL, OTHER_CLIENT, fakeIdentity } from './support/identity.js';

describe('listDestinations', () => {
  it('el equipo de Arkanium va a core; cada cliente va a su dashboard', () => {
    const result = listDestinations([{ orgId: CLIENT }, { orgId: INTERNAL }], INTERNAL);
    expect(result).toEqual([
      { destination: 'core', orgId: INTERNAL },
      { destination: 'app', orgId: CLIENT },
    ]);
  });

  it('sin organizaciones no hay destinos', () => {
    expect(listDestinations([], INTERNAL)).toEqual([]);
  });

  it('una organización repetida aparece una sola vez', () => {
    expect(listDestinations([{ orgId: CLIENT }, { orgId: CLIENT }], INTERNAL)).toEqual([{ destination: 'app', orgId: CLIENT }]);
  });
});

describe('GET /session/destinations', () => {
  const app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL });

  it('el owner recibe core', async () => {
    const response = await app.inject({ method: 'GET', url: '/session/destinations', headers: { authorization: 'Bearer token-owner' } });
    expect(response.json()).toEqual({ destinations: [{ destination: 'core', orgId: INTERNAL }] });
  });

  it('un administrador de cliente recibe su dashboard, sin acceso a core', async () => {
    const response = await app.inject({ method: 'GET', url: '/session/destinations', headers: { authorization: 'Bearer token-client' } });
    expect(response.json()).toEqual({ destinations: [{ destination: 'app', orgId: CLIENT }] });
  });

  it('otro cliente solo ve su propia organización', async () => {
    const response = await app.inject({ method: 'GET', url: '/session/destinations', headers: { authorization: 'Bearer token-other' } });
    expect(response.json()).toEqual({ destinations: [{ destination: 'app', orgId: OTHER_CLIENT }] });
  });

  it('sin token responde 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/session/destinations' });
    expect(response.statusCode).toBe(401);
  });
});
