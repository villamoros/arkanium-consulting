import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { CalendarSyncError, type CalendarGateway } from '../src/calendar/n8n.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, leads, meetings, organizations, suppressions } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let clientOrgId: string;
let failCancel = false;

const INTERNAL_SECRET = 'secreto-interno-prueba';
const FUTURE = '2026-12-01T15:00:00.000Z';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const calendar: CalendarGateway = {
  async createEvent() {
    return { eventId: 'evt_rutas', htmlLink: 'https://calendar.test/evt_rutas', meetLink: 'https://meet.test/rutas' };
  },
  async updateEvent() {
    return { htmlLink: 'https://calendar.test/evt_rutas' };
  },
  async cancelEvent() {
    if (failCancel) throw new CalendarSyncError('caído');
  },
};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  failCancel = false;
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(meetings);
  await db.delete(suppressions);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Rutas', kind: 'client', clerkOrgId: CLIENT }).returning();
  clientOrgId = client!.id;
  await db.insert(contacts).values({ name: 'Ana Cliente', email: 'ana@empresa.test', organizationId: clientOrgId, isPrimary: true });

  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, calendar, internalSecret: INTERNAL_SECRET });
});

async function call(method: 'GET' | 'POST', url: string, token: string, payload?: object, headers: Record<string, string> = {}) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}`, ...headers }, payload });
}

/** Solicitud creada por el cliente, como en la app. */
async function requestByClient(topic = 'Avance') {
  const response = await call('POST', `/organizations/${clientOrgId}/meetings`, 'token-client', { topic });
  return response.json().id as string;
}

async function confirmedRow(startsAt: Date) {
  const [meeting] = await db
    .insert(meetings)
    .values({
      organizationId: clientOrgId,
      topic: 'Reunión confirmada',
      requestedBy: 'user_cliente',
      preferredWindows: [],
      status: 'confirmada',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      attendees: ['ana@empresa.test'],
      calendarEventId: 'evt_viejo',
      calendarStatus: 'sincronizada',
    })
    .returning();
  return meeting!;
}

describe('permisos: solo el owner opera estas rutas', () => {
  it('el cliente no ve ni cambia supresiones, ni rechaza reuniones, ni responde propuestas de leads', async () => {
    const meetingId = await requestByClient();
    expect((await call('GET', '/suppressions', 'token-client')).statusCode).toBe(403);
    expect((await call('POST', '/suppressions', 'token-client', { email: 'x@y.test', reason: 'prueba' })).statusCode).toBe(403);
    expect((await call('POST', `/meetings/${meetingId}/reject`, 'token-client', { reason: 'no' })).statusCode).toBe(403);
    expect((await call('POST', `/leads/${UNKNOWN_ID}/proposal`, 'token-client', { accepted: true })).statusCode).toBe(403);
    expect((await call('POST', `/leads/${UNKNOWN_ID}/meetings`, 'token-client', { topic: 'Demo' })).statusCode).toBe(403);
  });
});

describe('supresiones', () => {
  it('el owner añade un correo, no se repite y queda en la lista', async () => {
    const added = await call('POST', '/suppressions', 'token-owner', { email: 'Baja@Ejemplo.test', reason: 'Pidió no recibir mensajes' });
    expect(added.statusCode).toBe(201);
    expect(added.json().email).toBe('baja@ejemplo.test');

    const again = await call('POST', '/suppressions', 'token-owner', { email: 'baja@ejemplo.test', reason: 'otra vez' });
    expect(again.statusCode).toBe(409);

    const list = await call('GET', '/suppressions', 'token-owner');
    expect(list.json().suppressions.map((s: { email: string }) => s.email)).toEqual(['baja@ejemplo.test']);
  });

  it('confirmar una reunión a un correo suprimido responde 409 y no crea nada', async () => {
    await call('POST', '/suppressions', 'token-owner', { email: 'ana@empresa.test', reason: 'Baja' });
    const meetingId = await requestByClient();

    const response = await call('POST', `/meetings/${meetingId}/confirm`, 'token-owner', { startsAt: FUTURE, attendees: [] });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('suppressed');
    const [row] = await db.select().from(meetings);
    expect(row!.status).toBe('solicitada');
  });
});

describe('rechazar y proponer', () => {
  it('rechazar deja la solicitud rechazada y ya no se puede confirmar', async () => {
    const meetingId = await requestByClient();
    const rejected = await call('POST', `/meetings/${meetingId}/reject`, 'token-owner', { reason: 'Sin equipo ese día' });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({ status: 'rechazada', decisionNote: 'Sin equipo ese día' });

    const confirm = await call('POST', `/meetings/${meetingId}/confirm`, 'token-owner', { startsAt: FUTURE, attendees: [] });
    expect(confirm.statusCode).toBe(409);
  });

  it('proponer otra hora guarda la propuesta y la solicitud sigue pendiente', async () => {
    const meetingId = await requestByClient();
    const proposed = await call('POST', `/meetings/${meetingId}/propose`, 'token-owner', { startsAt: FUTURE, note: 'Mejor por la tarde' });
    expect(proposed.statusCode).toBe(200);
    expect(proposed.json()).toMatchObject({ status: 'solicitada', proposedStartsAt: FUTURE, decisionNote: 'Mejor por la tarde' });
  });
});

describe('cancelar, reprogramar y acta', () => {
  it('si el calendario no responde al cancelar, la reunión sigue confirmada y responde 502', async () => {
    const meeting = await confirmedRow(new Date(FUTURE));
    failCancel = true;
    const response = await call('POST', `/meetings/${meeting.id}/cancel`, 'token-owner', { reason: 'Se mueve' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe('calendar_unavailable');
    const [row] = await db.select().from(meetings);
    expect(row!.status).toBe('confirmada');
  });

  it('el acta no se publica antes de la hora de la reunión', async () => {
    const meeting = await confirmedRow(new Date(FUTURE));
    const response = await call('POST', `/meetings/${meeting.id}/minutes`, 'token-owner', { text: 'Acta anticipada' });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('invalid_state');
  });
});

describe('reuniones con leads', () => {
  it('el owner pide una reunión con un lead y el cliente no puede', async () => {
    const [lead] = await db.insert(leads).values({ name: 'Luis Prospecto', email: 'luis@prospecto.test', priorityChoice: 'architecture', locale: 'es' }).returning();
    const created = await call('POST', `/leads/${lead!.id}/meetings`, 'token-owner', { topic: 'Demo del diagnóstico' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ kind: 'lead', leadId: lead!.id, topic: 'Demo del diagnóstico' });

    const history = await call('GET', `/leads/${lead!.id}/history`, 'token-owner');
    expect(history.statusCode).toBe(200);
    expect(history.json().meetings).toHaveLength(1);
  });
});

describe('rutas internas de n8n (recordatorios)', () => {
  it('sin el secreto responde 401; con el secreto lista recordatorios y los marca como enviados', async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60_000);
    const meeting = await confirmedRow(soon);

    expect((await app.inject({ method: 'GET', url: '/internal/meetings/due-reminders' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/internal/meetings/due-reminders', headers: { 'x-arkanium-secret': 'otro' } })).statusCode).toBe(401);

    const due = await app.inject({ method: 'GET', url: '/internal/meetings/due-reminders?hours=24', headers: { 'x-arkanium-secret': INTERNAL_SECRET } });
    expect(due.statusCode).toBe(200);
    expect(due.json().meetings.map((m: { id: string }) => m.id)).toContain(meeting.id);

    const marked = await app.inject({ method: 'POST', url: `/internal/meetings/${meeting.id}/reminded`, headers: { 'x-arkanium-secret': INTERNAL_SECRET } });
    expect(marked.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/internal/meetings/due-reminders?hours=24', headers: { 'x-arkanium-secret': INTERNAL_SECRET } });
    expect(after.json().meetings.map((m: { id: string }) => m.id)).not.toContain(meeting.id);
  });
});
