import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { FAMILY_LABEL, PHASE_LABEL } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { CreateProjectForm } from "@/components/projects/project-forms";
import { ProjectDetail, type ProjectDetailData } from "@/components/projects/project-detail";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type ProjectRow = {
  id: string;
  name: string;
  organizationName: string;
  serviceFamily: keyof typeof FAMILY_LABEL;
  phase: keyof typeof PHASE_LABEL;
  progress: string;
  nextStep: string;
};

const PHASE_NUMBER: Record<keyof typeof PHASE_LABEL, number> = { evaluar: 1, arquitectar: 2, modernizar: 3, escalar: 4 };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; familia?: string; id?: string }> }) {
  const { q = "", familia = "", id = "" } = await searchParams;

  let projects: ProjectRow[];
  let clients: Array<{ id: string; name: string }>;
  try {
    const [projectData, clientData] = await Promise.all([
      apiFetch<{ projects: ProjectRow[] }>("/projects"),
      apiFetch<{ organizations: Array<{ id: string; name: string }> }>("/client-organizations"),
    ]);
    projects = projectData.projects;
    clients = clientData.organizations;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar los proyectos.";
    return (
      <StatePanel title="No pudimos cargar los proyectos">
        <p>{message}</p>
        <p>Ningún proyecto se ha modificado.</p>
      </StatePanel>
    );
  }

  const term = q.trim().toLowerCase();
  const filtered = projects.filter(
    (project) =>
      (!term || `${project.name} ${project.organizationName}`.toLowerCase().includes(term)) && (!familia || project.serviceFamily === familia),
  );
  const selectedRow = filtered.find((project) => project.id === id) ?? filtered[0];

  let detail: ProjectDetailData | null = null;
  if (selectedRow) {
    try {
      detail = await apiFetch<ProjectDetailData>(`/projects/${selectedRow.id}`);
    } catch {
      detail = null;
    }
  }

  // Los enlaces de la lista conservan los filtros y cambian solo el proyecto seleccionado.
  const linkFor = (projectId: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (familia) params.set("familia", familia);
    params.set("id", projectId);
    return `/proyectos?${params.toString()}`;
  };

  const withoutNextStep = projects.filter((project) => !project.nextStep.trim()).length;
  const early = projects.filter((project) => PHASE_NUMBER[project.phase] <= 2).length;
  const scaling = projects.filter((project) => project.phase === "escalar").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Proyectos</h1>
          <p>Servicios contratados para cada cliente, con su fase del framework, sus hitos y su siguiente paso.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen">
        <div className="kpi">
          <b>{projects.length}</b>
          <span>proyectos activos</span>
        </div>
        <div className="kpi">
          <b>{early}</b>
          <span>en evaluar o arquitectar</span>
        </div>
        <div className="kpi">
          <b>{scaling}</b>
          <span>escalando</span>
        </div>
        <div className="kpi">
          <b>{withoutNextStep}</b>
          <span>sin siguiente paso definido</span>
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar proyectos
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q} placeholder="Buscar por proyecto u organización" />
        <label className="sr" htmlFor="f-familia">
          Familia
        </label>
        <select id="f-familia" name="familia" defaultValue={familia}>
          <option value="">Todas las familias</option>
          {(Object.keys(FAMILY_LABEL) as Array<keyof typeof FAMILY_LABEL>)
            .filter((key) => key !== "unknown")
            .map((key) => (
              <option key={key} value={key}>
                {FAMILY_LABEL[key]}
              </option>
            ))}
        </select>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      <details className="panel pad" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Crear un proyecto</summary>
        <div style={{ marginTop: 10 }}>
          {clients.length === 0 ? <p className="muted">Primero necesitas un cliente: conviértelo desde Leads.</p> : <CreateProjectForm clients={clients} />}
        </div>
      </details>

      <div className="layout">
        <section className="panel" aria-label="Lista de proyectos">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>
              {projects.length === 0 ? "Todavía no hay proyectos. Cuando creas uno para un cliente, aparece aquí." : "No hay proyectos con esos filtros."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Proyecto</th>
                  <th scope="col">Fase</th>
                  <th scope="col" className="hide-sm">Avance</th>
                  <th scope="col" className="hide-sm">Siguiente paso</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id} aria-selected={project.id === selectedRow?.id}>
                    <td>
                      <Link href={linkFor(project.id)} className="row-link">
                        <div className="lead-name">{project.name}</div>
                        <div className="sub">
                          {project.organizationName} · {FAMILY_LABEL[project.serviceFamily]}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div>{PHASE_LABEL[project.phase]}</div>
                      <div className="sub">Fase {PHASE_NUMBER[project.phase]} de 4</div>
                    </td>
                    <td className="hide-sm">
                      <span className="sub">{project.progress || "Sin registrar"}</span>
                    </td>
                    <td className="hide-sm">
                      <span className="sub">{project.nextStep || "Sin definir"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle del proyecto">
          {selectedRow && detail ? (
            <ProjectDetail detail={detail} organizationName={selectedRow.organizationName} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {selectedRow ? "No pudimos cargar este proyecto." : "Selecciona un proyecto para ver su detalle."}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
