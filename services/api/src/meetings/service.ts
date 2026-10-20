/**
 * F-03, A-04, F-09 y A-05: reuniones. El cliente pide, el owner confirma, rechaza, propone otra hora,
 * reprograma o cancela, y publica el acta. Nada se agenda sin confirmación del owner.
 * Una reunión puede ser con un cliente (organización) o con un lead todavía sin convertir.
 * El owner también puede crear, editar y eliminar reuniones a mano, por si n8n o Calendar fallan.
 */
import { and, desc, eq, inArray, isNull, like } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { CalendarGateway } from '../calendar/n8n.js';
import type { Db } from '../db/client.js';
import { auditLog, contacts, leads, meetings, organizations, projects, suppressions } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import { recordDecision } from '../decisions/service.js';
import { syncMeetingToCalendar, type CalendarSync } from './calendar-sync.js';
import type { LeadMeeting, MeetingConfirm, MeetingDelete, MeetingManual, MeetingPropose, MeetingRequest, MeetingReschedule, MeetingUpdate } from '@arkanium/contracts';

export type Meeting = typeof meetings.$inferSelect;

/** Duración por defecto de una reunión, en minutos. */
const DEFAULT_MINUTES = 60;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Reunión visible: las eliminadas (borrado lógico) no existen para la app. */
export async function findMeeting(db: Db, id: string): Promise<Meeting> {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), isNull(meetings.deletedAt)));
  if (!meeting) throw new ServiceError(404, 'not_found', 'Reunión no encontrada.');
  return meeting;
}

function requireStatus(meeting: Meeting, allowed: Meeting['status'][], message: string) {
  if (!allowed.includes(meeting.status)) throw new ServiceError(409, 'invalid_state', message);
}

/** Invitados de la reunión: el contacto principal del cliente o el lead, y los correos que añadió el owner. */
export async function resolveInvitees(db: Db, meeting: Pick<Meeting, 'leadId' | 'organizationId'>, extra: string[]): Promise<string[]> {
  let primary: string | undefined;
  if (meeting.leadId) {
    const [lead] = await db.select({ email: leads.email }).from(leads).where(eq(leads.id, meeting.leadId));
    primary = lead?.email;
  } else if (meeting.organizationId) {
    const [contact] = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.organizationId, meeting.organizationId), eq(contacts.isPrimary, true)));
    primary = contact?.email;
  }
  return [...new Set([primary, ...extra].filter((email): email is string => Boolean(email)).map(normalizeEmail))];
}

/** Ningún contacto va a un correo que está en la lista de supresión. */
export async function assertNotSuppressed(db: Db, emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const rows = await db.select({ email: suppressions.email }).from(suppressions).where(inArray(suppressions.email, emails));
  if (rows.length > 0) {
    throw new ServiceError(409, 'suppressed', `No podemos contactar a ${rows.map((row) => row.email).join(', ')}: están en la lista de supresión.`);
  }
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

/** Reunión con un lead (prospecto). El owner la pide; se confirma igual que las de clientes. */
export async function createLeadMeeting(db: Db, leadId: string, input: LeadMeeting, ownerId: string): Promise<Meeting> {
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, leadId), isNull(leads.deletedAt)));
  if (!lead) throw new ServiceError(404, 'not_found', 'Lead no encontrado.');
  if (lead.status === 'descartado') throw new ServiceError(409, 'invalid_state', 'No se agenda una reunión con un lead descartado.');
  if (lead.status === 'convertido') throw new ServiceError(409, 'invalid_state', 'El lead ya es cliente: agenda la reunión desde su organización.');
  await assertNotSuppressed(db, [normalizeEmail(lead.email)]);

  const [meeting] = await db
    .insert(meetings)
    .values({ leadId, organizationId: null, topic: input.topic, requestedBy: ownerId, preferredWindows: [] })
    .returning();
  await audit(db, { actor: ownerId, action: 'meeting.requested', subjectType: 'meeting', subjectId: meeting!.id, detail: { leadId } });
  return meeting!;
}

