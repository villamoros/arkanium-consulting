"use client";

import { useActionState } from "react";
import { emergencyAction, type EmergencyActionState } from "@/app/(protected)/pausas/actions";

/**
 * Botón que abre un formulario con el motivo. Pausar exige el motivo; reanudar lo deja opcional.
 * Escribir el motivo es la confirmación: nada se detiene sin él.
 */
export function PauseControl({
  op,
  target = "",
  label,
  tone,
  reasonRequired,
  compact = false,
}: {
  op: "pause-all" | "resume-all" | "pause-dept" | "resume-dept" | "pause-agent" | "resume-agent";
  target?: string;
  label: string;
  tone: "danger" | "secondary";
  reasonRequired: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<EmergencyActionState, FormData>(emergencyAction, null);
  return (
    <details className="pause-control" style={{ display: "inline-block", marginTop: compact ? 0 : 8 }}>
      <summary className={tone} style={{ display: "inline-block", padding: "6px 12px", borderRadius: 6, cursor: "pointer", listStyle: "none" }}>
        {label}
      </summary>
      <form action={action} className="decision" style={{ marginTop: 8, minWidth: compact ? 260 : 320 }}>
        <input type="hidden" name="op" value={op} />
        <input type="hidden" name="target" value={target} />
        <label className="field">
          Motivo{reasonRequired ? "" : " (opcional)"}
          <input name="reason" maxLength={140} required={reasonRequired} disabled={pending} placeholder={reasonRequired ? "Por qué se detiene" : "Opcional"} />
        </label>
        <div className="actions">
          <button type="submit" className={tone} disabled={pending}>
            {pending ? "Guardando…" : label}
          </button>
        </div>
        {state ? (
          <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
