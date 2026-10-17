"use client";

import { useActionState } from "react";
import { addSuppressionAction, type SuppressionActionState } from "@/app/(protected)/supresion/actions";

// Añadir a supresión: el correo no recibirá ninguna invitación ni contacto de Arkanium.
export function SuppressionForm() {
  const [state, action, pending] = useActionState<SuppressionActionState, FormData>(addSuppressionAction, null);

  return (
    <form action={action} className="decision">
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Correo
          <input type="email" name="email" required maxLength={254} disabled={pending} placeholder="persona@empresa.com" />
        </label>
        <label className="field" style={{ flex: "1 1 280px" }}>
          Motivo
          <input name="reason" required maxLength={500} disabled={pending} placeholder="Pidió no recibir mensajes" />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="danger" disabled={pending}>
          {pending ? "Guardando…" : "Añadir a supresión"}
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
