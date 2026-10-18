"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

export type ActionResult = { ok: boolean; message: string } | null;

/**
 * Acción destructiva con confirmación. Toda eliminación, descarte o anulación de Core pasa por aquí.
 * Recibe una acción de servidor (con sus campos) o una función del cliente. Escape y el fondo cierran el diálogo.
 */
export function ConfirmAction({
  label,
  title,
  body,
  confirmLabel,
  action,
  fields = {},
  onConfirm,
  tone = "danger",
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  action?: (previous: ActionResult, formData: FormData) => Promise<ActionResult>;
  fields?: Record<string, string>;
  onConfirm?: () => Promise<ActionResult>;
  tone?: "danger" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const titleId = useId();
  const confirmButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    confirmButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function confirm() {
    start(async () => {
      let next: ActionResult = null;
      if (onConfirm) {
        next = await onConfirm();
      } else if (action) {
        const data = new FormData();
        for (const [name, value] of Object.entries(fields)) data.set(name, value);
        next = await action(null, data);
      }
      setResult(next);
      if (next?.ok) setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className={tone}
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        style={{ marginTop: 8 }}
      >
        {label}
      </button>
      {open ? (
        <div className="dialog-back open" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <h2 id={titleId}>{title}</h2>
            <p className="muted">{body}</p>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </button>
              <button type="button" className={tone} ref={confirmButton} onClick={confirm} disabled={pending}>
                {pending ? "Procesando…" : confirmLabel}
              </button>
            </div>
            {result && !result.ok ? (
              <p role="status" className="notice-bad">
                {result.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
