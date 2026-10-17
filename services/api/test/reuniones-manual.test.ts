import { eq } from 'drizzle-orm';
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

/** Fallos controlables: simulan que n8n o Calendar no responden en cada operación. */
const flags = { createFails: false, updateFails: false, cancelFails: false };
const calls = { creates: 0, updates: 0, cancels: 0 };

const calendar: CalendarGateway = {
  async createEvent() {
    calls.creates += 1;
    if (flags.createFails) throw new CalendarSyncError('n8n respondió 500.');
    return { eventId: `evt_manual_${calls.creates}`, htmlLink: 'https://calendar.test/manual', meetLink: 'https://meet.test/manual' };
  },
  async updateEvent() {
    calls.updates += 1;
    if (flags.updateFails) throw new CalendarSyncError('n8n respondió 500.');
    return { htmlLink: 'https://calendar.test/manual' };
  },
  async cancelEvent() {
    calls.cancels += 1;
    if (flags.cancelFails) throw new CalendarSyncError('n8n respondió 500.');
  },
};

const FUTURE = '2026-12-01T15:00:00.000Z';
const LATER = '2026-12-02T15:00:00.000Z';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  Object.assign(flags, { createFails: false, updateFails: false, cancelFails: false });
  calls.creates = 0;
  calls.updates = 0;
  calls.cancels = 0;

  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(meetings);
  await db.delete(suppressions);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Manual', kind: 'client', clerkOrgId: CLIENT }).returning();
  clientOrgId = client!.id;
  await db.insert(contacts).values({ name: 'Ana Cliente', email: 'ana@empresa.test', organizationId: clientOrgId, isPrimary: true });

  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, calendar });
});

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

async function manualMeeting(startsAt?: string) {
  const response = await call('POST', '/meetings/manual', 'token-owner', { kind: 'cliente', organizationId: clientOrgId, topic: 'Reunión manual', startsAt, attendees: [] });
  expect(response.statusCode).toBe(201);
  return response.json();
}

describe('crear a mano', () => {
  it('con fecha y calendario disponible queda confirmada y sincronizada', async () => {
    const created = await manualMeeting(FUTURE);
    expect(created).toMatchObject({ status: 'confirmada', calendarStatus: 'sincronizada', kind: 'cliente' });
    expect(created.attendees).toEqual(['ana@empresa.test']);
  });

  it('si n8n no responde, queda confirmada con el calendario pendiente y se reintenta después', async () => {
    flags.createFails = true;
    const created = await manualMeeting(FUTURE);
    expect(created).toMatchObject({ status: 'confirmada', calendarStatus: 'pendiente' });
    expect(created.calendar.status).toBe('pendiente');

    flags.createFails = false;
    const retried = await call('POST', `/meetings/${created.id}/calendar/retry`, 'token-owner');
    expect(retried.statusCode).toBe(200);
    expect(retried.json()).toMatchObject({ calendarStatus: 'sincronizada' });
  });

  it('sin fecha queda como solicitud y no toca el calendario', async () => {
    const created = await manualMeeting();
    expect(created.status).toBe('solicitada');
    expect(calls.creates).toBe(0);
  });

  it('un lead descartado no admite reuniones a mano, y un cliente inexistente responde 404', async () => {
    const [lead] = await db.insert(leads).values({ name: 'Lead descartado', email: 'd@prospecto.test', priorityChoice: 'product', locale: 'es', status: 'descartado' }).returning();
    const forLead = await call('POST', '/meetings/manual', 'token-owner', { kind: 'lead', leadId: lead!.id, topic: 'Demo', attendees: [] });
    expect(forLead.statusCode).toBe(409);

    const unknown = await call('POST', '/meetings/manual', 'token-owner', { kind: 'cliente', organizationId: '00000000-0000-4000-8000-000000000000', topic: 'X', attendees: [] });
    expect(unknown.statusCode).toBe(404);
  });
});

