import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { agents, auditLog, emergencyState } from '../src/db/schema.js';
import { ensureEmergencyCatalog } from '../src/emergency/service.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
const SECRET = 'secreto-interno-de-prueba';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(agents);
  await db.delete(emergencyState);
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, internalSecret: SECRET });
});

async function call(method: 'GET' | 'POST', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Pone agentes en estado activo, como si ya se hubieran activado. Carga el catálogo antes si hace falta. */
async function activate(codes: string[]) {
  await ensureEmergencyCatalog(db);
  for (const code of codes) await db.update(agents).set({ status: 'activo' }).where(eq(agents.code, code));
}

async function agentId(code: string): Promise<string> {
  await ensureEmergencyCatalog(db);
  const [row] = await db.select().from(agents).where(eq(agents.code, code));
  return row!.id;
}

describe('pausas de emergencia', () => {
  it('el catálogo tiene 42 agentes en tres departamentos, todos definidos y sin pausa', async () => {
    const response = await call('GET', '/emergency', 'token-owner');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.paused).toBe(false);
    expect(body.totals).toMatchObject({ total: 42, active: 0, paused: 0, operating: 0 });
    expect(body.departments.map((d: { total: number }) => d.total)).toEqual([13, 14, 15]);
    expect(body.agents.every((a: { status: string }) => a.status === 'definido')).toBe(true);
  });

  it('pausar un departamento solo detiene sus agentes activos, y queda en la bitácora', async () => {
    await activate(['evaluacion-arquitectura', 'hoja-ruta-modernizacion']);
    const paused = await call('POST', '/emergency/departments/arquitectura/pause', 'token-owner', { reason: 'Revisión de costos' });
    expect(paused.statusCode).toBe(200);
    expect(paused.json().departments.find((d: { id: string }) => d.id === 'arquitectura')).toMatchObject({ active: 0, paused: 2 });
    expect(paused.json().departments.find((d: { id: string }) => d.id === 'estrategia')).toMatchObject({ active: 0, paused: 0 });

    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'department.paused' && (e.detail as { count: number }).count === 2)).toBe(true);
  });

  it('un departamento sin agentes activos no se puede pausar, y se reanuda a activo', async () => {
    expect((await call('POST', '/emergency/departments/estrategia/pause', 'token-owner', { reason: 'Prueba' })).statusCode).toBe(409);

    await activate(['evaluacion-arquitectura']);
    await call('POST', '/emergency/departments/arquitectura/pause', 'token-owner', { reason: 'Prueba' });
    const resumed = await call('POST', '/emergency/departments/arquitectura/resume', 'token-owner', {});
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json().departments.find((d: { id: string }) => d.id === 'arquitectura')).toMatchObject({ active: 1, paused: 0 });
  });

  it('un agente definido no se pausa; un agente activo se pausa con motivo y se reanuda', async () => {
    const definido = await agentId('evaluacion-arquitectura');
    expect((await call('POST', `/agents/${definido}/pause`, 'token-owner', { reason: 'Prueba' })).statusCode).toBe(409);

    await activate(['evaluacion-arquitectura']);
    const paused = await call('POST', `/agents/${definido}/pause`, 'token-owner', { reason: 'Cliente pidió detener' });
    expect(paused.statusCode).toBe(200);
    const agent = paused.json().agents.find((a: { id: string }) => a.id === definido);
    expect(agent).toMatchObject({ status: 'pausado', pauseReason: 'Cliente pidió detener' });

    const resumed = await call('POST', `/agents/${definido}/resume`, 'token-owner', {});
    expect(resumed.json().agents.find((a: { id: string }) => a.id === definido)).toMatchObject({ status: 'activo', pauseReason: null });
  });

  it('la pausa global bloquea a todos los agentes; reanudar devuelve sus estados tal como estaban', async () => {
    await activate(['evaluacion-arquitectura', 'chequeo-tecnico']);
    const paused = await call('POST', '/emergency/pause-all', 'token-owner', { reason: 'Incidente en Stripe' });
    expect(paused.json()).toMatchObject({ paused: true, reason: 'Incidente en Stripe' });
    expect((await call('POST', '/emergency/pause-all', 'token-owner', { reason: 'Otra vez' })).statusCode).toBe(409);

    const status = await app.inject({ method: 'GET', url: '/internal/emergency', headers: { 'x-arkanium-secret': SECRET } });
    const allowed = status.json().agents.filter((a: { allowed: boolean }) => a.allowed);
    expect(status.json().paused).toBe(true);
    expect(allowed).toHaveLength(0);

    const resumed = await call('POST', '/emergency/resume-all', 'token-owner');
    expect(resumed.json()).toMatchObject({ paused: false });
    const after = await call('GET', '/emergency', 'token-owner');
    expect(after.json().totals.active).toBe(2);
  });

  it('el motivo es obligatorio para pausar', async () => {
    expect((await call('POST', '/emergency/pause-all', 'token-owner', { reason: '   ' })).statusCode).toBe(400);
    expect((await call('POST', '/emergency/departments/arquitectura/pause', 'token-owner', { reason: '' })).statusCode).toBe(400);
  });

  it('un departamento que no existe da 404', async () => {
    expect((await call('POST', '/emergency/departments/ventas/pause', 'token-owner', { reason: 'Prueba' })).statusCode).toBe(404);
  });

  it('solo el owner ve y cambia las pausas; el endpoint interno exige el secreto', async () => {
    expect((await call('GET', '/emergency', 'token-client')).statusCode).toBe(403);
    expect((await call('POST', '/emergency/pause-all', 'token-client', { reason: 'Mía' })).statusCode).toBe(403);

    expect((await app.inject({ method: 'GET', url: '/internal/emergency' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/internal/emergency', headers: { 'x-arkanium-secret': SECRET } })).statusCode).toBe(200);
  });
});
