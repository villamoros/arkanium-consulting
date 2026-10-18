import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import { ApiError, apiFetch } from "@/lib/api";
import { CALENDAR_STATUS_LABEL, MEETING_STATUS_LABEL, formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { ConfirmMeetingForm } from "@/components/meetings/confirm-meeting-form";
import { CancelMeetingForm, ProposeMeetingForm, RejectMeetingForm, RescheduleMeetingForm, RetryCalendarButton } from "@/components/meetings/meeting-forms";
import { DeleteMeetingForm, EditMeetingForm, ManualMeetingForm } from "@/components/meetings/manual-forms";
import { MinutesPanel, type MinutesHistoryEntry } from "@/components/meetings/minutes-panel";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type Status = keyof typeof MEETING_STATUS_LABEL;

type OwnerMeeting = {
  id: string;
  kind: "cliente" | "lead";
  counterpartName: string | null;
  topic: string;
  status: Status;
  preferredWindows: string[];
  startsAt: string | null;
  endsAt: string | null;
  attendees: string[];
  proposedStartsAt: string | null;
  decisionNote: string | null;
  calendarStatus: keyof typeof CALENDAR_STATUS_LABEL | null;
  calendarLink: string | null;
  meetLink: string | null;
  minutesPublished: boolean;
  minutesText: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Counterpart({ meeting }: { meeting: OwnerMeeting }) {
  return (
    <span className="sub">
      {meeting.kind === "lead" ? "Lead" : "Cliente"} · {meeting.counterpartName ?? "Sin nombre"}
    </span>
  );
}

function CalendarInfo({ meeting }: { meeting: OwnerMeeting }) {
  return (
    <p className="sub" style={{ margin: "6px 0 0" }}>
      Calendario: {meeting.calendarStatus ? CALENDAR_STATUS_LABEL[meeting.calendarStatus] : "Sin sincronizar"}
      {meeting.calendarLink ? (
        <>
          {" · "}
          <a href={meeting.calendarLink} target="_blank" rel="noreferrer">
            Ver evento
          </a>
        </>
      ) : null}
      {meeting.meetLink ? (
        <>
          {" · "}
          <a href={meeting.meetLink} target="_blank" rel="noreferrer">
            Enlace de Meet
          </a>
        </>
      ) : null}
    </p>
  );
}

export default async function MeetingsPage() {
  let meetings: OwnerMeeting[];
  let clients: Array<{ id: string; name: string }>;
  let leadOptions: Array<{ id: string; name: string }>;
  try {
    const [meetingData, clientData, leadData] = await Promise.all([
      apiFetch<{ meetings: OwnerMeeting[] }>("/meetings"),
      apiFetch<{ organizations: Array<{ id: string; name: string }> }>("/client-organizations"),
      apiFetch<{ leads: Array<{ id: string; name: string; status: string }> }>("/leads"),
    ]);
    meetings = meetingData.meetings;
    clients = clientData.organizations;
    leadOptions = leadData.leads.filter((lead) => lead.status !== "convertido" && lead.status !== "descartado");
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar las reuniones.";
    return (
      <StatePanel title="No pudimos cargar las reuniones">
        <p>{message}</p>
        <p>Ninguna reunión se ha modificado.</p>
      </StatePanel>
    );
  }

  const now = (await requestNow()).getTime();
  const timeOf = (m: OwnerMeeting) => (m.startsAt ? new Date(m.startsAt).getTime() : 0);

  const requests = meetings.filter((m) => m.status === "solicitada");
  const upcoming = meetings.filter((m) => m.status === "confirmada" && timeOf(m) >= now).sort((a, b) => timeOf(a) - timeOf(b));
  const past = meetings.filter((m) => m.status === "realizada" || (m.status === "confirmada" && timeOf(m) < now)).sort((a, b) => timeOf(b) - timeOf(a));
  const closed = meetings.filter((m) => m.status === "rechazada" || m.status === "cancelada");
  const thisWeek = upcoming.filter((m) => timeOf(m) - now <= WEEK_MS).length;
  const withoutMinutes = past.filter((m) => !m.minutesPublished).length;

  // Bitácora de cada reunión pasada. Si una no carga, su panel avisa y las demás siguen.
  const histories = new Map<string, MinutesHistoryEntry[] | null>(
    await Promise.all(
      past.map(async (meeting): Promise<[string, MinutesHistoryEntry[] | null]> => {
        try {
          const data = await apiFetch<{ history: MinutesHistoryEntry[] }>(`/meetings/${meeting.id}/minutes/history`);
          return [meeting.id, data.history];
        } catch {
          return [meeting.id, null];
        }
      }),
    ),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reuniones</h1>
          <p>Solicitudes, reuniones confirmadas y actas. Nada se agenda sin tu confirmación.</p>
        </div>
      </div>

      <div className="approval" role="note">
        <span aria-hidden="true">◈</span>
        <div>
          <strong>Confirmar crea el evento con enlace de Meet</strong> e invita al contacto principal, al lead y a los correos que indiques.
        </div>
      </div>

      <details className="panel pad" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Crear una reunión a mano</summary>
        <p className="sub" style={{ margin: "8px 0 10px" }}>
          Úsala si n8n o Google Calendar no responden, o para reuniones que no nacieron en la app. Con fecha queda confirmada; si el calendario falla, queda pendiente y se reintenta.
        </p>
        <ManualMeetingForm clients={clients} leads={leadOptions} />
      </details>

      <div className="kpis" aria-label="Resumen de reuniones">
        <div className="kpi">
          <b>{requests.length}</b>
          <span>solicitudes por responder</span>
        </div>
        <div className="kpi">
          <b>{thisWeek}</b>
          <span>en los próximos 7 días</span>
        </div>
        <div className="kpi">
          <b>{upcoming.length}</b>
          <span>próximas</span>
        </div>
        <div className="kpi">
          <b>{withoutMinutes}</b>
          <span>sin acta</span>
        </div>
      </div>

      <section className="section" aria-labelledby="solicitudes">
        <h3 id="solicitudes">Solicitudes por responder</h3>
        {requests.length === 0 ? (
          <p className="muted">No hay solicitudes pendientes.</p>
        ) : (
          requests.map((meeting) => (
            <article key={meeting.id} className="panel pad" style={{ marginBottom: 12 }}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <div>
                  <h2>{meeting.topic}</h2>
                  <Counterpart meeting={meeting} />
                </div>
                <span className={`badge b-${meeting.status}`}>{MEETING_STATUS_LABEL[meeting.status]}</span>
              </div>
              <p className="sub" style={{ marginBottom: 10 }}>
                Ventanas preferidas: {meeting.preferredWindows.length > 0 ? meeting.preferredWindows.join("; ") : "sin preferencia"}
                {meeting.proposedStartsAt ? ` · Propusiste otra hora: ${formatDate(meeting.proposedStartsAt)}` : ""}
              </p>
              <ConfirmMeetingForm meetingId={meeting.id} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: "1 1 280px" }}>
                  <ProposeMeetingForm meetingId={meeting.id} />
                </div>
                <div style={{ flex: "1 1 280px" }}>
                  <RejectMeetingForm meetingId={meeting.id} />
                </div>
              </div>
              <EditMeetingForm meetingId={meeting.id} topic={meeting.topic} attendees={meeting.attendees} />
              <DeleteMeetingForm meetingId={meeting.id} />
            </article>
          ))
        )}
      </section>

      <section className="section" aria-labelledby="proximas">
        <h3 id="proximas">Próximas</h3>
        {upcoming.length === 0 ? (
          <p className="muted">No hay reuniones confirmadas próximas.</p>
        ) : (
          upcoming.map((meeting) => (
            <article key={meeting.id} className="panel pad" style={{ marginBottom: 12 }}>
              <div className="page-head" style={{ marginBottom: 4 }}>
                <div>
                  <h2>{meeting.topic}</h2>
                  <Counterpart meeting={meeting} />
                </div>
                <span className={`badge b-${meeting.status}`}>{MEETING_STATUS_LABEL[meeting.status]}</span>
              </div>
              <p className="sub" style={{ margin: 0 }}>
                {meeting.startsAt ? formatDate(meeting.startsAt) : "Sin fecha"}
                {meeting.attendees.length > 0 ? ` · Invitados: ${meeting.attendees.join(", ")}` : ""}
              </p>
              <CalendarInfo meeting={meeting} />
              {meeting.calendarStatus === "pendiente" || meeting.calendarStatus === "no_configurada" ? <RetryCalendarButton meetingId={meeting.id} /> : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <div style={{ flex: "1 1 280px" }}>
                  <RescheduleMeetingForm meetingId={meeting.id} />
                </div>
                <div style={{ flex: "1 1 280px" }}>
                  <CancelMeetingForm meetingId={meeting.id} />
                </div>
              </div>
              <EditMeetingForm meetingId={meeting.id} topic={meeting.topic} attendees={meeting.attendees} />
              <DeleteMeetingForm meetingId={meeting.id} />
            </article>
          ))
        )}
      </section>

      <section className="section" aria-labelledby="pasadas">
        <h3 id="pasadas">Pasadas</h3>
        {past.length === 0 ? (
          <p className="muted">Todavía no hay reuniones pasadas.</p>
        ) : (
          past.map((meeting) => (
            <article key={meeting.id} className="panel pad" style={{ marginBottom: 12 }}>
              <div className="page-head" style={{ marginBottom: 4 }}>
                <div>
                  <h2>{meeting.topic}</h2>
                  <Counterpart meeting={meeting} />
                </div>
                <span className={`badge b-${meeting.status}`}>{MEETING_STATUS_LABEL[meeting.status]}</span>
              </div>
              <p className="sub" style={{ margin: 0 }}>
                {meeting.startsAt ? formatDate(meeting.startsAt) : "Sin fecha"} · Acta: {meeting.minutesPublished ? "publicada" : "pendiente"}
              </p>
              <MinutesPanel
                meetingId={meeting.id}
                minutesText={meeting.minutesText}
                published={meeting.minutesPublished}
                history={histories.get(meeting.id) ?? null}
              />
              <EditMeetingForm meetingId={meeting.id} topic={meeting.topic} attendees={meeting.attendees} />
              <DeleteMeetingForm meetingId={meeting.id} />
            </article>
          ))
        )}
      </section>

      {closed.length > 0 ? (
        <section className="section" aria-labelledby="cerradas">
          <h3 id="cerradas">Rechazadas y canceladas</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {closed.map((meeting) => (
              <li key={meeting.id}>
                {meeting.topic} · {MEETING_STATUS_LABEL[meeting.status]} · <Counterpart meeting={meeting} />
                {meeting.decisionNote ? <div className="muted">{meeting.decisionNote}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="sub" style={{ marginTop: 16 }}>
        ¿Buscas una reunión con un lead? Pídela desde su ficha en <Link href="/leads">Leads</Link>.
      </p>
    </>
  );
}
