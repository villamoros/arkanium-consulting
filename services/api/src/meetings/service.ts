/**
 * F-03, A-04, F-09 y A-05: reuniones. El cliente pide, el owner confirma y publica el acta.
 * Toda reunión tiene acta visible para el cliente cuando el owner la publica (decisión del owner).
 */
import { desc, eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { meetings } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import { recordDecision } from '../decisions/service.js';
import type { MeetingRequest } from '@arkanium/contracts';

export type Meeting = typeof meetings.$inferSelect;

export async function findMeeting(db: Db, id: string): Promise<Meeting> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!meeting) throw new ServiceError(404, 'not_found', 'Reunión no encontrada.');
  return meeting;
}

export async function requestMeeting(db: Db, organizationId: string, input: MeetingRequest, actor: { id: string; role: string }): Promise<Meeting> {
  const [meeting] = await db
    .insert(meetings)
    .values({
      organizationId,
      projectId: input.projectId ?? null,
      topic: input.topic,
      requestedBy: actor.id,
      preferredWindows: input.preferredWindows,
    })
    .returning();
  await recordDecision(db, {
    organizationId,
    projectId: input.projectId ?? null,
    kind: 'solicitud_reunion',
    subjectType: 'meeting',
    subjectId: meeting!.id,
    text: `${input.topic}. Ventanas: ${input.preferredWindows.join('; ') || 'sin preferencia'}`,
    actorId: actor.id,
    actorRole: actor.role,
  });
  await audit(db, { actor: actor.id, action: 'meeting.requested', subjectType: 'meeting', subjectId: meeting!.id, detail: { organizationId } });
  return meeting!;
}

/** F-03: el owner confirma la fecha de una reunión solicitada. */
export async function confirmMeeting(db: Db, id: string, startsAt: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  if (current.status !== 'solicitada') throw new ServiceError(409, 'invalid_state', 'Solo se confirma una reunión solicitada.');
  const [updated] = await db
    .update(meetings)
    .set({ status: 'confirmada', startsAt: new Date(startsAt) })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'meeting.confirmed', subjectType: 'meeting', subjectId: id, detail: { startsAt } });
  return updated!;
}

/** A-05: el owner publica el acta. Queda visible para el cliente. */
export async function publishMinutes(db: Db, id: string, text: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  if (current.status === 'solicitada') throw new ServiceError(409, 'invalid_state', 'Confirma la reunión antes de publicar el acta.');
  const [updated] = await db
    .update(meetings)
    .set({ status: 'realizada', minutesText: text, minutesPublishedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'minutes.published', subjectType: 'meeting', subjectId: id, detail: {} });
  return updated!;
}

export async function listMeetings(db: Db, organizationId: string): Promise<Meeting[]> {
  return db.select().from(meetings).where(eq(meetings.organizationId, organizationId)).orderBy(desc(meetings.createdAt));
}

/** Para el cliente, el acta solo aparece cuando está publicada. */
export function clientMeetingView(meeting: Meeting) {
  return {
    id: meeting.id,
    topic: meeting.topic,
    status: meeting.status,
    startsAt: meeting.startsAt?.toISOString() ?? null,
    minutesText: meeting.minutesPublishedAt ? meeting.minutesText : null,
  };
}
