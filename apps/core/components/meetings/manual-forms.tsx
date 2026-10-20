"use client";

import { Notice } from "@/components/ui/notice";
import { useActionState, useState, type ReactNode } from "react";
import { createManualMeetingAction, deleteMeetingAction, updateMeetingAction } from "@/app/(protected)/reuniones/manual-actions";
import type { MeetingActionState } from "@/app/(protected)/reuniones/actions";

const DURATIONS = [30, 60, 90, 120];

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

/** Crear una reunión a mano. Sirve de respaldo si n8n o Calendar no responden. */
export function ManualMeetingForm({ clients, leads }: { clients: Array<{ id: string; name: string }>; leads: Array<{ id: string; name: string }> }) {
  const [kind, setKind] = useState<"cliente" | "lead">("cliente");
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(createManualMeetingAction, null);
  const options = kind === "cliente" ? clients : leads;

  return (
    <form action={action} className="decision">
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Tipo
          <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "cliente" | "lead")} disabled={pending}>
            <option value="cliente">Cliente</option>
            <option value="lead">Lead</option>
          </select>
        </label>
        <label className="field" style={{ flex: "1 1 260px" }}>
          {kind === "cliente" ? "Cliente" : "Lead"}
          <select name="target" required disabled={pending} defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Tema
        <input name="topic" required maxLength={200} disabled={pending} placeholder="Por ejemplo: revisión del informe" />
      </label>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Fecha y hora (Bogotá, opcional)
          <input type="datetime-local" name="startsAt" disabled={pending} />
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
        <textarea name="attendees" disabled={pending} style={{ minHeight: 56 }} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Creando…" : "Crear reunión"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Corregir una reunión a mano: tema, invitados, hora y duración. */
export function EditMeetingForm({ meetingId, topic, attendees }: { meetingId: string; topic: string; attendees: string[] }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(updateMeetingAction, null);
  return (
    <Disclosure label="Corregir a mano">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Tema
            <input name="topic" defaultValue={topic} maxLength={200} disabled={pending} />
          </label>
          <label className="field">
            Invitados (reemplazan la lista; el contacto principal siempre queda)
            <textarea name="attendees" defaultValue={attendees.join(", ")} disabled={pending} style={{ minHeight: 56 }} />
          </label>
          <div className="filters" style={{ marginBottom: 0 }}>
            <label className="field">
              Nueva fecha y hora (Bogotá, opcional)
              <input type="datetime-local" name="startsAt" disabled={pending} />
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
            <span>
              <input type="checkbox" name="skipCalendar" style={{ marginRight: 6 }} disabled={pending} />
              Guardar solo en Arkanium, sin tocar el calendario (solo aplica a reuniones sin evento)
            </span>
          </label>
          <p className="sub" style={{ margin: 0 }}>
            Si la reunión ya tiene evento, el tema, los invitados y la hora se actualizan en Google Calendar. Si Calendar no responde, no se guarda nada.
          </p>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Eliminar una reunión (borrado lógico). Si el calendario no puede quitar el evento, hay que marcar «forzar». */
export function DeleteMeetingForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(deleteMeetingAction, null);
  return (
    <Disclosure label="Eliminar reunión">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Motivo
            <textarea name="reason" required maxLength={1000} disabled={pending} placeholder="Por qué se elimina (queda en el registro)" />
          </label>
          <label className="field">
            <span>
              <input type="checkbox" name="force" style={{ marginRight: 6 }} disabled={pending} />
              Eliminar aunque el calendario no pueda quitar el evento (lo quitarás a mano)
            </span>
          </label>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}
