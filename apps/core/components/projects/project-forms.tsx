"use client";

import { Notice } from "@/components/ui/notice";
import { useActionState, useState, type ReactNode } from "react";
import {
  addMilestoneAction,
  archiveProjectAction,
  createProjectAction,
  setMilestoneStatusAction,
  updateProjectAction,
  type ProjectActionState,
} from "@/app/(protected)/proyectos/actions";
import { PHASE_LABEL, FAMILY_LABEL } from "@/lib/labels";

function Disclosure({ label, children }: { label: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {label}
      </button>
    );
  }
  return <div style={{ marginTop: 8 }}>{children()}</div>;
}

const FAMILIES = Object.keys(FAMILY_LABEL) as Array<keyof typeof FAMILY_LABEL>;
const PHASES = Object.keys(PHASE_LABEL) as Array<keyof typeof PHASE_LABEL>;

/** Crear un proyecto para un cliente. */
export function CreateProjectForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(createProjectAction, null);
  return (
    <form action={action} className="decision">
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field" style={{ flex: "1 1 240px" }}>
          Cliente
          <select name="organizationId" required defaultValue="" disabled={pending}>
            <option value="" disabled>
              Elige…
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: "1 1 240px" }}>
          Nombre del proyecto
          <input name="name" required maxLength={160} disabled={pending} />
        </label>
      </div>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field">
          Familia
          <select name="serviceFamily" defaultValue="unknown" disabled={pending}>
            {FAMILIES.map((key) => (
              <option key={key} value={key}>
                {FAMILY_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Fase
          <select name="phase" defaultValue="evaluar" disabled={pending}>
            {PHASES.map((key) => (
              <option key={key} value={key}>
                {PHASE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Avance (lo que ya está hecho)
        <input name="progress" maxLength={500} disabled={pending} />
      </label>
      <label className="field">
        Siguiente paso
        <input name="nextStep" maxLength={300} disabled={pending} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Creando…" : "Crear proyecto"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Corregir nombre, familia, fase, avance y siguiente paso. */
export function EditProjectForm({
  projectId,
  name,
  serviceFamily,
  phase,
  progress,
  nextStep,
}: {
  projectId: string;
  name: string;
  serviceFamily: keyof typeof FAMILY_LABEL;
  phase: keyof typeof PHASE_LABEL;
  progress: string;
  nextStep: string;
}) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(updateProjectAction, null);
  return (
    <Disclosure label="Editar proyecto">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="field">
            Nombre
            <input name="name" defaultValue={name} maxLength={160} disabled={pending} />
          </label>
          <div className="filters" style={{ marginBottom: 0 }}>
            <label className="field">
              Familia
              <select name="serviceFamily" defaultValue={serviceFamily} disabled={pending}>
                {FAMILIES.map((key) => (
                  <option key={key} value={key}>
                    {FAMILY_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Fase
              <select name="phase" defaultValue={phase} disabled={pending}>
                {PHASES.map((key) => (
                  <option key={key} value={key}>
                    {PHASE_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Avance
            <input name="progress" defaultValue={progress} maxLength={500} disabled={pending} />
          </label>
          <label className="field">
            Siguiente paso
            <input name="nextStep" defaultValue={nextStep} maxLength={300} disabled={pending} />
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

/** Agregar un hito con fecha prevista opcional. */
export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(addMilestoneAction, null);
  return (
    <form action={action} className="decision">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="field" style={{ flex: "1 1 240px" }}>
          Hito
          <input name="name" required maxLength={160} disabled={pending} placeholder="Por ejemplo: informe preliminar" />
        </label>
        <label className="field">
          Fecha prevista (Bogotá, opcional)
          <input type="datetime-local" name="plannedDate" disabled={pending} />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="secondary" disabled={pending}>
          Agregar hito
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Cambiar el estado de un hito desde la lista. */
export function MilestoneStatusForm({ projectId, milestoneId, status }: { projectId: string; milestoneId: string; status: string }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(setMilestoneStatusAction, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <select name="status" defaultValue={status} disabled={pending} aria-label="Estado del hito">
        <option value="pendiente">Pendiente</option>
        <option value="en_curso">En curso</option>
        <option value="completado">Completado</option>
      </select>
      <button type="submit" className="secondary" disabled={pending} style={{ padding: "4px 10px" }}>
        Guardar
      </button>
      {state ? <span role="status" className={state.ok ? "notice-ok" : "notice-bad"}>{state.message}</span> : null}
    </form>
  );
}

/** Archivar con motivo. No borra: el proyecto deja de aparecer en Core y en la app del cliente. */
export function ArchiveProjectForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ProjectActionState, FormData>(archiveProjectAction, null);
  return (
    <Disclosure label="Archivar proyecto">
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="field">
            Motivo
            <textarea name="reason" required maxLength={1000} disabled={pending} placeholder="Por qué se archiva (queda en el registro)" />
          </label>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Archivando…" : "Archivar"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}
