import { connection } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { PauseControl } from "@/components/emergency/pause-control";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type AgentStatus = "definido" | "activo" | "pausado";
type Overview = {
  paused: boolean;
  reason: string | null;
  pausedAt: string | null;
  totals: { total: number; active: number; paused: number; operating: number };
  departments: Array<{ id: string; name: string; total: number; active: number; paused: number; defined: number }>;
  agents: Array<{
    id: string;
    code: string;
    name: string;
    service: string;
    department: string;
    status: AgentStatus;
    operation: "sin_operacion" | "operando";
    pauseReason: string | null;
    pausedAt: string | null;
  }>;
};

const STATUS_LABEL: Record<AgentStatus, string> = { activo: "Activo", pausado: "En pausa", definido: "Definido (sin activar)" };
const STATUS_BADGE: Record<AgentStatus, string> = { activo: "b-convertido", pausado: "b-pospuesto", definido: "b-idle" };

export default async function EmergencyPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d = "" } = await searchParams;

  let overview: Overview;
  try {
    overview = await apiFetch<Overview>("/emergency");
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar las pausas de emergencia.";
    return (
      <StatePanel title="No pudimos cargar las pausas">
        <p>{message}</p>
        <p>Ningún agente cambió de estado.</p>
      </StatePanel>
    );
  }

  // Depende de cuándo se atiende la petición: connection() lo marca como dinámico.
  await connection();

  const selected = overview.departments.find((department) => department.id === d) ?? overview.departments[0]!;
  const agents = overview.agents.filter((agent) => agent.department === selected.id);
  const { totals } = overview;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pausas de emergencia</h1>
          <p>Detén agentes de inmediato. Pausar no borra trabajo ni cancela lo ya aprobado: cada agente se detiene en su siguiente paso seguro y deja nota de dónde quedó.</p>
        </div>
      </div>

      <div
        className="approval"
        role="status"
        style={overview.paused ? { borderColor: "var(--bad)" } : undefined}
      >
        <span aria-hidden="true">◈</span>
        <div>
          {overview.paused ? (
            <>
              <strong>Todo está en pausa.</strong> Ningún agente actúa{overview.reason ? `: ${overview.reason}` : ""}.
              {overview.pausedAt ? <span className="sub"> Desde {formatDate(overview.pausedAt)}.</span> : null} Las acciones pendientes de tu aprobación siguen en Aprobaciones y no se envían.
            </>
          ) : (
            <>
              <strong>Operación normal.</strong> {totals.active} agentes activos y {totals.paused} en pausa. Puedes pausar uno, un departamento o todo.
            </>
          )}
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de agentes">
        <div className="kpi">
          <b>{totals.operating}</b>
          <span>agentes operando</span>
        </div>
        <div className="kpi">
          <b>{totals.paused}</b>
          <span>en pausa</span>
        </div>
        <div className="kpi">
          <b>{totals.active}</b>
          <span>activos</span>
        </div>
        <div className="kpi">
          <b>{totals.total}</b>
          <span>agentes definidos</span>
        </div>
      </div>

      <div className="filters" style={{ justifyContent: "space-between" }}>
        <div className="actions" style={{ margin: 0 }}>
          {overview.paused ? (
            <PauseControl op="resume-all" label="Reanudar todo" tone="secondary" reasonRequired={false} />
          ) : (
            <PauseControl op="pause-all" label="Pausar todo" tone="danger" reasonRequired />
          )}
        </div>
        <span className="sub">Cada pausa y cada reanudación queda en la bitácora con tu nombre, la hora y el motivo.</span>
      </div>

      <div className="layout">
        <section className="panel" aria-label="Departamentos">
          <table>
            <thead>
              <tr>
                <th scope="col">Departamento</th>
                <th scope="col">Activos</th>
                <th scope="col">En pausa</th>
                <th scope="col" className="hide-sm">Definidos</th>
              </tr>
            </thead>
            <tbody>
              {overview.departments.map((department) => (
                <tr key={department.id} aria-selected={department.id === selected.id}>
                  <td>
                    <a href={`/pausas?d=${department.id}`} className="row-link">
                      <b>{department.name}</b>
                      <div className="sub">{department.total} agentes</div>
                    </a>
                  </td>
                  <td>{department.active}</td>
                  <td>{department.paused}</td>
                  <td className="hide-sm">{department.defined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Agentes del departamento">
          <div className="head">
            <div>
              <h2>{selected.name}</h2>
              <div className="sub">{selected.total} agentes en este departamento</div>
            </div>
          </div>

          <div className="section decision">
            <h3>Departamento</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selected.active > 0 ? <PauseControl op="pause-dept" target={selected.id} label="Pausar departamento" tone="danger" reasonRequired /> : null}
              {selected.paused > 0 ? <PauseControl op="resume-dept" target={selected.id} label="Reanudar departamento" tone="secondary" reasonRequired={false} /> : null}
            </div>
            <p className="sub" style={{ margin: "8px 0 0" }}>Solo se detienen los agentes activos. Los que están definidos y sin activar no cambian.</p>
          </div>

          <div className="section">
            <h3>Agentes</h3>
            <table className="mini-table">
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <b>{agent.name}</b>
                      <div className="sub">{agent.service}</div>
                      {agent.status === "pausado" && agent.pauseReason ? <div className="sub">Motivo: {agent.pauseReason}</div> : null}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[agent.status]}`}>{STATUS_LABEL[agent.status]}</span>
                    </td>
                    <td>
                      {agent.status === "activo" ? <PauseControl op="pause-agent" target={agent.id} label="Pausar" tone="secondary" reasonRequired compact /> : null}
                      {agent.status === "pausado" ? <PauseControl op="resume-agent" target={agent.id} label="Reanudar" tone="secondary" reasonRequired={false} compact /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ margin: "8px 0 0" }}>
              Los agentes todavía no operan. La pausa queda registrada y cada agente deberá respetarla cuando empiece a trabajar.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