/** F-03: el owner confirma la fecha. Crea el evento y guarda el resultado de la sincronización. */
export async function confirmMeeting(db: Db, calendar: CalendarGateway | undefined, id: string, input: MeetingConfirm, actor: string): Promise<{ meeting: Meeting; calendar: CalendarSync }> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['solicitada'], 'Solo se confirma una reunión solicitada.');

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + (input.durationMinutes ?? DEFAULT_MINUTES) * 60_000);
  const attendees = await resolveInvitees(db, current, input.attendees);
  await assertNotSuppressed(db, attendees);

  const [updated] = await db
    .update(meetings)
    .set({ status: 'confirmada', startsAt, endsAt, attendees })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'meeting.confirmed', subjectType: 'meeting', subjectId: id, detail: { startsAt: startsAt.toISOString(), attendees } });

  // La confirmación ya quedó guardada; si el calendario falla, se informa aparte y no se revierte.
  const sync = await syncMeetingToCalendar(db, calendar, updated!);
  return { meeting: await findMeeting(db, id), calendar: sync };
}

/** Reintenta crear el evento de una reunión confirmada cuya sincronización quedó pendiente. */
export async function retryCalendar(db: Db, calendar: CalendarGateway | undefined, id: string, actor: string): Promise<{ meeting: Meeting; calendar: CalendarSync }> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['confirmada'], 'Solo se sincroniza una reunión confirmada.');
  if (current.calendarStatus === 'sincronizada') throw new ServiceError(409, 'invalid_state', 'La reunión ya está en el calendario.');
  if (current.calendarEventId) throw new ServiceError(409, 'invalid_state', 'La reunión ya tiene evento en el calendario: cambia la hora desde reprogramar.');
  await audit(db, { actor, action: 'meeting.calendar_retry', subjectType: 'meeting', subjectId: id, detail: {} });
  const sync = await syncMeetingToCalendar(db, calendar, current);
  return { meeting: await findMeeting(db, id), calendar: sync };
}

/** El owner rechaza la solicitud. El motivo queda en la reunión y en la bitácora. */
export async function rejectMeeting(db: Db, id: string, reason: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['solicitada'], 'Solo se rechaza una solicitud pendiente.');
  const [updated] = await db.update(meetings).set({ status: 'rechazada', decisionNote: reason }).where(eq(meetings.id, id)).returning();
  await audit(db, { actor, action: 'meeting.rejected', subjectType: 'meeting', subjectId: id, detail: { reason } });
  return updated!;
}

/** El owner no acepta la hora pedida y propone otra. La solicitud sigue pendiente hasta que se confirme. */
export async function proposeMeetingTime(db: Db, id: string, input: MeetingPropose, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['solicitada'], 'Solo se propone otra hora para una solicitud pendiente.');
  const [updated] = await db
    .update(meetings)
    .set({ proposedStartsAt: new Date(input.startsAt), decisionNote: input.note ?? null })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'meeting.proposed', subjectType: 'meeting', subjectId: id, detail: { startsAt: input.startsAt, note: input.note ?? null } });
  return updated!;
}

/**
 * Cancela una reunión confirmada. Primero se quita el evento del calendario; si eso falla,
 * la reunión sigue confirmada, para que el calendario y la app no se contradigan.
 */
export async function cancelMeeting(db: Db, calendar: CalendarGateway | undefined, id: string, reason: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['confirmada'], 'Solo se cancela una reunión confirmada.');

  if (current.calendarEventId) {
    if (!calendar) throw new ServiceError(502, 'calendar_unavailable', 'El calendario no está configurado; la reunión sigue confirmada.');
    try {
      await calendar.cancelEvent(current.calendarEventId);
    } catch {
      throw new ServiceError(502, 'calendar_unavailable', 'No pudimos quitar el evento del calendario; la reunión sigue confirmada. Intenta de nuevo.');
    }
  }

  const [updated] = await db
    .update(meetings)
    .set({ status: 'cancelada', decisionNote: reason, calendarStatus: 'cancelada' })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'meeting.cancelled', subjectType: 'meeting', subjectId: id, detail: { reason } });
  return updated!;
}

