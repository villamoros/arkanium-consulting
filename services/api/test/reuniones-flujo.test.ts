import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { leadDecisionSchema } from '@arkanium/contracts';
import { CalendarSyncError, type CalendarEventRequest, type CalendarGateway } from '../src/calendar/n8n.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, leads, meetings, organizations, suppressions } from '../src/db/schema.js';
import { duplicatesOf, respondToProposal } from '../src/leads/service.js';
import {
  cancelMeeting,
  confirmMeeting,
  createLeadMeeting,
  dueReminders,
  listAllMeetings,
  markReminded,
  proposeMeetingTime,
  rejectMeeting,
  rescheduleMeeting,
  retryCalendar,
} from '../src/meetings/service.js';
import { addSuppression } from '../src/suppressions/service.js';
import { createTestDb } from './support/db.js';

let db: Db;
let close: () => Promise<void>;
let orgId: string;

const START = '2026-10-21T15:00:00.000Z';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(meetings);
  await db.delete(suppressions);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);

  const [org] = await db.insert(organizations).values({ name: 'Empresa Flujo', kind: 'client', clerkOrgId: 'org_FLUJO' }).returning();
  orgId = org!.id;
  await db.insert(contacts).values({ name: 'Ana Cliente', email: 'ana@empresa.test', organizationId: orgId, isPrimary: true });
  await db.insert(leads).values({
    name: 'Luis Prospecto',
    email: 'lead@prospecto.test',
    priorityChoice: 'architecture',
    locale: 'es',
    proposedReason: 'Encaja con arquitectura de datos',
  });
});

/** Calendario falso: registra cada llamada y puede fallar en las escrituras. */
function fakeCalendar(opts: { failWrites?: boolean } = {}) {
  const creates: CalendarEventRequest[] = [];
  const updates: Array<{ eventId: string; startsAt: string; endsAt: string }> = [];
  const cancels: string[] = [];
  const gateway: CalendarGateway = {
    async createEvent(input) {
      creates.push(input);
      return { eventId: `evt_${creates.length}`, htmlLink: 'https://calendar.test/e', meetLink: 'https://meet.test/m' };
    },
    async updateEvent(input) {
      if (opts.failWrites) throw new CalendarSyncError('caído');
      updates.push(input);
      return { htmlLink: 'https://calendar.test/e' };
    },
    async cancelEvent(eventId) {
      if (opts.failWrites) throw new CalendarSyncError('caído');
      cancels.push(eventId);
    },
  };
  return { gateway, creates, updates, cancels };
}

async function requestedMeeting() {
  const [meeting] = await db
    .insert(meetings)
    .values({ organizationId: orgId, topic: 'Avance', requestedBy: 'user_cliente', preferredWindows: ['martes 3 pm'], status: 'solicitada' })
    .returning();
  return meeting!;
}

async function confirmedMeetingWithEvent(startsAt = START) {
  const [meeting] = await db
    .insert(meetings)
    .values({
      organizationId: orgId,
      topic: 'Avance',
      requestedBy: 'user_cliente',
      preferredWindows: [],
      status: 'confirmada',
      startsAt: new Date(startsAt),
      endsAt: new Date(new Date(startsAt).getTime() + 60 * 60_000),
      attendees: ['ana@empresa.test'],
      calendarEventId: 'evt_9',
      calendarStatus: 'sincronizada',
    })
    .returning();
  return meeting!;
}

async function stored(id: string) {
  const [row] = await db.select().from(meetings).where(eq(meetings.id, id));
  return row!;
}

