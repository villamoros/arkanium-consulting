import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { StatePanel } from "@/components/state-panel";
import { ClientDetail, type ClientDetailData } from "@/components/clients/client-detail";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type ClientRow = {
  id: string;
  name: string;
  status: "active" | "suspended";
  projectCount: number;
  memberCount: number;
  pendingInvitations: number;
  people: string[];
};
type ProjectRow = { id: string; name: string; phase: string; organizationId: string };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { q = "", id = "" } = await searchParams;

  let clients: ClientRow[];
  let projects: ProjectRow[];
  try {
    const [clientData, projectData] = await Promise.all([
      apiFetch<{ organizations: ClientRow[] }>("/client-organizations"),
      apiFetch<{ projects: ProjectRow[] }>("/projects"),
    ]);
    clients = clientData.organizations;
    projects = projectData.projects;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar los clientes.";
    return (
      <StatePanel title="No pudimos cargar los clientes">
        <p>{message}</p>
        <p>Ningún cliente se ha modificado.</p>
      </StatePanel>
    );
  }

  const term = q.trim().toLowerCase();
  // La búsqueda alcanza el nombre de la organización y el de sus personas.
  const filtered = clients.filter((client) => !term || `${client.name} ${client.people.join(" ")}`.toLowerCase().includes(term));
  const selectedRow = filtered.find((client) => client.id === id) ?? filtered[0];

  let detail: ClientDetailData | null = null;
  if (selectedRow) {
    try {
      const [organizationData, decisionData] = await Promise.all([
        apiFetch<{
          organization: ClientDetailData["organization"];
          members: ClientDetailData["members"];
          membersUnavailable: boolean;
          invitations: ClientDetailData["invitations"];
          invitationsUnavailable: boolean;
        }>(`/organizations/${selectedRow.id}`),
        apiFetch<{ decisions: ClientDetailData["decisions"] }>(`/organizations/${selectedRow.id}/decisions`),
      ]);
      detail = {
        organization: organizationData.organization,
        members: organizationData.members,
        membersUnavailable: organizationData.membersUnavailable,
        invitations: organizationData.invitations,
        invitationsUnavailable: organizationData.invitationsUnavailable,
        decisions: decisionData.decisions,
      };
    } catch {
      detail = null;
    }
  }

  const linkFor = (clientId: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("id", clientId);
    return `/clientes?${params.toString()}`;
  };

  const suspendedCount = clients.filter((client) => client.status === "suspended").length;
  const totalPeople = clients.reduce((sum, client) => sum + client.memberCount, 0);
  const activeProjects = projects.length;
  const selectedProjects = selectedRow ? projects.filter((project) => project.organizationId === selectedRow.id) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>Organizaciones clientes, sus proyectos y sus personas. Las invitaciones y las bajas las haces tú.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen">
        <div className="kpi">
          <b>{clients.length}</b>
          <span>organizaciones clientes</span>
        </div>
        <div className="kpi">
          <b>{suspendedCount}</b>
          <span>accesos suspendidos</span>
        </div>
        <div className="kpi">
          <b>{activeProjects}</b>
          <span>proyectos activos</span>
        </div>
        <div className="kpi">
          <b>{totalPeople}</b>
          <span>personas con acceso</span>
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar clientes
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q} placeholder="Buscar por organización o persona" />
        <button type="submit" className="secondary">
          Buscar
        </button>
      </form>

      <div className="layout">
        <section className="panel" aria-label="Organizaciones clientes">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>
              {clients.length === 0 ? "Todavía no hay clientes. Se crean al convertir un lead." : "No hay clientes con esa búsqueda."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Organización</th>
                  <th scope="col">Acceso</th>
                  <th scope="col" className="hide-sm">Personas</th>
                  <th scope="col" className="hide-sm">Proyectos</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} aria-selected={client.id === selectedRow?.id}>
                    <td>
                      <Link href={linkFor(client.id)} className="row-link">
                        <div className="lead-name">{client.name}</div>
                        <div className="sub">Cliente</div>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${client.status === "suspended" ? "b-descartado" : "b-convertido"}`}>
                        {client.status === "suspended" ? "Suspendido" : "Activo"}
                      </span>
                    </td>
                    <td className="hide-sm">
                      {client.memberCount}
                      {client.pendingInvitations > 0 ? <span className="sub"> + {client.pendingInvitations} invitación</span> : null}
                    </td>
                    <td className="hide-sm">{client.projectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle de la organización">
          {selectedRow && detail ? (
            <ClientDetail detail={detail} projects={selectedProjects} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {selectedRow ? "No pudimos cargar este cliente." : "Selecciona una organización para ver su detalle."}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
