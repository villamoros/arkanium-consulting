"use client";

import { useActionState } from "react";
import { decideLeadAction, type ActionState } from "@/app/(protected)/leads/actions";

// Calificar, posponer o descartar. El motivo es obligatorio: queda en la bitácora.
export function DecisionForm({ leadId, disabled }: { leadId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(decideLeadAction, null);

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="field">
        Motivo de la decisión
        <textarea name="reason" required maxLength={1000} disabled={disabled || pending} placeholder="Por qué calificas, pospones o descartas este lead" />
      </label>
      <div className="actions">
        <button type="submit" name="decision" value="calificar" className="primary" disabled={disabled || pending}>
          Calificar
        </button>
        <button type="submit" name="decision" value="posponer" className="secondary" disabled={disabled || pending}>
          Posponer
        </button>
        <button type="submit" name="decision" value="descartar" className="danger" disabled={disabled || pending}>
          Descartar
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
