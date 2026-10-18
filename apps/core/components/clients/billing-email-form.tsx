"use client";

import { useActionState } from "react";
import { setBillingEmailAction, type ClientActionState } from "@/app/(protected)/clientes/actions";

/** Correo donde Stripe envía las facturas del cliente. Vacío lo borra. */
export function BillingEmailForm({ organizationId, current }: { organizationId: string; current: string }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(setBillingEmailAction, null);
  return (
    <form action={action} className="filters" style={{ marginBottom: 0 }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="field" style={{ flex: "1 1 240px" }}>
        Correo de facturación
        <input name="billingEmail" type="email" maxLength={254} defaultValue={current} disabled={pending} placeholder="pagos@cliente.com" />
      </label>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar correo"}
      </button>
      {state ? (
        <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
