"use client";

import { useActionState } from "react";
import { createManualLeadAction } from "@/app/(protected)/leads/crud-actions";
import type { ActionState } from "@/app/(protected)/leads/actions";
import { LeadFields } from "./lead-fields";

// Alta manual de un lead. Al guardar, la página lleva a la ficha del lead nuevo.
export function NewLeadForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createManualLeadAction, null);

  return (
    <form action={formAction} className="panel pad decision">
      <LeadFields />
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar lead"}
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
