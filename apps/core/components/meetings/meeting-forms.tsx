"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  cancelMeetingAction,
  proposeMeetingAction,
  publishMinutesAction,
  rejectMeetingAction,
  rescheduleMeetingAction,
  retryCalendarAction,
  type MeetingActionState,
} from "@/app/(protected)/reuniones/actions";

const DURATIONS = [30, 60, 90, 120];

function Notice({ state }: { state: MeetingActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
      {state.message}
    </p>
  );
}

/** Acción que se abre con un botón y se cierra al terminar bien. Evita formularios largos siempre visibles. */
function Disclosure({ label, children }: { label: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {label}
      </button>
    );
  }
  return <div style={{ marginTop: 8 }}>{children()}</div>;
}

// Rechazar: el motivo queda en la reunión.
export function RejectMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(rejectMeetingAction, null);
  return (
    <Disclosure label="Rechazar solicitud">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Motivo del rechazo
            <textarea name="reason" required maxLength={1000} disabled={pending} />
          </label>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              Rechazar
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

// Proponer otra hora: la solicitud sigue pendiente.
export function ProposeMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(proposeMeetingAction, null);
  return (
    <Disclosure label="Proponer otra hora">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Hora que propones (Bogotá)
            <input type="datetime-local" name="startsAt" required disabled={pending} />
          </label>
          <label className="field">
            Nota (opcional)
            <textarea name="note" maxLength={1000} disabled={pending} />
          </label>
          <div className="actions">
            <button type="submit" className="secondary" disabled={pending}>
              Proponer
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

// Reprogramar: actualiza el evento en el calendario con la nueva hora.
export function RescheduleMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(rescheduleMeetingAction, null);
  return (
    <Disclosure label="Reprogramar">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <div className="filters" style={{ marginBottom: 0 }}>
            <label className="field">
              Nueva fecha y hora (Bogotá)
              <input type="datetime-local" name="startsAt" required disabled={pending} />
            </label>
            <label className="field">
              Duración
              <select name="durationMinutes" defaultValue="60" disabled={pending}>
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="secondary" disabled={pending}>
              Reprogramar
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

// Cancelar: quita el evento del calendario. Si el calendario falla, la reunión sigue confirmada.
export function CancelMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(cancelMeetingAction, null);
  return (
    <Disclosure label="Cancelar reunión">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Motivo de la cancelación
            <textarea name="reason" required maxLength={1000} disabled={pending} />
          </label>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              Cancelar reunión
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

// Acta: el cliente la ve cuando la publicas.
export function MinutesForm({ meetingId, published }: { meetingId: string; published: boolean }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(publishMinutesAction, null);
  return (
    <Disclosure label={published ? "Editar y volver a publicar acta" : "Publicar acta"}>
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Acta de la reunión
            <textarea name="text" required maxLength={20000} disabled={pending} style={{ minHeight: 140 }} placeholder="Acuerdos, decisiones y próximos pasos" />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Publicando…" : "Publicar acta"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

// Reintentar el evento cuando la sincronización con el calendario quedó pendiente.
export function RetryCalendarButton({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(retryCalendarAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <button type="submit" className="secondary" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Reintentando…" : "Reintentar calendario"}
      </button>
      <Notice state={state} />
    </form>
  );
}
