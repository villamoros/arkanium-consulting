"use client";

import { Notice } from "@/components/ui/notice";
import { useActionState, useState, type ReactNode } from "react";
import { marketingAction, type MarketingActionState } from "@/app/(protected)/mercadeo/actions";

export type MktField = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "email" | "url" | "date" | "select" | "checkboxes";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  defaultChecked?: string[];
  maxLength?: number;
};

/** Formulario que se abre con un botón y se queda abierto hasta que lo cierres. Todas las acciones de Mercadeo pasan por aquí. */
export function MktForm({
  op,
  id,
  fields,
  submit,
  tone = "primary",
  label,
  intro,
  compact = false,
}: {
  op: string;
  id?: string;
  fields: MktField[];
  submit: string;
  tone?: "primary" | "secondary" | "danger";
  label: string;
  intro?: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MarketingActionState, FormData>(marketingAction, null);

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ marginTop: compact ? 0 : 8 }}>
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="decision" style={{ marginTop: compact ? 0 : 8 }}>
      <input type="hidden" name="op" value={op} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {intro ? <div className="sub" style={{ marginBottom: 6 }}>{intro}</div> : null}
      {fields.map((field) => (
        <label key={field.name} className="field">
          {field.label}
          {field.kind === "textarea" ? (
            <textarea name={field.name} required={field.required} maxLength={field.maxLength} defaultValue={field.defaultValue} placeholder={field.placeholder} disabled={pending} style={{ minHeight: 80 }} />
          ) : field.kind === "select" ? (
            <select name={field.name} required={field.required} defaultValue={field.defaultValue ?? ""} disabled={pending}>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.kind === "checkboxes" ? (
            <span style={{ display: "flex", flexWrap: "wrap", gap: 12, fontWeight: 400 }}>
              {field.options?.map((option) => (
                <label key={option.value} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" name={field.name} value={option.value} defaultChecked={field.defaultChecked?.includes(option.value)} disabled={pending} />
                  {option.label}
                </label>
              ))}
            </span>
          ) : (
            <input
              type={field.kind === "email" ? "email" : field.kind === "url" ? "url" : field.kind === "date" ? "date" : "text"}
              name={field.name}
              required={field.required}
              maxLength={field.maxLength}
              defaultValue={field.defaultValue}
              placeholder={field.placeholder}
              disabled={pending}
            />
          )}
        </label>
      ))}
      <div className="actions">
        <button type="submit" className={tone} disabled={pending}>
          {pending ? "Guardando…" : submit}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cerrar
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Acción inmediata sin formulario (pausar, reanudar, descartar). Una confirmación previa la pone quien la usa. */
export function MktButton({ op, id, label, tone = "secondary", extra = {} }: { op: string; id?: string; label: string; tone?: "primary" | "secondary" | "danger"; extra?: Record<string, string> }) {
  const [state, action, pending] = useActionState<MarketingActionState, FormData>(marketingAction, null);
  return (
    <form action={action} style={{ display: "inline-block", marginTop: 8 }}>
      <input type="hidden" name="op" value={op} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {Object.entries(extra).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={tone} disabled={pending}>
        {pending ? "Guardando…" : label}
      </button>
      {state ? (
        <p role="status" className={state.ok ? "notice-ok" : "notice-bad"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
