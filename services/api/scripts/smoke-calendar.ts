/**
 * Prueba de humo del calendario: recorre el ciclo completo con los servicios reales de la API y n8n.
 *   confirmar → reprogramar → cancelar → revisar la agenda que lee la app.
 * Además comprueba el camino de error: con un secreto incorrecto, la reunión queda «pendiente» y no se pierde.
 *
 * Uso (con n8n encendido y services/api/.env.local configurado):
 *   pnpm smoke:calendar
 *
 * Crea una organización y una reunión marcadas «PRUEBA smoke». Los eventos de Calendar se cancelan al final.
 * Cada corrida envía invitaciones de prueba al correo indicado en SMOKE_INVITEE (por defecto, el del owner).
 */
import { eq } from 'drizzle-orm';
import { createN8nCalendar } from '../src/calendar/n8n.js';
import { createDb } from '../src/db/client.js';
import { contacts, meetings, organizations } from '../src/db/schema.js';
import { cancelMeeting, confirmMeeting, listAllMeetings, rescheduleMeeting, updateMeeting } from '../src/meetings/service.js';

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
const secret = process.env.N8N_WEBHOOK_SECRET;
const invitee = process.env.SMOKE_INVITEE ?? 'juancarlosvillamorosgonzalez@gmail.com';

if (!databaseUrl || !baseUrl || !secret) {
  console.error('Faltan DATABASE_URL, N8N_WEBHOOK_BASE_URL o N8N_WEBHOOK_SECRET en services/api/.env.local.');
  process.exit(2);
}

const db = createDb(databaseUrl);
const calendar = createN8nCalendar({ baseUrl, secret });
const stamp = Date.now();
const results: Array<{ step: string; ok: boolean; detail: string }> = [];

function check(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASA ' : 'FALLA'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

/** Fecha futura a una hora fija (UTC), para que el evento caiga en un horario razonable. */
function futureAt(days: number, hourUtc: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

async function main() {
  const [org] = await db
    .insert(organizations)
    .values({ name: `PRUEBA smoke ${stamp}`, kind: 'client', clerkOrgId: `org_SMOKE_${stamp}` })
    .returning();
  await db.insert(contacts).values({ name: 'PRUEBA smoke', email: invitee, organizationId: org!.id, isPrimary: true });

  const [requested] = await db
    .insert(meetings)
    .values({ organizationId: org!.id, topic: `PRUEBA smoke de calendario ${stamp}`, requestedBy: 'smoke', preferredWindows: [], status: 'solicitada' })
    .returning();
  const id = requested!.id;

  // 1. Confirmar: crea el evento con Meet e invita al contacto principal.
  const confirmed = await confirmMeeting(db, calendar, id, { startsAt: futureAt(2, 15), durationMinutes: 30, attendees: [] }, 'smoke');
  check('Confirmar: la reunión pasa a confirmada', confirmed.meeting.status === 'confirmada', confirmed.meeting.status);
  check('Confirmar: n8n crea el evento', confirmed.calendar.status === 'sincronizada', confirmed.calendar.status === 'pendiente' ? confirmed.calendar.reason : confirmed.calendar.status);
  const afterCreate = (await db.select().from(meetings).where(eq(meetings.id, id)))[0]!;
  check('Confirmar: el id del evento queda guardado', Boolean(afterCreate.calendarEventId), afterCreate.calendarEventId ?? 'sin id');
  check('Confirmar: el enlace de Meet queda guardado', Boolean(afterCreate.meetLink), afterCreate.meetLink ?? 'sin enlace (revisa conferenceDataUi en n8n)');
  check('Confirmar: el invitado es el contacto principal', afterCreate.attendees.includes(invitee.toLowerCase()), afterCreate.attendees.join(', '));

  // 2. Reprogramar: actualiza el mismo evento.
  const newStart = futureAt(3, 16);
  const moved = await rescheduleMeeting(db, calendar, id, { startsAt: newStart, durationMinutes: 45 }, 'smoke');
  check('Reprogramar: n8n actualiza el evento', moved.calendar.status === 'sincronizada', moved.calendar.status === 'pendiente' ? moved.calendar.reason : moved.calendar.status);
  check('Reprogramar: la nueva hora queda guardada', moved.meeting.startsAt?.toISOString() === newStart, moved.meeting.startsAt?.toISOString() ?? 'sin hora');
  check('Reprogramar: la duración se conserva en la nueva hora', moved.meeting.endsAt?.getTime() === new Date(newStart).getTime() + 45 * 60_000, moved.meeting.endsAt?.toISOString() ?? 'sin fin');

  // 2b. Editar tema e invitados: también deben llegar al evento.
  const newTopic = `PRUEBA smoke renombrada ${stamp}`;
  try {
    const edited = await updateMeeting(db, calendar, id, { topic: newTopic, attendees: [invitee] }, 'smoke');
    const same = edited.meeting.topic === newTopic && edited.meeting.calendarStatus === 'sincronizada';
    check('Editar: el tema y los invitados llegan al evento', same, `${edited.meeting.topic} · ${edited.meeting.calendarStatus}`);
  } catch (error) {
    check('Editar: el tema y los invitados llegan al evento', false, error instanceof Error ? error.message : String(error));
  }

  // 3. Cancelar: quita el evento del calendario.
  const cancelled = await cancelMeeting(db, calendar, id, 'Prueba automática: cancelación', 'smoke');
  check('Cancelar: la reunión pasa a cancelada', cancelled.status === 'cancelada', cancelled.status);
  check('Cancelar: el calendario queda como quitado', cancelled.calendarStatus === 'cancelada', String(cancelled.calendarStatus));

  // 4. Agenda: lo que lee la pantalla de Reuniones.
  const agenda = await listAllMeetings(db);
  const row = agenda.find((m) => m.id === id);
  check('Agenda: la app ve la reunión', Boolean(row), row ? `${row.kind} · ${row.counterpartName}` : 'no aparece');
  check('Agenda: la app ve el estado del calendario', row?.calendarStatus === 'cancelada', String(row?.calendarStatus));

  // 5. Camino de error: con un secreto incorrecto la reunión no se pierde y queda pendiente.
  const badCalendar = createN8nCalendar({ baseUrl, secret: 'secreto-incorrecto-prueba' });
  const [second] = await db
    .insert(meetings)
    .values({ organizationId: org!.id, topic: `PRUEBA smoke de error ${stamp}`, requestedBy: 'smoke', preferredWindows: [], status: 'solicitada' })
    .returning();
  const failed = await confirmMeeting(db, badCalendar, second!.id, { startsAt: futureAt(4, 15), durationMinutes: 30, attendees: [] }, 'smoke');
  check('Error: con secreto incorrecto la reunión sigue confirmada', failed.meeting.status === 'confirmada', failed.meeting.status);
  check('Error: el calendario queda pendiente con motivo', failed.calendar.status === 'pendiente', failed.calendar.status === 'pendiente' ? failed.calendar.reason : failed.calendar.status);

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length} de ${results.length} comprobaciones pasan.`);
  console.log(`Reuniones de prueba creadas: "PRUEBA smoke de calendario ${stamp}" (cancelada) y "PRUEBA smoke de error ${stamp}" (confirmada, sin evento).`);
  return failures.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('La prueba se detuvo con un error inesperado:', error);
    process.exit(1);
  });