/**
 * Reprograma una reunión confirmada. Si ya tiene evento, el evento se actualiza primero; si no lo tiene
 * (sincronización pendiente), se intenta crear con la nueva hora. Si el calendario falla, la hora no cambia.
 */
export async function rescheduleMeeting(db: Db, calendar: CalendarGateway | undefined, id: string, input: MeetingReschedule, actor: string): Promise<{ meeting: Meeting; calendar: CalendarSync }> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['confirmada'], 'Solo se reprograma una reunión confirmada.');

  const startsAt = new Date(input.startsAt);
  const minutes = input.durationMinutes ?? (current.startsAt && current.endsAt ? Math.round((current.endsAt.getTime() - current.startsAt.getTime()) / 60_000) : DEFAULT_MINUTES);
  const endsAt = new Date(startsAt.getTime() + minutes * 60_000);

  if (current.calendarEventId) {
    if (!calendar) throw new ServiceError(502, 'calendar_unavailable', 'El calendario no está configurado; la hora no cambió.');
    try {
      await calendar.updateEvent({ eventId: current.calendarEventId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), topic: current.topic, attendees: current.attendees as string[] });
    } catch {
      throw new ServiceError(502, 'calendar_unavailable', 'No pudimos actualizar el evento del calendario; la hora no cambió. Intenta de nuevo.');
    }
  }

  const [updated] = await db.update(meetings).set({ startsAt, endsAt }).where(eq(meetings.id, id)).returning();
  await audit(db, { actor, action: 'meeting.rescheduled', subjectType: 'meeting', subjectId: id, detail: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } });

  if (current.calendarEventId) {
    return { meeting: updated!, calendar: { status: 'sincronizada', htmlLink: current.calendarLink ?? '', meetLink: current.meetLink } };
  }
  const sync = await syncMeetingToCalendar(db, calendar, updated!);
  return { meeting: await findMeeting(db, id), calendar: sync };
}

/** A-05: el owner crea el acta de una reunión que ya empezó. Queda visible para el cliente. */
export async function createMinutes(db: Db, id: string, text: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['confirmada', 'realizada'], 'Solo se crea el acta de una reunión confirmada.');
  // El acta describe lo que pasó: no se crea antes de la hora de la reunión.
  if (!current.startsAt || current.startsAt.getTime() > Date.now()) {
    throw new ServiceError(409, 'invalid_state', 'La reunión todavía no ha empezado: el acta se crea después de la hora de la reunión.');
  }
  if (current.minutesPublishedAt) {
    throw new ServiceError(409, 'invalid_state', 'Esta reunión ya tiene acta. Edítala desde su apartado.');
  }
  const [updated] = await db
    .update(meetings)
    .set({ status: 'realizada', minutesText: text, minutesPublishedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning();
  await audit(db, { actor, action: 'minutes.created', subjectType: 'meeting', subjectId: id, detail: { text } });
  return updated!;
}

/** Edita el acta existente. La bitácora guarda el texto anterior y el nuevo. */
export async function updateMinutes(db: Db, id: string, text: string, actor: string): Promise<Meeting> {
  const current = await findMeeting(db, id);
  if (!current.minutesPublishedAt) throw new ServiceError(409, 'invalid_state', 'Esta reunión no tiene acta que editar.');
  const [updated] = await db.update(meetings).set({ minutesText: text }).where(eq(meetings.id, id)).returning();
  await audit(db, { actor, action: 'minutes.edited', subjectType: 'meeting', subjectId: id, detail: { previousText: current.minutesText, text } });
  return updated!;
}

/**
 * Elimina el acta: deja de verla el cliente y la reunión queda sin acta. No se borra de la bitácora:
 * el texto eliminado queda guardado en el registro de la acción.
 */
export async function deleteMinutes(db: Db, id: string, actor: string): Promise<void> {
  const current = await findMeeting(db, id);
  if (!current.minutesPublishedAt) throw new ServiceError(409, 'invalid_state', 'Esta reunión no tiene acta que eliminar.');
  await db.update(meetings).set({ minutesText: null, minutesPublishedAt: null }).where(eq(meetings.id, id));
  await audit(db, { actor, action: 'minutes.deleted', subjectType: 'meeting', subjectId: id, detail: { previousText: current.minutesText } });
}

/** Historial del acta de una reunión, del más reciente al más antiguo, leído de la bitácora. */
export async function minutesHistory(db: Db, id: string) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.subjectType, 'meeting'), eq(auditLog.subjectId, id), like(auditLog.action, 'minutes.%')))
    .orderBy(desc(auditLog.at));
  return rows.map((row) => {
    const detail = row.detail as Record<string, unknown>;
    return {
      id: row.id,
      action: row.action,
      at: row.at.toISOString(),
      actor: row.actor,
      text: typeof detail.text === 'string' ? detail.text : null,
      previousText: typeof detail.previousText === 'string' ? detail.previousText : null,
    };
  });
}

