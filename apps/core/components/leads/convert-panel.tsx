"use client";

import { useActionState, useState } from "react";
import { convertLeadAction, type ActionState } from "@/app/(protected)/leads/actions";

// Convertir crea la organización y su contacto principal. Pide confirmación porque es irreversible desde core.
export function ConvertPanel({ leadId, enabled }: { leadId: string; enabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(convertLeadAction, null);

  if (!enabled) {
    return <p className="sub">Solo se puede convertir un lead calificado.</p>;
  }

  return (
    <div className="decision">
      {!confirming ? (
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" className="secondary" onClick={() => setConfirming(true)}>
            Convertir en organización
          </button>
        </div>
      ) : (
        <form action={formAction} className="decision">
          <input type="hidden" name="leadId" value={leadId} />
          <p className="sub" style={{ margin: 0 }}>
            Se crea la organización del cliente con este lead como contacto principal. Confírmalo solo si ya acordaste el alcance.
          </p>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Creando…" : "Sí, convertir"}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {state ? (
        <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
