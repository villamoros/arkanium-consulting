import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CalendarSyncError, createN8nCalendar, type CalendarEventRequest, type CalendarGateway } from '../src/calendar/n8n.js';
import { syncMeetingToCalendar } from '../src/meetings/calendar-sync.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, meetings, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';

let db: Db;
let close: () => Promise<void>;
let orgId: string;

const BASE_URL = 'http://n8n.test/webhook';
const SECRET = 'secreto-de-prueba';
const STARTS_AT = new Date('2026-10-21T20:00:00.000Z');

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(meetings);
  await db.delete(contacts);
  await db.delete(organizations);

  const [org] = await db.insert(organizations).values({ name: 'Empresa Calendario', kind: 'client', clerkOrgId: 'org_CALENDARIO' }).returning();
  orgId = org!.id;
  await db.insert(contacts).values({ name: 'Ana Cliente', email: 'ana@empresa.test', organizationId: orgId, isPrimary: true });
});

async function meetingRow(overrides: Partial<typeof meetings.$inferInsert> = {}) {
  const [meeting] = await db
    .insert(meetings)
    .values({ organizationId: orgId, topic: 'Avance del informe', requestedBy: 'user_cliente', preferredWindows: [], status: 'confirmada', startsAt: STARTS_AT, attendees: ['ana@empresa.test'], ...overrides })
    .returning();
  return meeting!;
}

/** Calendario falso: registra lo que recibe y puede fallar a propósito. */
function fakeCalendar(failWith?: string): CalendarGateway & { creates: CalendarEventRequest[] } {
  const creates: CalendarEventRequest[] = [];
  return {
    creates,
    async createEvent(input) {
      creates.push(input);
      if (failWith) throw new CalendarSyncError(failWith);
      return { eventId: 'evt_prueba', htmlLink: 'https://calendar.test/evt_prueba', meetLink: 'https://meet.test/abc' };
    },
    async updateEvent() {
      return { htmlLink: 'https://calendar.test/evt_prueba' };
    },
    async cancelEvent() {},
  };
}

describe('createN8nCalendar', () => {
  it('crea el evento en la ruta de confirmación con el secreto y devuelve el id y el enlace de Meet', async () => {
    const seen: { url?: string; headers?: Record<string, string>; body?: unknown } = {};
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.url = String(url);
      seen.headers = init?.headers as Record<string, string>;
      seen.body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true, eventId: 'evt_1', htmlLink: 'https://calendar.test/evt_1', meetLink: 'https://meet.test/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const calendar = createN8nCalendar({ baseUrl: BASE_URL, secret: SECRET, fetchImpl });
    const result = await calendar.createEvent({ meetingId: 'm1', topic: 'Avance', startsAt: STARTS_AT.toISOString(), endsAt: '2026-10-21T21:00:00.000Z', attendees: ['ana@empresa.test'], meet: true });

    expect(result).toEqual({ eventId: 'evt_1', htmlLink: 'https://calendar.test/evt_1', meetLink: 'https://meet.test/x' });
    expect(seen.url).toBe(`${BASE_URL}/reunion-confirmada`);
    expect(seen.headers?.['X-Arkanium-Secret']).toBe(SECRET);
    expect(seen.body).toMatchObject({ meetingId: 'm1', attendees: ['ana@empresa.test'], meet: true });
  });

  it('reprograma y cancela en sus propias rutas', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ ok: true, htmlLink: 'https://calendar.test/evt_1' }), { status: 200 });
    }) as typeof fetch;

    const calendar = createN8nCalendar({ baseUrl: `${BASE_URL}/`, secret: SECRET, fetchImpl });
    await calendar.updateEvent({ eventId: 'evt_1', startsAt: STARTS_AT.toISOString(), endsAt: STARTS_AT.toISOString() });
    await calendar.cancelEvent('evt_1');
    expect(urls).toEqual([`${BASE_URL}/reunion-reprogramada`, `${BASE_URL}/reunion-cancelada`]);
  });

  it('lanza error si n8n responde con rechazo, si no hay conexión o si no devuelve el evento', async () => {
    const forbidden = createN8nCalendar({ baseUrl: BASE_URL, secret: 'otro', fetchImpl: (async () => new Response('no', { status: 403 })) as typeof fetch });
    await expect(forbidden.createEvent({ meetingId: 'm1', topic: 't', startsAt: STARTS_AT.toISOString(), endsAt: STARTS_AT.toISOString(), attendees: [], meet: false })).rejects.toThrow('n8n respondió 403.');

    const offline = createN8nCalendar({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    await expect(offline.createEvent({ meetingId: 'm1', topic: 't', startsAt: STARTS_AT.toISOString(), endsAt: STARTS_AT.toISOString(), attendees: [], meet: false })).rejects.toBeInstanceOf(CalendarSyncError);

    const empty = createN8nCalendar({ baseUrl: BASE_URL, secret: SECRET, fetchImpl: (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch });
    await expect(empty.createEvent({ meetingId: 'm1', topic: 't', startsAt: STARTS_AT.toISOString(), endsAt: STARTS_AT.toISOString(), attendees: [], meet: false })).rejects.toThrow('n8n no devolvió el evento.');
  });
});

describe('syncMeetingToCalendar', () => {
  it('sin calendario configurado, lo guarda como no configurado', async () => {
    const meeting = await meetingRow();
    const sync = await syncMeetingToCalendar(db, undefined, meeting);
    expect(sync).toEqual({ status: 'no_configurada' });
    const [stored] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(stored!.calendarStatus).toBe('no_configurada');
  });

  it('guarda el id del evento, el enlace y el de Meet cuando se crea', async () => {
    const meeting = await meetingRow();
    const calendar = fakeCalendar();
    const sync = await syncMeetingToCalendar(db, calendar, meeting);

    expect(sync).toEqual({ status: 'sincronizada', htmlLink: 'https://calendar.test/evt_prueba', meetLink: 'https://meet.test/abc' });
    expect(calendar.creates[0]).toMatchObject({ attendees: ['ana@empresa.test'], meet: true });
    const [stored] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(stored).toMatchObject({ calendarStatus: 'sincronizada', calendarEventId: 'evt_prueba', calendarLink: 'https://calendar.test/evt_prueba', meetLink: 'https://meet.test/abc' });
  });

  it('si el calendario falla, queda pendiente y la reunión sigue confirmada', async () => {
    const meeting = await meetingRow();
    const sync = await syncMeetingToCalendar(db, fakeCalendar('n8n respondió 500.'), meeting);

    expect(sync).toEqual({ status: 'pendiente', reason: 'n8n respondió 500.' });
    const [stored] = await db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(stored).toMatchObject({ status: 'confirmada', calendarStatus: 'pendiente' });
  });

  it('sin invitados no llama al calendario y queda pendiente', async () => {
    const meeting = await meetingRow({ attendees: [] });
    const calendar = fakeCalendar();
    const sync = await syncMeetingToCalendar(db, calendar, meeting);
    expect(sync.status).toBe('pendiente');
    expect(calendar.creates).toHaveLength(0);
  });
});
