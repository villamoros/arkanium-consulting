import { FAMILY_LABEL, PHASE_LABEL, formatDate } from "@/lib/labels";
import { AddMilestoneForm, ArchiveProjectForm, EditProjectForm, MilestoneStatusForm } from "@/components/projects/project-forms";

const PHASE_ORDER = ["evaluar", "arquitectar", "modernizar", "escalar"] as const;

const MILESTONE_LABEL: Record<"pendiente" | "en_curso" | "completado", string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completado: "Completado",
};

/** Clase de la compuerta según el estado del hito: aprobada, en revisión o pendiente. */
const MILESTONE_GATE: Record<"pendiente" | "en_curso" | "completado", "pending" | "review" | "passed"> = {
  pendiente: "pending",
  en_curso: "review",
  completado: "passed",
};

const DELIVERABLE_LABEL: Record<string, string> = {
  en_revision: "En revisión",
  publicado: "Publicado",
  con_correcciones: "Con correcciones",
  aprobado: "Aprobado",
};

export type ProjectDetailData = {
  project: {
    id: string;
    name: string;
    serviceFamily: keyof typeof FAMILY_LABEL;
    phase: keyof typeof PHASE_LABEL;
    progress: string;
    nextStep: string;
  };
  milestones: Array<{ id: string; name: string; status: keyof typeof MILESTONE_LABEL; plannedDate: string | null; dateChanged: boolean }>;
  deliverables: Array<{ id: string; title: string; version: number; status: string }>;
};

/** Detalle del proyecto seleccionado, con las secciones del diseño de core: fase, compuertas, entregables y edición. */
export function ProjectDetail({ detail, organizationName }: { detail: ProjectDetailData; organizationName: string }) {
  const { project, milestones, deliverables } = detail;
  const phaseIndex = PHASE_ORDER.indexOf(project.phase);

  return (
    <>
      <div className="head">
        <div>
          <h2>{project.name}</h2>
          <div className="sub">{organizationName || "Cliente sin nombre"}</div>
        </div>
        <span className="badge b-nuevo">{FAMILY_LABEL[project.serviceFamily]}</span>
      </div>

      <div className="section">
        <h3>Fase del framework</h3>
        <div className="phases" role="list">
          {PHASE_ORDER.map((phase, index) => (
            <div key={phase} role="listitem" className={`phase ${index < phaseIndex ? "done" : index === phaseIndex ? "current" : ""}`}>
              {PHASE_LABEL[phase]}
              <small>{index < phaseIndex ? "Completada" : index === phaseIndex ? "En curso" : "Pendiente"}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Compuertas (hitos)</h3>
        {milestones.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay hitos.</p>
        ) : (
          <>
            <div className="gates">
              {milestones.map((milestone, index) => (
                <span key={milestone.id} className={`gate ${MILESTONE_GATE[milestone.status]}`}>
                  G{index + 1} · {MILESTONE_LABEL[milestone.status]}
                </span>
              ))}
            </div>
            <ul className="checks" style={{ marginTop: 12 }}>
              {milestones.map((milestone) => (
                <li key={milestone.id} style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 180px" }}>
                    {milestone.name}
                    <span className="sub">
                      {" · "}
                      {milestone.plannedDate ? formatDate(milestone.plannedDate) : "Sin fecha"}
                      {milestone.dateChanged ? " · fecha cambiada" : ""}
                    </span>
                  </span>
                  <MilestoneStatusForm projectId={project.id} milestoneId={milestone.id} status={milestone.status} />
                </li>
              ))}
            </ul>
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <AddMilestoneForm projectId={project.id} />
        </div>
      </div>

      <div className="section">
        <h3>Avance y siguiente paso</h3>
        <dl className="kv">
          <dt>Avance</dt>
          <dd>{project.progress || <span className="muted">Sin registrar.</span>}</dd>
          <dt>Siguiente paso</dt>
          <dd>{project.nextStep || <span className="muted">Sin definir.</span>}</dd>
        </dl>
      </div>

      <div className="section">
        <h3>Entregables</h3>
        {deliverables.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay entregables.</p>
        ) : (
          <ul className="checks">
            {deliverables.map((deliverable) => (
              <li key={deliverable.id}>
                <span>
                  {deliverable.title} <span className="sub">· v{deliverable.version}</span>
                </span>
                <span className="sub" style={{ marginLeft: "auto" }}>
                  {DELIVERABLE_LABEL[deliverable.status] ?? deliverable.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h3>Editar</h3>
        <EditProjectForm
          projectId={project.id}
          name={project.name}
          serviceFamily={project.serviceFamily}
          phase={project.phase}
          progress={project.progress}
          nextStep={project.nextStep}
        />
      </div>

      <div className="section">
        <h3>Archivar</h3>
        <p className="sub" style={{ margin: 0 }}>
          Deja de aparecer aquí y en la app del cliente. No se borra: su historial se conserva.
        </p>
        <ArchiveProjectForm projectId={project.id} />
      </div>
    </>
  );
}