describe('confirmar una reunión', () => {
  it('invita al contacto principal y a los correos extra, sin duplicados, y respeta la duración', async () => {
    const requested = await requestedMeeting();
    const fake = fakeCalendar();
    const { meeting, calendar } = await confirmMeeting(
      db,
      fake.gateway,
      requested.id,
      { startsAt: START, durationMinutes: 90, attendees: ['Socio@Empresa.test', 'ana@empresa.test'] },
      'owner',
    );

    expect(meeting.status).toBe('confirmada');
    expect(meeting.attendees).toEqual(['ana@empresa.test', 'socio@empresa.test']);
    expect(meeting.endsAt?.toISOString()).toBe('2026-10-21T16:30:00.000Z');
    expect(calendar.status).toBe('sincronizada');
    expect(fake.creates[0]).toMatchObject({ attendees: ['ana@empresa.test', 'socio@empresa.test'], meet: true });
  });

  it('no confirma si algún invitado está en la lista de supresión', async () => {
    await addSuppression(db, { email: 'ANA@empresa.test', reason: 'Pidió no recibir mensajes' }, 'owner');
    const requested = await requestedMeeting();
    const fake = fakeCalendar();

    await expect(confirmMeeting(db, fake.gateway, requested.id, { startsAt: START, attendees: [] }, 'owner')).rejects.toMatchObject({ status: 409, code: 'suppressed' });
    expect((await stored(requested.id)).status).toBe('solicitada');
    expect(fake.creates).toHaveLength(0);
  });

  it('reintenta el evento de una reunión confirmada con sincronización pendiente, y no lo repite si ya existe', async () => {
    const requested = await requestedMeeting();
    await confirmMeeting(db, undefined, requested.id, { startsAt: START, attendees: [] }, 'owner');
    expect((await stored(requested.id)).calendarStatus).toBe('no_configurada');

    const fake = fakeCalendar();
    const retried = await retryCalendar(db, fake.gateway, requested.id, 'owner');
    expect(retried.calendar.status).toBe('sincronizada');
    await expect(retryCalendar(db, fake.gateway, requested.id, 'owner')).rejects.toMatchObject({ status: 409 });
  });
});

describe('cancelar y reprogramar', () => {
  it('cancela quitando primero el evento del calendario', async () => {
    const meeting = await confirmedMeetingWithEvent();
    const fake = fakeCalendar();
    const cancelled = await cancelMeeting(db, fake.gateway, meeting.id, 'Se reagenda por fuera', 'owner');

    expect(fake.cancels).toEqual(['evt_9']);
    expect(cancelled).toMatchObject({ status: 'cancelada', calendarStatus: 'cancelada', decisionNote: 'Se reagenda por fuera' });
  });

  it('si el calendario falla al cancelar, la reunión sigue confirmada', async () => {
    const meeting = await confirmedMeetingWithEvent();
    const fake = fakeCalendar({ failWrites: true });

    await expect(cancelMeeting(db, fake.gateway, meeting.id, 'Motivo', 'owner')).rejects.toMatchObject({ status: 502, code: 'calendar_unavailable' });
    expect((await stored(meeting.id)).status).toBe('confirmada');
  });

  it('reprograma el evento existente con la nueva hora y conserva la duración', async () => {
    const meeting = await confirmedMeetingWithEvent();
    const fake = fakeCalendar();
    const { meeting: moved, calendar } = await rescheduleMeeting(db, fake.gateway, meeting.id, { startsAt: '2026-10-22T15:00:00.000Z' }, 'owner');

    expect(fake.updates[0]).toEqual({
      eventId: 'evt_9',
      startsAt: '2026-10-22T15:00:00.000Z',
      endsAt: '2026-10-22T16:00:00.000Z',
      topic: 'Avance',
      attendees: ['ana@empresa.test'],
    });
    expect(moved.startsAt?.toISOString()).toBe('2026-10-22T15:00:00.000Z');
    expect(calendar.status).toBe('sincronizada');
  });

  it('si el calendario falla al reprogramar, la hora no cambia', async () => {
    const meeting = await confirmedMeetingWithEvent();
    const fake = fakeCalendar({ failWrites: true });

    await expect(rescheduleMeeting(db, fake.gateway, meeting.id, { startsAt: '2026-10-22T15:00:00.000Z' }, 'owner')).rejects.toMatchObject({ status: 502 });
    expect((await stored(meeting.id)).startsAt?.toISOString()).toBe(START);
  });
});