/** Clientes para elegir al crear una reunión a mano. */
export async function listClientOrganizations(db: Db) {
  const clients = await db
    .select({ id: organizations.id, name: organizations.name, status: organizations.status, clerkOrgId: organizations.clerkOrgId })
    .from(organizations)
    .where(eq(organizations.kind, 'client'))
    .orderBy(organizations.name);
  // Proyectos activos (no archivados) de cada cliente, para la lista de Clientes.
  const active = await db.select({ organizationId: projects.organizationId }).from(projects).where(isNull(projects.archivedAt));
  return clients.map((client) => ({ ...client, projectCount: active.filter((p) => p.organizationId === client.id).length }));
}

/**
 * Owner: crea una reunión a mano. Sin fecha queda como solicitud. Con fecha queda confirmada y se intenta
 * el evento: si n8n o Calendar fallan, la reunión queda confirmada con el calendario «pendiente» y se reintenta después.
 */
export async function createManualMeeting(db: Db, calendar: CalendarGateway | undefined, input: MeetingManual, ownerId: string): Promise<{ meeting: Meeting; calendar: CalendarSync | null }> {
  let organizationId: string | null = null;
  let leadId: string | null = null;

  if (input.kind === 'cliente') {
    const [organization] = await db.select({ id: organizations.id, kind: organizations.kind }).from(organizations).where(eq(organizations.id, input.organizationId!));
    if (!organization || organization.kind !== 'client') throw new ServiceError(404, 'not_found', 'Cliente no encontrado.');
    organizationId = organization.id;
  } else {
    const [lead] = await db.select().from(leads).where(and(eq(leads.id, input.leadId!), isNull(leads.deletedAt)));
    if (!lead) throw new ServiceError(404, 'not_found', 'Lead no encontrado.');
    if (lead.status === 'descartado' || lead.status === 'convertido') {
      throw new ServiceError(409, 'invalid_state', 'Solo se agenda con un lead activo; si ya es cliente, usa su organización.');
    }
    leadId = lead.id;
  }

  const [row] = await db
    .insert(meetings)
    .values({ organizationId, leadId, topic: input.topic, requestedBy: ownerId, preferredWindows: [] })
    .returning();
  await audit(db, { actor: ownerId, action: 'meeting.created_manual', subjectType: 'meeting', subjectId: row!.id, detail: { kind: input.kind } });

  if (!input.startsAt) return { meeting: row!, calendar: null };
  const confirmed = await confirmMeeting(db, calendar, row!.id, { startsAt: input.startsAt, durationMinutes: input.durationMinutes, attendees: input.attendees }, ownerId);
  return confirmed;
}

/**
 * Owner: corrige una reunión a mano (tema, invitados, hora y duración). Si la reunión ya tiene evento,
 * cualquier cambio de tema, invitados u hora se aplica primero al evento de Calendar: si falla, no se guarda nada.
 * Sin evento, se guarda y, con fecha confirmada, se intenta crear el evento (salvo skipCalendar).
 */
