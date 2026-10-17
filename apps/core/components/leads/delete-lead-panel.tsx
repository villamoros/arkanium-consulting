"use client";

import { useActionState, useState } from "react";
import { deleteLeadAction } from "@/app/(protected)/leads/crud-actions";
import type { ActionState } from "@/app/(protected)/leads/actions";

// Eliminar pide confirmación y motivo. El lead no se borra de la base: deja de aparecer en Leads.
export function DeleteLeadPanel({ leadId }: { leadId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteLeadAction, null);

  if (!confirming) {
    return (
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          Eliminar lead
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="sub" style={{ margin: 0 }}>
        El lead deja de aparecer en Leads. Su registro y su bitácora se conservan.
      </p>
      <label className="field">
        Motivo (obligatorio)
        <textarea name="reason" required maxLength={1000} />
      </label>
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="submit" className="danger" disabled={pending}>
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="notice-bad">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