describe('corregir a mano', () => {
  it('cambiar el tema y los invitados llega al evento de Calendar con la lista completa', async () => {
    const created = await manualMeeting(FUTURE);
    const updated = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { topic: 'Tema corregido', attendees: ['socio@empresa.test'] });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ topic: 'Tema corregido', attendees: ['ana@empresa.test', 'socio@empresa.test'] });
    expect(calls.updates).toBe(1);
  });

  it('si Calendar no responde al cambiar tema o invitados, no se guarda nada', async () => {
    const created = await manualMeeting(FUTURE);
    flags.updateFails = true;
    const failed = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { topic: 'No debe guardarse' });
    expect(failed.statusCode).toBe(502);
    const [row] = await db.select().from(meetings).where(eq(meetings.id, created.id));
    expect(row!.topic).toBe('Reunión manual');
  });

  it('cambiar la hora con un evento existente pasa por el calendario; si falla, la hora no cambia', async () => {
    const created = await manualMeeting(FUTURE);
    flags.updateFails = true;
    const failed = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { startsAt: LATER });
    expect(failed.statusCode).toBe(502);
    const [unchanged] = await db.select().from(meetings).where(eq(meetings.id, created.id));
    expect(unchanged!.startsAt?.toISOString()).toBe(FUTURE);
  });

  it('sin evento y con el calendario caído, se guarda la hora con skipCalendar; sin skip, queda pendiente', async () => {
    flags.createFails = true;
    const created = await manualMeeting();
    const confirmed = await call('POST', `/meetings/${created.id}/confirm`, 'token-owner', { startsAt: FUTURE, attendees: [] });
    expect(confirmed.statusCode).toBe(200);

    const saved = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { startsAt: LATER, skipCalendar: true });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().startsAt).toBe(LATER);
    expect(saved.json().calendar).toBeNull();

    const pending = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { startsAt: FUTURE });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().calendar.status).toBe('pendiente');
  });

  it('un cambio vacío responde 400', async () => {
    const created = await manualMeeting(FUTURE);
    const empty = await call('PATCH', `/meetings/${created.id}`, 'token-owner', { skipCalendar: true });
    expect(empty.statusCode).toBe(400);
  });
});

describe('eliminar a mano', () => {
  it('si el calendario no puede quitar el evento, no elimina salvo con force', async () => {
    const created = await manualMeeting(FUTURE);
    flags.cancelFails = true;

    const blocked = await call('DELETE', `/meetings/${created.id}`, 'token-owner', { reason: 'Duplicada' });
    expect(blocked.statusCode).toBe(502);
    const stillThere = await call('GET', '/meetings', 'token-owner');
    expect(stillThere.json().meetings.map((m: { id: string }) => m.id)).toContain(created.id);

    const forced = await call('DELETE', `/meetings/${created.id}`, 'token-owner', { reason: 'Duplicada', force: true });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().eventLeft).toBe(true);
  });

  it('eliminar es borrado lógico: sale de la agenda, pero el registro y la bitácora se conservan', async () => {
    const created = await manualMeeting();
    const deleted = await call('DELETE', `/meetings/${created.id}`, 'token-owner', { reason: 'Creada por error' });
    expect(deleted.statusCode).toBe(200);

    const agenda = await call('GET', '/meetings', 'token-owner');
    expect(agenda.json().meetings.map((m: { id: string }) => m.id)).not.toContain(created.id);

    const [row] = await db.select().from(meetings).where(eq(meetings.id, created.id));
    expect(row!.deletedAt).not.toBeNull();
    const entries = await db.select().from(auditLog).where(eq(auditLog.action, 'meeting.deleted'));
    expect(entries).toHaveLength(1);
  });

  it('el cliente no puede eliminar, editar ni crear a mano', async () => {
    const created = await manualMeeting(FUTURE);
    expect((await call('DELETE', `/meetings/${created.id}`, 'token-client', { reason: 'no' })).statusCode).toBe(403);
    expect((await call('PATCH', `/meetings/${created.id}`, 'token-client', { topic: 'no' })).statusCode).toBe(403);
    expect((await call('POST', '/meetings/manual', 'token-client', { kind: 'cliente', organizationId: clientOrgId, topic: 'no', attendees: [] })).statusCode).toBe(403);
  });
});

describe('lista de clientes para el formulario', () => {
  it('el owner ve solo organizaciones de cliente', async () => {
    const response = await call('GET', '/client-organizations', 'token-owner');
    expect(response.statusCode).toBe(200);
    expect(response.json().organizations.map((o: { name: string }) => o.name)).toEqual(['Empresa Manual']);
  });
});