export async function updateMeeting(db: Db, calendar: CalendarGateway | undefined, id: string, input: MeetingUpdate, actor: string): Promise<{ meeting: Meeting; calendar: CalendarSync | null }> {
  const current = await findMeeting(db, id);
  requireStatus(current, ['solicitada', 'confirmada'], 'Solo se edita una reunión pendiente o confirmada.');
  if (input.startsAt !== undefined) requireStatus(current, ['confirmada'], 'Para dar fecha a una solicitud, confírmala.');

  const values: Partial<typeof meetings.$inferInsert> = {};
  if (input.topic !== undefined) values.topic = input.topic;
  let attendees = current.attendees as string[];
  if (input.attendees !== undefined) {
    attendees = await resolveInvitees(db, current, input.attendees);
    await assertNotSuppressed(db, attendees);
    values.attendees = attendees;
  }

  let startsAt = current.startsAt;
  let endsAt = current.endsAt;
  if (input.startsAt !== undefined) {
    startsAt = new Date(input.startsAt);
    const minutes = input.durationMinutes ?? (current.startsAt && current.endsAt ? Math.round((current.endsAt.getTime() - current.startsAt.getTime()) / 60_000) : DEFAULT_MINUTES);
    endsAt = new Date(startsAt.getTime() + minutes * 60_000);
    values.startsAt = startsAt;
    values.endsAt = endsAt;
  }

  const eventChanged = input.startsAt !== undefined || input.topic !== undefined || input.attendees !== undefined;
  if (current.calendarEventId && eventChanged) {
    if (!calendar) throw new ServiceError(502, 'calendar_unavailable', 'El calendario no está configurado; no se guardó ningún cambio.');
    if (!startsAt || !endsAt || attendees.length === 0) {
      throw new ServiceError(409, 'invalid_state', 'Un evento de Calendar necesita fecha e invitados: agrega un correo antes de guardar.');
    }
    const topic = values.topic ?? current.topic;
    try {
      await calendar.updateEvent({ eventId: current.calendarEventId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), topic, attendees });
    } catch {
      throw new ServiceError(502, 'calendar_unavailable', 'No pudimos actualizar el evento en Calendar; no se guardó ningún cambio. Intenta de nuevo.');
    }
  }

  const [updated] = await db.update(meetings).set(values).where(eq(meetings.id, id)).returning();
  await audit(db, { actor, action: 'meeting.updated', subjectType: 'meeting', subjectId: id, detail: { fields: Object.keys(values) } });

  // Sin evento y con fecha: se intenta crear con los datos ya guardados, salvo que se pida no tocar el calendario.
  const needsEvent = updated!.status === 'confirmada' && !updated!.calendarEventId && Boolean(updated!.startsAt);
  if (needsEvent && !input.skipCalendar) {
    const sync = await syncMeetingToCalendar(db, calendar, updated!);
    return { meeting: await findMeeting(db, id), calendar: sync };
  }
  return { meeting: await findMeeting(db, id), calendar: null };
}

/**
 * Owner: elimina una reunión (borrado lógico: el registro y la bitácora se conservan).
 * Primero quita el evento de Calendar. Si no puede hacerlo, no elimina, salvo con force: en ese caso
 * el evento queda en Calendar y hay que quitarlo a mano.
 */
