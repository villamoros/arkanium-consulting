"use client";

import { useActionState } from "react";
import { respondProposalAction, type ActionState } from "@/app/(protected)/leads/actions";

// La propuesta del agente solo sugiere. Aceptarla califica el lead con su motivo; rechazarla queda registrado.
export function ProposalForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(respondProposalAction, null);

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="field">
        Nota (opcional)
        <textarea name="note" maxLength={1000} disabled={pending} placeholder="Por qué aceptas o rechazas la sugerencia" />
      </label>
      <div className="actions">
        <button type="submit" name="accepted" value="true" className="primary" disabled={pending}>
          Aceptar propuesta
        </button>
        <button type="submit" name="accepted" value="false" className="secondary" disabled={pending}>
          Rechazar propuesta
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
