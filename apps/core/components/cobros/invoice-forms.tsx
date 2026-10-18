"use client";

import { useActionState, useState } from "react";
import {
  createInvoiceAction,
  creditNoteAction,
  discardInvoiceAction,
  remindInvoiceAction,
  updateInvoiceAction,
  voidInvoiceAction,
  type InvoiceActionState,
} from "@/app/(protected)/cobros/actions";

const DUE_OPTIONS = [7, 15, 30, 45, 60, 90];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Line = { description: string; quantity: string; amount: string };
type SavedLine = { description: string; quantity: number; unitAmountCents: number };
type Project = { id: string; name: string; organizationId: string };

const emptyLine = (): Line => ({ description: "", quantity: "1", amount: "" });

function toEditable(lines: SavedLine[]): Line[] {
  return lines.map((line) => ({ description: line.description, quantity: String(line.quantity), amount: (line.unitAmountCents / 100).toFixed(2) }));
}

function Notice({ state }: { state: InvoiceActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
      {state.message}
    </p>
  );
}

/** Líneas de la factura: descripción, cantidad y precio unitario. El total se calcula aquí mismo. */
function LinesEditor({ initial, disabled }: { initial: Line[]; disabled: boolean }) {
  const [lines, setLines] = useState<Line[]>(initial.length > 0 ? initial : [emptyLine()]);
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.amount.replace(",", ".")) || 0), 0);
  const change = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field" style={{ marginBottom: 6 }}>Líneas de la factura</legend>
      {lines.map((line, index) => (
        <div key={index} className="filters" style={{ marginBottom: 6, alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "2 1 200px" }}>
            Descripción
            <input value={line.description} maxLength={140} onChange={(event) => change(index, { description: event.target.value })} disabled={disabled} placeholder="Hito 2: arquitectura" />
          </label>
          <label className="field" style={{ flex: "0 0 80px" }}>
            Cantidad
            <input inputMode="numeric" value={line.quantity} onChange={(event) => change(index, { quantity: event.target.value })} disabled={disabled} />
          </label>
          <label className="field" style={{ flex: "0 0 120px" }}>
            Precio (USD)
            <input inputMode="decimal" value={line.amount} onChange={(event) => change(index, { amount: event.target.value })} disabled={disabled} placeholder="900.00" />
          </label>
          <button type="button" className="secondary" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={disabled || lines.length === 1}>
            Quitar
          </button>
        </div>
      ))}
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="secondary" onClick={() => setLines((current) => [...current, emptyLine()])} disabled={disabled || lines.length >= 20}>
          Añadir línea
        </button>
        <span className="sub">
          Total: <b>{money.format(total)}</b>
        </span>
      </div>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
    </fieldset>
  );
}

/** Campos comunes de un borrador: concepto, proyecto, plazo y líneas. */
function DraftFields({
  projects,
  projectsDisabled,
  disabled,
  defaults,
}: {
  projects: Project[];
  projectsDisabled: boolean;
  disabled: boolean;
  defaults?: { concept: string; projectId: string | null; dueDays: number; lines: SavedLine[]; recipientEmail?: string | null };
}) {
  return (
    <>
      <label className="field">
        Concepto (título de la factura)
        <input name="concept" required maxLength={140} disabled={disabled} defaultValue={defaults?.concept} placeholder="Hito 2: arquitectura de la solución, según SOW" />
      </label>
      <label className="field">
        Correo al que se envía la factura
        <input name="recipientEmail" type="email" maxLength={254} disabled={disabled} defaultValue={defaults?.recipientEmail ?? ""} placeholder="compras@cliente.com" />
        <span className="sub" style={{ fontWeight: 400 }}>
          Stripe la envía a este correo y pasa a ser el correo del cliente. Vacío: se usa el correo de facturación del cliente.
        </span>
      </label>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field" style={{ flex: "1 1 220px" }}>
          Proyecto (opcional)
          <select name="projectId" defaultValue={defaults?.projectId ?? ""} disabled={disabled || projectsDisabled}>
            <option value="">Sin proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Vence en
          <select name="dueDays" defaultValue={String(defaults?.dueDays ?? 30)} disabled={disabled}>
            {DUE_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} días
              </option>
            ))}
          </select>
        </label>
      </div>
      <LinesEditor initial={toEditable(defaults?.lines ?? [])} disabled={disabled} />
      <p className="sub" style={{ margin: 0 }}>
        Impuesto sobre ventas: pendiente de definir con el contador. Por ahora la factura queda marcada como provisional.
      </p>
    </>
  );
}

