"use client";

import { useActionState } from "react";
import { updateLeadAction } from "@/app/(protected)/leads/crud-actions";
import type { ActionState } from "@/app/(protected)/leads/actions";
import type { Lead } from "@arkanium/contracts";
import { LeadFields } from "./lead-fields";

// Edición de los datos de un lead no convertido.
export function EditLeadForm({ lead, contactOnly = false }: { lead: Lead; contactOnly?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateLeadAction, null);

  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="leadId" value={lead.id} />
      <LeadFields values={lead} contactOnly={contactOnly} />
      <div className="actions">
        <button type="submit" className="secondary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
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
