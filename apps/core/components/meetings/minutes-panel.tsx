"use client";

import { Notice } from "@/components/ui/notice";
import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createMinutesAction,
  deleteMinutesAction,
  updateMinutesAction,
  type MeetingActionState,
} from "@/app/(protected)/reuniones/actions";
import { formatDate } from "@/lib/labels";

export type MinutesHistoryEntry = {
  id: string;
  action: "minutes.created" | "minutes.edited" | "minutes.deleted" | "minutes.published";
  at: string;
  actor: string;
  text: string | null;
  previousText: string | null;
};

const ACTION_LABEL: Record<MinutesHistoryEntry["action"], string> = {
  "minutes.created": "Acta creada",
  "minutes.edited": "Acta editada",
  "minutes.deleted": "Acta eliminada",
  "minutes.published": "Acta publicada (registro anterior)",
};

const ACTION_TONE: Record<MinutesHistoryEntry["action"], string> = {
  "minutes.created": "tl-create",
  "minutes.edited": "tl-edit",
  "minutes.deleted": "tl-delete",
  "minutes.published": "tl-create",
};

/** Botón que abre un formulario y lo cierra al cancelar. */
function Disclosure({ label, tone = "secondary", children }: { label: string; tone?: "secondary" | "danger"; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={tone} onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {label}
      </button>
    );
  }
  return <>{children()}</>;
}

function CreateMinutesForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(createMinutesAction, null);
  return (
    <Disclosure label="Crear acta">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Acta de la reunión
            <textarea name="text" required maxLength={20000} disabled={pending} style={{ minHeight: 140 }} placeholder="Acuerdos, decisiones y próximos pasos" />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Guardando…" : "Crear acta"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

function EditMinutesForm({ meetingId, text }: { meetingId: string; text: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(updateMinutesAction, null);
  return (
    <Disclosure label="Editar acta">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <label className="field">
            Acta de la reunión
            <textarea name="text" required maxLength={20000} defaultValue={text} disabled={pending} style={{ minHeight: 160 }} />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

function DeleteMinutesForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState<MeetingActionState, FormData>(deleteMinutesAction, null);
  return (
    <Disclosure label="Eliminar acta" tone="danger">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="meetingId" value={meetingId} />
          <p className="sub" style={{ margin: 0 }}>El cliente deja de ver el acta. El texto queda guardado en la bitácora.</p>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Eliminando…" : "Confirmar eliminación"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Modal de una entrada de la bitácora. Dentro está el acta vigente, con sus acciones de crear, editar y eliminar. */
function MinutesDialog({
  meetingId,
  minutesText,
  published,
  entry,
  onClose,
}: {
  meetingId: string;
  minutesText: string | null;
  published: boolean;
  entry: MinutesHistoryEntry | null;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-back open" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="minutes-dialog-title">
        <div className="head">
          <h2 id="minutes-dialog-title" style={{ margin: 0 }}>{entry ? ACTION_LABEL[entry.action] : "Acta de la reunión"}</h2>
          <button type="button" className="secondary" onClick={onClose} ref={closeButton}>
            Cerrar
          </button>
        </div>

        {entry ? (
          <div className="section">
            <p className="sub" style={{ margin: "0 0 8px" }}>{formatDate(entry.at)}</p>
            {entry.previousText ? (
              <>
                <h3>Texto anterior</h3>
                <div className="panel" style={{ padding: 12, whiteSpace: "pre-wrap" }}>{entry.previousText}</div>
              </>
            ) : null}
            {entry.text ? (
              <>
                <h3 style={{ marginTop: 12 }}>Texto de esta versión</h3>
                <div className="panel" style={{ padding: 12, whiteSpace: "pre-wrap" }}>{entry.text}</div>
              </>
            ) : null}
            {entry.action === "minutes.deleted" ? <p className="sub" style={{ margin: "8px 0 0" }}>Esta acta se eliminó. Su texto queda en la bitácora.</p> : null}
          </div>
        ) : null}

        <div className="section decision">
          <h3>Acta vigente</h3>
          {published && minutesText ? (
            <div className="panel" style={{ padding: 12, whiteSpace: "pre-wrap" }}>{minutesText}</div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Esta reunión no tiene acta.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {published && minutesText ? (
              <>
                <EditMinutesForm meetingId={meetingId} text={minutesText} />
                <DeleteMinutesForm meetingId={meetingId} />
              </>
            ) : (
              <CreateMinutesForm meetingId={meetingId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Acta de una reunión que ya finalizó: el texto vigente y una línea de tiempo de la bitácora.
 * Cada entrada se abre en un modal, y el modal permite crear, editar o eliminar el acta.
 */
export function MinutesPanel({
  meetingId,
  minutesText,
  published,
  history,
}: {
  meetingId: string;
  minutesText: string | null;
  published: boolean;
  history: MinutesHistoryEntry[] | null;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; entry: MinutesHistoryEntry | null }>({ open: false, entry: null });
  const close = useCallback(() => setDialog({ open: false, entry: null }), []);

  return (
    <section className="section" aria-label="Acta y bitácora" style={{ marginTop: 12 }}>
      <div className="head" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Acta</h3>
        <span className={`badge ${published ? "b-convertido" : "b-idle"}`}>{published ? "Publicada" : "Sin acta"}</span>
      </div>

      {published && minutesText ? (
        <div className="panel" style={{ padding: 12, whiteSpace: "pre-wrap" }}>
          {minutesText}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Todavía no hay acta de esta reunión.</p>
      )}

      <button type="button" className="primary" onClick={() => setDialog({ open: true, entry: null })} style={{ marginTop: 8 }}>
        {published ? "Gestionar acta" : "Crear acta"}
      </button>

      <h3 style={{ marginTop: 16 }}>Bitácora{history ? ` (${history.length})` : ""}</h3>
      {history === null ? (
        <p className="notice-bad" role="note">No pudimos cargar la bitácora de esta reunión.</p>
      ) : history.length === 0 ? (
        <p className="muted">Todavía no hay cambios registrados.</p>
      ) : (
        <ol className="timeline" aria-label="Historial del acta">
          {history.map((entry) => {
            const preview = (entry.text ?? entry.previousText ?? "").replace(/\s+/g, " ").slice(0, 90);
            return (
              <li key={entry.id} className={ACTION_TONE[entry.action]}>
                <button type="button" className="tl-item" onClick={() => setDialog({ open: true, entry })} aria-label={`Abrir: ${ACTION_LABEL[entry.action]}, ${formatDate(entry.at)}`}>
                  <span style={{ display: "block", fontWeight: 600 }}>{ACTION_LABEL[entry.action]}</span>
                  <span className="sub" style={{ display: "block" }}>{formatDate(entry.at)}{preview ? ` · ${preview}${preview.length === 90 ? "…" : ""}` : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {dialog.open ? (
        <MinutesDialog meetingId={meetingId} minutesText={minutesText} published={published} entry={dialog.entry} onClose={close} />
      ) : null}
    </section>
  );
}
