import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { ApproveForm } from "@/components/approvals/approve-form";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type ApprovalItem = {
  id: string;
  kind: "propuesta" | "reunion";
  subjectId: string;
  action: "enviar_propuesta" | "agendar_reunion" | "crear_evento" | "publicar_acta" | "emitir_factura" | "publicar_articulo" | "aprobar_brief" | "aprobar_pieza";
  actionLabel: string;
  title: string;
  targetName: string | null;
  module: "Propuestas" | "Reuniones" | "Cobros y facturas" | "Insights" | "Campañas";
  dueAt: string | null;
  approvable: boolean;
};

const ACTION_OPTIONS: Array<{ value: ApprovalItem["action"]; label: string }> = [
  { value: "enviar_propuesta", label: "Enviar propuesta" },
  { value: "agendar_reunion", label: "Agendar reunión" },
  { value: "crear_evento", label: "Crear evento en Calendar" },
  { value: "publicar_acta", label: "Publicar acta" },
  { value: "emitir_factura", label: "Emitir factura" },
  { value: "publicar_articulo", label: "Publicar artículo" },
  { value: "aprobar_brief", label: "Aprobar brief de campaña" },
  { value: "aprobar_pieza", label: "Aprobar pieza publicitaria" },
];

/** Dónde se resuelve un elemento que no se aprueba desde la cola. */
function moduleHref(item: ApprovalItem): string {
  if (item.module === "Propuestas") return `/propuestas?id=${item.subjectId}`;
  if (item.module === "Cobros y facturas") return `/cobros?id=${item.subjectId}`;
  if (item.module === "Insights") return "/insights";
  if (item.module === "Campañas") return "/campanas";
  return "/reuniones";
}

const bogotaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

/** Página de la cola: lo que espera tu decisión, con su urgencia y el módulo donde se resuelve. */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; hoy?: string; id?: string }> }) {
  const { q = "", tipo = "", hoy = "", id = "" } = await searchParams;

  let items: ApprovalItem[];
  try {
    ({ approvals: items } = await apiFetch<{ approvals: ApprovalItem[] }>("/approvals"));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar la cola de aprobaciones.";
    return (
      <StatePanel title="No pudimos cargar las aprobaciones">
        <p>{message}</p>
        <p>Nada se ha aprobado ni enviado.</p>
      </StatePanel>
    );
  }

  const today = bogotaDay.format(await requestNow());
  const isToday = (item: ApprovalItem) => item.dueAt !== null && bogotaDay.format(new Date(item.dueAt)) === today;

  const term = q.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      (!tipo || item.action === tipo) &&
      (hoy !== "1" || isToday(item)) &&
      (!term || `${item.title} ${item.targetName ?? ""}`.toLowerCase().includes(term)),
  );
  const selected = filtered.find((item) => item.id === id) ?? filtered[0];

  const linkFor = (itemId: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tipo) params.set("tipo", tipo);
    if (hoy === "1") params.set("hoy", "1");
    params.set("id", itemId);
    return `/aprobaciones?${params.toString()}`;
  };

  const count = (action: ApprovalItem["action"]) => items.filter((item) => item.action === action).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Aprobaciones</h1>
          <p>Todo lo que espera tu decisión antes de salir. Nada sale sin tu aprobación.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de aprobaciones">
        <div className="kpi">
          <b>{items.length}</b>
          <span>pendientes</span>
        </div>
        <div className="kpi">
          <b>{items.filter(isToday).length}</b>
          <span>con fecha de hoy</span>
        </div>
        <div className="kpi">
          <b>{count("enviar_propuesta")}</b>
          <span>propuestas por enviar</span>
        </div>
        <div className="kpi">
          <b>{count("agendar_reunion")}</b>
          <span>reuniones por agendar</span>
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar en la cola
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q} placeholder="Buscar por cliente, lead o tema" />
        <label className="sr" htmlFor="f-tipo">
          Tipo de acción
        </label>
        <select id="f-tipo" name="tipo" defaultValue={tipo}>
          <option value="">Todas las acciones</option>
          {ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" name="hoy" value="1" defaultChecked={hoy === "1"} />
          Solo con fecha de hoy
        </label>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      <div className="layout">
        <section className="panel" aria-label="Cola de aprobaciones">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>
              {items.length === 0 ? "No hay nada esperando tu decisión." : "No hay elementos con esos filtros."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Acción</th>
                  <th scope="col">Para</th>
                  <th scope="col" className="hide-sm">Pertenece a</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} aria-selected={item.id === selected?.id}>
                    <td>
                      <Link href={linkFor(item.id)} className="row-link">
                        <div className="lead-name">{item.actionLabel}</div>
                        <div className="sub">{item.title}</div>
                      </Link>
                    </td>
                    <td>{item.targetName ?? "Sin nombre"}</td>
                    <td className="hide-sm">
                      <span className="sub">{item.module}</span>
                    </td>
                    <td>
                      {item.dueAt ? <span className={isToday(item) ? "notice-bad" : "sub"}>{formatDate(item.dueAt)}</span> : <span className="sub">Sin fecha</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle de la aprobación">
          {selected ? (
            <>
              <div className="head">
                <div>
                  <h2>{selected.actionLabel}</h2>
                  <div className="sub">
                    {selected.title} · {selected.targetName ?? "Sin nombre"}
                  </div>
                </div>
                <span className="badge b-pospuesto">{selected.module}</span>
              </div>
              <div className="section">
                <h3>Qué pasa si apruebas</h3>
                <p style={{ margin: 0 }}>
                  {selected.action === "enviar_propuesta" && "Se registra la propuesta como enviada. Arkanium no envía correos desde aquí."}
                  {selected.action === "crear_evento" && "Se crea el evento en Google Calendar con Meet e invitados."}
                  {selected.action === "agendar_reunion" && "Esta solicitud necesita una fecha: se confirma en Reuniones."}
                  {selected.action === "publicar_acta" && "El acta se publica y el cliente la puede ver. Se escribe en Reuniones."}
                  {selected.action === "emitir_factura" && "La factura se emite en Stripe y queda pagable por el cliente. Es el único paso que la saca de borrador."}
                  {selected.action === "publicar_articulo" && "El artículo se publica en Insights. Es una salida externa."}
                  {selected.action === "aprobar_brief" && "El agente puede producir piezas para este brief. Todavía no se publica nada."}
                  {selected.action === "aprobar_pieza" && "La pieza queda aprobada para publicarse. Publicarla es un paso aparte del agente."}
                </p>
              </div>
              <div className="section decision">
                <h3>Decisión</h3>
                {selected.approvable ? (
                  <ApproveForm action={selected.action} subjectId={selected.subjectId} label={selected.actionLabel} />
                ) : null}
                <Link href={moduleHref(selected)} className="secondary" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, marginTop: 8 }}>
                  Abrir en {selected.module}
                </Link>
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Selecciona un elemento para revisarlo.</p>
          )}
        </aside>
      </div>
    </>
  );
}
