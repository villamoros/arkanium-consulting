"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  acceptProposalAction,
  addVersionAction,
  createProposalAction,
  markSentAction,
  rejectProposalAction,
  sendToApprovalAction,
  type ProposalActionState,
} from "@/app/(protected)/propuestas/actions";
import { FAMILY_LABEL } from "@/lib/labels";

function Notice({ state }: { state: ProposalActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
      {state.message}
    </p>
  );
}

function Disclosure({ label, danger, children }: { label: string; danger?: boolean; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={danger ? "danger" : "secondary"} onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {label}
      </button>
    );
  }
  return <div style={{ marginTop: 8 }}>{children()}</div>;
}

const FAMILIES = Object.keys(FAMILY_LABEL) as Array<keyof typeof FAMILY_LABEL>;

/** Precio y su nota. Vacío significa «por confirmar»: no se puede enviar hasta confirmarlo. */
function PriceFields({ disabled, defaultPrice, defaultNote }: { disabled: boolean; defaultPrice?: string; defaultNote?: string }) {
  return (
    <div className="filters" style={{ marginBottom: 0 }}>
      <label className="field">
        Precio en USD (vacío = por confirmar)
        <input name="price" inputMode="decimal" defaultValue={defaultPrice ?? ""} disabled={disabled} placeholder="4500" />
      </label>
      <label className="field" style={{ flex: "1 1 240px" }}>
        Nota del precio (opcional)
        <input name="priceNote" defaultValue={defaultNote ?? ""} maxLength={200} disabled={disabled} placeholder="Acordado en SOW" />
      </label>
    </div>
  );
}

/** Crear una propuesta: para un cliente o un lead calificado. Empieza como borrador. */
export function CreateProposalForm({
  clients,
  leads,
}: {
  clients: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(createProposalAction, null);
  const [kind, setKind] = useState<"cliente" | "lead">("cliente");
  const options = kind === "cliente" ? clients : leads;
  return (
    <form action={action} className="decision">
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Para
          <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "cliente" | "lead")} disabled={pending}>
            <option value="cliente">Cliente</option>
            <option value="lead">Lead calificado</option>
          </select>
        </label>
        <label className="field" style={{ flex: "1 1 240px" }}>
          {kind === "cliente" ? "Cliente" : "Lead"}
          <select name="target" required defaultValue="" disabled={pending}>
            <option value="" disabled>
              Elige…
            </option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Título
        <input name="title" required maxLength={160} disabled={pending} placeholder="Diagnóstico de arquitectura" />
      </label>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Familia
          <select name="serviceFamily" defaultValue="architecture" disabled={pending}>
            {FAMILIES.map((key) => (
              <option key={key} value={key}>
                {FAMILY_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Plantilla
          <input name="templateCode" required maxLength={20} defaultValue="PL-03" disabled={pending} />
        </label>
      </div>
      <label className="field">
        Resumen de lo que ofrecemos
        <textarea name="summary" required maxLength={4000} disabled={pending} style={{ minHeight: 84 }} />
      </label>
      <PriceFields disabled={pending} />
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Creando…" : "Crear borrador"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Nueva versión de un borrador. */
export function NewVersionForm({ proposalId, summary, priceStatus, priceCents, priceNote }: { proposalId: string; summary: string; priceStatus: string; priceCents: number | null; priceNote: string | null }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(addVersionAction, null);
  return (
    <Disclosure label="Nueva versión">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="proposalId" value={proposalId} />
          <label className="field">
            Resumen
            <textarea name="summary" required maxLength={4000} defaultValue={summary} disabled={pending} style={{ minHeight: 84 }} />
          </label>
          <PriceFields
            disabled={pending}
            defaultPrice={priceStatus === "confirmado" && priceCents !== null ? (priceCents / 100).toString() : ""}
            defaultNote={priceNote ?? ""}
          />
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Guardando…" : "Crear versión"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Envío a aprobación: exige precio confirmado (lo valida la API). */
export function SendToApprovalForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(sendToApprovalAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <button type="submit" className="primary" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Enviando…" : "Enviar a aprobación"}
      </button>
      <Notice state={state} />
    </form>
  );
}

/** Registrar el envío aprobado. Arkanium no envía correos desde aquí: queda el registro. */
export function MarkSentForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(markSentAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <button type="submit" className="primary" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Registrando…" : "Aprobar y registrar envío"}
      </button>
      <Notice state={state} />
    </form>
  );
}

/** Aceptación: solo con la referencia de la firma adjunta. */
export function AcceptProposalForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(acceptProposalAction, null);
  return (
    <Disclosure label="Registrar aceptación">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="proposalId" value={proposalId} />
          <label className="field">
            Referencia de la firma adjunta
            <input name="note" required maxLength={1000} disabled={pending} placeholder="Firma adjunta del 20 de octubre" />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Registrando…" : "Registrar aceptación"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Rechazo con motivo. */
export function RejectProposalForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(rejectProposalAction, null);
  return (
    <Disclosure label="Registrar rechazo" danger>
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="proposalId" value={proposalId} />
          <label className="field">
            Motivo del rechazo
            <textarea name="note" required maxLength={1000} disabled={pending} />
          </label>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Registrando…" : "Registrar rechazo"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}