export async function deleteMeeting(db: Db, calendar: CalendarGateway | undefined, id: string, input: MeetingDelete, actor: string): Promise<{ eventLeft: boolean }> {
  const current = await findMeeting(db, id);
  let eventLeft = false;

  if (current.calendarEventId) {
    if (!calendar) {
      if (!input.force) throw new ServiceError(502, 'calendar_unavailable', 'El calendario no está configurado: no se puede quitar el evento. Puedes eliminar con «forzar» y quitarlo a mano.');
      eventLeft = true;
    } else {
      try {
        await calendar.cancelEvent(current.calendarEventId);
      } catch {
        if (!input.force) {
          throw new ServiceError(502, 'calendar_unavailable', 'No pudimos quitar el evento del calendario, así que no se eliminó la reunión. Intenta de nuevo, o elimina con «forzar» y quita el evento a mano.');
        }
        eventLeft = true;
      }
    }
  }

  await db.update(meetings).set({ deletedAt: new Date(), decisionNote: input.reason }).where(eq(meetings.id, id));
  await audit(db, { actor, action: 'meeting.deleted', subjectType: 'meeting', subjectId: id, detail: { reason: input.reason, eventLeft } });
  return { eventLeft };
}

export async function listMeetings(db: Db, organizationId: string): Promise<Meeting[]> {
  return db
    .select()
    .from(meetings)
    .where(and(eq(meetings.organizationId, organizationId), isNull(meetings.deletedAt)))
    .orderBy(desc(meetings.createdAt));
}

/** Vista del owner: la reunión con su contraparte (cliente o lead) y el estado del calendario. */
export function ownerMeetingView(meeting: Meeting, counterpart: string | null) {
  return {
    id: meeting.id,
    kind: meeting.organizationId ? ('cliente' as const) : ('lead' as const),
    organizationId: meeting.organizationId,
    leadId: meeting.leadId,
    counterpartName: counterpart,
    projectId: meeting.projectId,
    topic: meeting.topic,
    status: meeting.status,
    requestedBy: meeting.requestedBy,
    preferredWindows: meeting.preferredWindows as string[],
    startsAt: meeting.startsAt?.toISOString() ?? null,
    endsAt: meeting.endsAt?.toISOString() ?? null,
    attendees: meeting.attendees as string[],
    proposedStartsAt: meeting.proposedStartsAt?.toISOString() ?? null,
    decisionNote: meeting.decisionNote,
    calendarStatus: meeting.calendarStatus,
    calendarLink: meeting.calendarLink,
    meetLink: meeting.meetLink,
    minutesPublished: meeting.minutesPublishedAt !== null,
    minutesText: meeting.minutesPublishedAt ? meeting.minutesText : null,
    requestedAt: meeting.createdAt.toISOString(),
  };
}

/** Core: la agenda del owner con todas las reuniones visibles, de clientes y de leads. */
export async function listAllMeetings(db: Db) {
  const rows = await db
    .select({ meeting: meetings, orgName: organizations.name, leadName: leads.name })
    .from(meetings)
    .leftJoin(organizations, eq(meetings.organizationId, organizations.id))
    .leftJoin(leads, eq(meetings.leadId, leads.id))
    .where(isNull(meetings.deletedAt))
    .orderBy(desc(meetings.createdAt));
  return rows.map((row) => ownerMeetingView(row.meeting, row.orgName ?? row.leadName ?? null));
}

/** Reuniones confirmadas que empiezan dentro de las próximas horas y aún no tienen recordatorio enviado. */
export async function dueReminders(db: Db, now: Date, hours: number) {
  const limit = new Date(now.getTime() + hours * 60 * 60_000);
  const rows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.status, 'confirmada'), isNull(meetings.remindedAt), isNull(meetings.deletedAt)));
  return rows
    .filter((meeting) => meeting.startsAt && meeting.startsAt >= now && meeting.startsAt <= limit)
    .map((meeting) => ({
      id: meeting.id,
      topic: meeting.topic,
      startsAt: meeting.startsAt!.toISOString(),
      attendees: meeting.attendees as string[],
      meetLink: meeting.meetLink,
      calendarLink: meeting.calendarLink,
    }));
}

/** Marca el recordatorio como enviado para no repetirlo. */
export async function markReminded(db: Db, id: string): Promise<void> {
  await findMeeting(db, id);
  await db.update(meetings).set({ remindedAt: new Date() }).where(eq(meetings.id, id));
  await audit(db, { actor: 'reminders', action: 'meeting.reminded', subjectType: 'meeting', subjectId: id, detail: {} });
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
