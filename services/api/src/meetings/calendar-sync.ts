/**
 * Sincroniza una reunión confirmada con Google Calendar (vía n8n) y guarda el resultado en la reunión:
 * id del evento, enlace y estado. Si el calendario no responde, la reunión sigue confirmada y queda «pendiente».
 */
import { eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import { CalendarSyncError, type CalendarGateway } from '../calendar/n8n.js';
import type { Db } from '../db/client.js';
import { meetings } from '../db/schema.js';
import type { Meeting } from './service.js';

/** Duración por defecto de una reunión confirmada, en minutos. */
const DEFAULT_MINUTES = 60;

export type CalendarSync =
  | { status: 'sincronizada'; htmlLink: string; meetLink: string | null }
  | { status: 'pendiente'; reason: string }
  | { status: 'no_configurada' };

export async function syncMeetingToCalendar(db: Db, calendar: CalendarGateway | undefined, meeting: Meeting): Promise<CalendarSync> {
  if (!calendar) {
    await save(db, meeting.id, { calendarStatus: 'no_configurada' });
    return { status: 'no_configurada' };
  }

  const startsAt = meeting.startsAt;
  if (!startsAt) return pending(db, meeting.id, 'La reunión no tiene fecha.');
  if (meeting.attendees.length === 0) return pending(db, meeting.id, 'No hay a quién invitar: la organización no tiene contacto principal ni la reunión tiene lead.');

  const endsAt = meeting.endsAt ?? new Date(startsAt.getTime() + DEFAULT_MINUTES * 60_000);
  try {
    const event = await calendar.createEvent({
      meetingId: meeting.id,
      topic: meeting.topic,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      attendees: meeting.attendees,
      meet: true,
    });
    await save(db, meeting.id, {
      calendarStatus: 'sincronizada',
      calendarEventId: event.eventId,
      calendarLink: event.htmlLink,
      meetLink: event.meetLink,
    });
    await audit(db, { actor: 'calendar', action: 'meeting.calendar_synced', subjectType: 'meeting', subjectId: meeting.id, detail: { eventId: event.eventId } });
    return { status: 'sincronizada', htmlLink: event.htmlLink, meetLink: event.meetLink };
  } catch (error) {
    const reason = error instanceof CalendarSyncError ? error.message : 'Error inesperado al crear el evento.';
    return pending(db, meeting.id, reason);
  }
}

async function pending(db: Db, meetingId: string, reason: string): Promise<CalendarSync> {
  await save(db, meetingId, { calendarStatus: 'pendiente' });
  await audit(db, { actor: 'calendar', action: 'meeting.calendar_pending', subjectType: 'meeting', subjectId: meetingId, detail: { reason } });
  return { status: 'pendiente', reason };
}

async function save(db: Db, meetingId: string, values: Partial<typeof meetings.$inferInsert>) {
  await db.update(meetings).set(values).where(eq(meetings.id, meetingId));
}
