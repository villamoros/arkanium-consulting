"use client";

import { useActionState } from "react";
import { approveItemAction, type ApprovalActionState } from "@/app/(protected)/aprobaciones/actions";

// Aprobar desde la cola. Lo que no se puede aprobar aquí se resuelve en su módulo (el enlace lleva allí).
export function ApproveForm({ action, subjectId, label }: { action: string; subjectId: string; label: string }) {
  const [state, formAction, pending] = useActionState<ApprovalActionState, FormData>(approveItemAction, null);
  return (
    <form action={formAction} className="decision">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Aprobando…" : label}
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
