import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import type { Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { leadsBySource, leadsByStatus, leadsPerWeek, meetingsPerWeek, type MeetingPoint } from "@/lib/dashboard";
import { StatePanel } from "@/components/state-panel";
import { BarList } from "@/components/dashboard/bar-list";
import { ColumnChart } from "@/components/dashboard/column-chart";

// instant = false: el tablero lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function CoreHome() {
  let leads: Lead[];
  let meetings: MeetingPoint[];
  try {
    const [leadData, meetingData] = await Promise.all([
      apiFetch<{ leads: Lead[] }>("/leads"),
      apiFetch<{ meetings: MeetingPoint[] }>("/meetings"),
    ]);
    leads = leadData.leads;
    meetings = meetingData.meetings;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar el tablero.";
    return (
      <StatePanel title="No pudimos cargar el tablero">
        <p>{message}</p>
        <p>Ningún dato se ha modificado.</p>
      </StatePanel>
    );
  }

  const now = (await requestNow()).getTime();

  const newLeads = leads.filter((lead) => lead.status === "nuevo").length;
  const converted = leads.filter((lead) => lead.status === "convertido").length;
  const pendingRequests = meetings.filter((m) => m.status === "solicitada").length;
  const nextWeek = meetings.filter((m) => m.status === "confirmada" && m.startsAt && new Date(m.startsAt).getTime() >= now && new Date(m.startsAt).getTime() - now <= WEEK_MS).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inicio</h1>
          <p>Lo que necesitas decidir hoy y cómo se mueven los leads y las reuniones.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen">
        <Link href="/leads?estado=nuevo" className="kpi" style={{ textDecoration: "none" }}>
          <b>{newLeads}</b>
          <span>leads nuevos sin decidir</span>
        </Link>
        <Link href="/leads" className="kpi" style={{ textDecoration: "none" }}>
          <b>{leads.length}</b>
          <span>leads activos</span>
        </Link>
        <Link href="/reuniones" className="kpi" style={{ textDecoration: "none" }}>
          <b>{pendingRequests}</b>
          <span>reuniones por responder</span>
        </Link>
        <Link href="/reuniones" className="kpi" style={{ textDecoration: "none" }}>
          <b>{nextWeek}</b>
          <span>reuniones en los próximos 7 días</span>
        </Link>
      </div>

      <div className="charts">
        <section className="panel pad chart" aria-labelledby="embudo">
          <h2 id="embudo">Embudo de leads</h2>
          <p className="sub">Cuántos leads hay en cada etapa.</p>
          <BarList rows={leadsByStatus(leads)} empty="Todavía no hay leads." />
        </section>

        <section className="panel pad chart" aria-labelledby="origen">
          <h2 id="origen">Leads por origen</h2>
          <p className="sub">De dónde llegan los leads. Sirve para decidir dónde invertir tiempo.</p>
          <BarList rows={leadsBySource(leads)} empty="Todavía no hay leads." />
        </section>

        <section className="panel pad chart" aria-labelledby="captacion">
          <h2 id="captacion">Leads que llegaron por semana</h2>
          <p className="sub">Últimas 12 semanas. Muestra si la captación crece o se estanca.</p>
          <ColumnChart columns={leadsPerWeek(leads, now)} legend={["Leads"]} empty="Todavía no hay leads en las últimas 12 semanas." />
        </section>

        <section className="panel pad chart" aria-labelledby="reuniones-semana">
          <h2 id="reuniones-semana">Solicitudes y reuniones por semana</h2>
          <p className="sub">Solicitudes recibidas frente a reuniones programadas. Las reuniones se cuentan por su fecha.</p>
          <ColumnChart columns={meetingsPerWeek(meetings, now)} legend={["Solicitudes", "Programadas"]} empty="Todavía no hay reuniones en las últimas 12 semanas." />
        </section>
      </div>

      <p className="sub" style={{ marginTop: 14 }}>
        Convertidos hasta hoy: {converted}. Las cifras se calculan con los datos de la API al abrir la página.
      </p>
    </>
  );
}