/** Nueva factura: se crea como borrador. Solo sale cuando la apruebas en Aprobaciones. */
export function CreateInvoiceForm({
  clients,
  projects,
}: {
  clients: Array<{ id: string; name: string }>;
  projects: Project[];
}) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(createInvoiceAction, null);
  const [organizationId, setOrganizationId] = useState("");
  const clientProjects = projects.filter((project) => project.organizationId === organizationId);
  return (
    <form action={action} className="decision">
      <label className="field">
        Cliente
        <select name="organizationId" required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} disabled={pending}>
          <option value="" disabled>
            Elige la organización
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <DraftFields projects={clientProjects} projectsDisabled={!organizationId} disabled={pending} />
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Corrige un borrador. Una factura emitida no aparece aquí. */
export function EditDraftForm({
  invoice,
  projects,
}: {
  invoice: { id: string; concept: string; projectId: string | null; dueDays: number; lines: SavedLine[]; recipientEmail: string | null };
  projects: Project[];
}) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(updateInvoiceAction, null);
  return (
    <form action={action} className="decision">
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <DraftFields projects={projects} projectsDisabled={false} disabled={pending} defaults={invoice} />
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Descartar un borrador, con confirmación. Queda oculto y su número no se reutiliza. */
export function DiscardDraftForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(discardInvoiceAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="danger" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        Descartar borrador
      </button>
    );
  }
  return (
    <form action={action} className="decision" style={{ marginTop: 8 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="sub" style={{ margin: 0 }}>El borrador deja de verse. Su número no se reutiliza.</p>
      <div className="actions">
        <button type="submit" className="danger" disabled={pending}>
          {pending ? "Descartando…" : "Confirmar descarte"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Recordatorio: reenvía al cliente una factura emitida y sin pagar. */
export function ReminderForm({ invoiceId, overdue }: { invoiceId: string; overdue: boolean }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(remindInvoiceAction, null);
  return (
    <form action={action} className="decision" style={{ marginTop: 8 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="sub" style={{ margin: 0 }}>{overdue ? "Esta factura ya venció." : "Todavía no vence."} El cliente recibe el correo otra vez.</p>
      <div className="actions">
        <button type="submit" className="secondary" disabled={pending}>
          {pending ? "Enviando…" : "Reenviar recordatorio"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Nota de crédito sobre una factura pagada. El monto no puede pasar de lo que queda por devolver. */
export function CreditNoteForm({ invoiceId, remainingCents }: { invoiceId: string; remainingCents: number }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(creditNoteAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        Nota de crédito
      </button>
    );
  }
  return (
    <form action={action} className="decision" style={{ marginTop: 8 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="sub" style={{ margin: 0 }}>Queda por devolver {money.format(remainingCents / 100)}. El monto vuelve al medio de pago del cliente desde Stripe.</p>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Monto (USD)
          <input name="amount" inputMode="decimal" required disabled={pending} placeholder="150.00" />
        </label>
        <label className="field" style={{ flex: "1 1 220px" }}>
          Motivo (visible para el cliente)
          <input name="reason" required maxLength={140} disabled={pending} placeholder="Horas no prestadas" />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="danger" disabled={pending}>
          {pending ? "Creando…" : "Crear nota de crédito"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Anular una factura emitida, con confirmación. */
export function VoidInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(voidInvoiceAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="danger" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        Anular factura
      </button>
    );
  }
  return (
    <form action={action} className="decision" style={{ marginTop: 8 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="sub" style={{ margin: 0 }}>Se anula la factura en Stripe. Queda en la bitácora; no se borra.</p>
      <div className="actions">
        <button type="submit" className="danger" disabled={pending}>
          {pending ? "Anulando…" : "Confirmar anulación"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}
