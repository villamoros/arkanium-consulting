"use client";

import { useActionState } from "react";
import { createLeadMeetingAction, type ActionState } from "@/app/(protected)/leads/actions";

// Pide una reunión con el lead. La fecha se confirma después en Reuniones, como con cualquier solicitud.
export function LeadMeetingForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLeadMeetingAction, null);

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="field">
        Tema de la reunión
        <input name="topic" required maxLength={200} disabled={pending} placeholder="Por ejemplo: demo del diagnóstico" />
      </label>
      <div className="actions">
        <button type="submit" className="secondary" disabled={pending}>
          {pending ? "Pidiendo…" : "Pedir reunión"}
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