describe('rechazar y proponer otra hora', () => {
  it('rechaza una solicitud con su motivo', async () => {
    const requested = await requestedMeeting();
    const rejected = await rejectMeeting(db, requested.id, 'Ese día no hay equipo disponible', 'owner');
    expect(rejected).toMatchObject({ status: 'rechazada', decisionNote: 'Ese día no hay equipo disponible' });
  });

  it('propone otra hora y deja la solicitud pendiente', async () => {
    const requested = await requestedMeeting();
    const proposed = await proposeMeetingTime(db, requested.id, { startsAt: '2026-10-23T14:00:00.000Z', note: 'Mejor el jueves' }, 'owner');
    expect(proposed.status).toBe('solicitada');
    expect(proposed.proposedStartsAt?.toISOString()).toBe('2026-10-23T14:00:00.000Z');
    expect(proposed.decisionNote).toBe('Mejor el jueves');
  });
});

describe('reuniones con leads', () => {
  it('agenda con un lead e invita a su correo', async () => {
    const [lead] = await db.select().from(leads);
    const meeting = await createLeadMeeting(db, lead!.id, { topic: 'Demo del diagnóstico' }, 'owner');
    expect(meeting).toMatchObject({ leadId: lead!.id, organizationId: null });

    const fake = fakeCalendar();
    const { meeting: confirmed } = await confirmMeeting(db, fake.gateway, meeting.id, { startsAt: START, attendees: [] }, 'owner');
    expect(confirmed.attendees).toEqual(['lead@prospecto.test']);

    const agenda = await listAllMeetings(db);
    expect(agenda.find((m) => m.id === meeting.id)).toMatchObject({ kind: 'lead', counterpartName: 'Luis Prospecto' });
  });

  it('no agenda con un lead suprimido', async () => {
    const [lead] = await db.select().from(leads);
    await addSuppression(db, { email: 'lead@prospecto.test', reason: 'Baja solicitada' }, 'owner');
    await expect(createLeadMeeting(db, lead!.id, { topic: 'Demo' }, 'owner')).rejects.toMatchObject({ status: 409, code: 'suppressed' });
  });

  it('acepta la propuesta del agente: el lead queda calificado con su motivo', async () => {
    const [lead] = await db.select().from(leads);
    const updated = await respondToProposal(db, lead!.id, { accepted: true, note: 'Confirmado en la llamada' }, 'owner');
    expect(updated.status).toBe('calificado');
    expect(updated.decisionNote).toBe('Encaja con arquitectura de datos · Confirmado en la llamada');
    const entries = await db.select().from(auditLog).where(eq(auditLog.action, 'lead.propuesta_aceptada'));
    expect(entries).toHaveLength(1);
  });

  it('rechaza la propuesta del agente sin cambiar el estado del lead', async () => {
    const [lead] = await db.select().from(leads);
    const kept = await respondToProposal(db, lead!.id, { accepted: false }, 'owner');
    expect(kept.status).toBe('nuevo');
    const entries = await db.select().from(auditLog).where(eq(auditLog.action, 'lead.propuesta_rechazada'));
    expect(entries).toHaveLength(1);
  });

  it('encuentra otros leads con el mismo correo, sin distinguir mayúsculas', async () => {
    const [lead] = await db.select().from(leads);
    await db.insert(leads).values({ name: 'Luis otra vez', email: 'LEAD@prospecto.test', priorityChoice: 'product', locale: 'es' });
    const duplicates = await duplicatesOf(db, lead!.id);
    expect(duplicates.map((d) => d.name)).toEqual(['Luis otra vez']);
  });
});

describe('posponer con fecha de revisión', () => {
  it('exige la fecha al posponer y no la pide para calificar', () => {
    expect(leadDecisionSchema.safeParse({ decision: 'posponer', reason: 'Esperar presupuesto' }).success).toBe(false);
    expect(leadDecisionSchema.safeParse({ decision: 'posponer', reason: 'Esperar presupuesto', revisitAt: '2026-11-01T15:00:00.000Z' }).success).toBe(true);
    expect(leadDecisionSchema.safeParse({ decision: 'calificar', reason: 'Listo' }).success).toBe(true);
  });
});

describe('recordatorios', () => {
  it('incluye las reuniones confirmadas de las próximas horas hasta que se marcan como enviadas', async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const meeting = await confirmedMeetingWithEvent(soon);

    const before = await dueReminders(db, new Date(), 24);
    expect(before.map((m) => m.id)).toContain(meeting.id);

    await markReminded(db, meeting.id);
    const after = await dueReminders(db, new Date(), 24);
    expect(after.map((m) => m.id)).not.toContain(meeting.id);
  });
});
