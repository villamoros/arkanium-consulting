import Link from "next/link";
import { leadSourceValues, type Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { FAMILY_LABEL, LEAD_STATUS_LABEL, SOURCE_LABEL, formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";

const STATUSES = ["nuevo", "calificado", "pospuesto", "descartado", "convertido"] as const;

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ estado?: string; origen?: string; q?: string }> }) {
  const { estado, origen, q } = await searchParams;
  const filter = STATUSES.find((s) => s === estado);

  let leads: Lead[];
  try {
    ({ leads } = await apiFetch<{ leads: Lead[] }>("/leads"));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar los leads.";
    return (
      <StatePanel title="No pudimos cargar los leads">
        <p>{message}</p>
        <p>Ningún lead se ha modificado.</p>
        <Link href="/leads" className="primary" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, marginTop: 12 }}>
          Reintentar
        </Link>
      </StatePanel>
    );
  }

  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length])) as Record<(typeof STATUSES)[number], number>;
  const byStatus = filter ? leads.filter((l) => l.status === filter) : leads;
  // Búsqueda por nombre, correo o empresa, sin distinguir mayúsculas.
  const term = (q ?? "").trim().toLowerCase();
  const bySearch = term
    ? byStatus.filter((l) => [l.name, l.email, l.company ?? ""].some((value) => value.toLowerCase().includes(term)))
    : byStatus;
  const visible = origen ? bySearch.filter((l) => l.source === origen) : bySearch;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p>Personas y empresas que llegaron por el sitio, las redes o un mensaje directo. Tú decides qué pasa con cada una.</p>
        </div>
        <Link href="/leads/nuevo" className="primary" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6 }}>
          Nuevo lead
        </Link>
      </div>

      <div className="approval" role="note">
        <span aria-hidden="true">◈</span>
        <div>
          <strong>Las propuestas de los agentes son solo sugerencias.</strong> Calificar, posponer, descartar o convertir en organización es decisión tuya.
        </div>
      </div>

      <div className="kpis" aria-label="Resumen por estado">
        <div className="kpi">
          <b>{counts.nuevo}</b>
          <span>nuevos</span>
        </div>
        <div className="kpi">
          <b>{counts.calificado}</b>
          <span>calificados</span>
        </div>
        <div className="kpi">
          <b>{counts.pospuesto}</b>
          <span>pospuestos</span>
        </div>
        <div className="kpi">
          <b>{counts.convertido}</b>
          <span>convertidos</span>
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar por nombre, correo o empresa
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q ?? ""} placeholder="Buscar por nombre, correo o empresa" />
        <label className="sr" htmlFor="f-estado">
          Filtrar por estado
        </label>
        <select id="f-estado" name="estado" defaultValue={filter ?? ""}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="sr" htmlFor="f-origen">
          Filtrar por origen
        </label>
        <select id="f-origen" name="origen" defaultValue={origen ?? ""}>
          <option value="">Todos los orígenes</option>
          {leadSourceValues.map((key) => (
            <option key={key} value={key}>
              {SOURCE_LABEL[key]}
            </option>
          ))}
        </select>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      {leads.length === 0 ? (
        <StatePanel title="Todavía no hay leads">
          <p>Cuando alguien escriba desde el sitio, aparecerá aquí con su mensaje y la propuesta del agente.</p>
        </StatePanel>
      ) : visible.length === 0 ? (
        <section className="panel pad">
          <p className="muted">No hay leads con ese estado.</p>
        </section>
      ) : (
        <section className="panel" aria-label="Lista de leads">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Lead</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="hide-sm">Propuesta del agente</th>
                  <th scope="col">Recibido</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/leads/${lead.id}`} className="row-link">
                        <span className="lead-name">{lead.name}</span>
                        <br />
                        <span className="sub">
                          {lead.company || "Sin empresa indicada"} · {SOURCE_LABEL[lead.source] ?? lead.source}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge b-${lead.status}`}>{LEAD_STATUS_LABEL[lead.status]}</span>
                    </td>
                    <td className="hide-sm">
                      <span className="sub">{lead.proposedFamily ? FAMILY_LABEL[lead.proposedFamily] : "Sin propuesta"}</span>
                    </td>
                    <td className="sub">{formatDate(lead.receivedAt)}</td>
                    <td>
                      <Link href={`/leads/${lead.id}/editar`} className="secondary" style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6 }}>
                        {lead.status === "convertido" ? "Editar contacto" : "Editar"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
