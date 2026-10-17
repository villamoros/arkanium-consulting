"use client";

import { useActionState } from "react";
import { confirmMeetingAction, type MeetingActionState } from "@/app/(protected)/reuniones/actions";

const DURATIONS = [30, 60, 90, 120];

// Confirmar fija la fecha. Al hacerlo se crea el evento en Google Calendar con Meet e invita al contacto principal y a los correos extra.
export function ConfirmMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, formAction, pending] = useActionState<MeetingActionState, FormData>(confirmMeetingAction, null);

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Fecha y hora (Bogotá)
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
      <label className="field">
        Correos extra para invitar (opcional, separados por coma)
        <textarea name="attendees" disabled={pending} placeholder="socio@empresa.com, otra@empresa.com" style={{ minHeight: 56 }} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Confirmando…" : "Confirmar reunión"}
        </button>
      </div>
      {state ? (
        <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
