import Link from "next/link";
import { notFound } from "next/navigation";
import { requestNow } from "@/lib/request-time";
import type { Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { FAMILY_LABEL, LEAD_EVENT_LABEL, LEAD_STATUS_LABEL, MEETING_STATUS_LABEL, PRIORITY_LABEL, SOURCE_LABEL, formatDate } from "@/lib/labels";
import { DeleteLeadPanel } from "@/components/leads/delete-lead-panel";
import { StatePanel } from "@/components/state-panel";
import { DecisionForm } from "@/components/leads/decision-form";
import { ConvertPanel } from "@/components/leads/convert-panel";
import { ProposalForm } from "@/components/leads/proposal-form";
import { LeadMeetingForm } from "@/components/leads/lead-meeting-form";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type History = {
  events: Array<{ id: string; at: string; actor: string; action: string; detail: Record<string, unknown> }>;
  meetings: Array<{ id: string; topic: string; status: keyof typeof MEETING_STATUS_LABEL; startsAt: string | null }>;
};

type Duplicate = { id: string; name: string; email: string; status: Lead["status"]; receivedAt: string };

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let lead: Lead;
  try {
    lead = await apiFetch<Lead>(`/leads/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    const message = error instanceof ApiError ? error.message : "No pudimos cargar este lead.";
    return (
      <StatePanel title="No pudimos cargar este lead">
        <p>{message}</p>
        <Link href="/leads" style={{ display: "inline-block", marginTop: 12 }}>
          Volver a leads
        </Link>
      </StatePanel>
    );
  }

  // Estas tres consultas enriquecen la ficha: si una falla, la ficha se muestra igual sin esa sección.
  const [history, duplicates, suppressionList] = await Promise.all([
    apiFetch<History>(`/leads/${id}/history`).catch(() => ({ events: [], meetings: [] }) as History),
    apiFetch<{ duplicates: Duplicate[] }>(`/leads/${id}/duplicates`).catch(() => ({ duplicates: [] as Duplicate[] })),
    apiFetch<{ suppressions: Array<{ email: string }> }>("/suppressions").catch(() => ({ suppressions: [] as Array<{ email: string }> })),
  ]);

  const now = (await requestNow()).getTime();

  const suppressed = suppressionList.suppressions.some((s) => s.email === lead.email.toLowerCase());
  const active = lead.status !== "convertido" && lead.status !== "descartado";
  const decidable = lead.status !== "convertido";
  const convertible = lead.status === "calificado";
  const suggestion = lead.proposedFamily && lead.proposedFamily !== "unknown" ? FAMILY_LABEL[lead.proposedFamily] : null;
  const revisitOverdue = lead.status === "pospuesto" && lead.revisitAt !== null && new Date(lead.revisitAt).getTime() <= now;

  return (
    <>
      <Link href="/leads" className="sub" style={{ display: "inline-block", marginBottom: 10 }}>
        ← Leads
      </Link>
      <div className="page-head">
        <div>
          <h1>{lead.name}</h1>
          <p>
            {lead.company || "Sin empresa indicada"} · {lead.email}
          </p>
        </div>
        <span className={`badge b-${lead.status}`}>{LEAD_STATUS_LABEL[lead.status]}</span>
      </div>

      {suppressed ? (
        <p role="alert" className="notice-bad" style={{ marginBottom: 16 }}>
          Este correo está en la lista de supresión. No se le puede enviar ninguna invitación ni contacto de Arkanium.
        </p>
      ) : null}

      {lead.notifiedAt === null && lead.notifyAttempts >= 10 ? (
        <p className="notice-bad" style={{ marginBottom: 16 }} role="status">
          Aviso atascado: {lead.notifyAttempts} intentos sin éxito. Último error: {lead.notifyLastError ?? "desconocido"}. Revisa el correo y Slack a mano.
        </p>
      ) : lead.notifiedAt === null ? (
        <p className="sub" style={{ marginBottom: 16 }}>Aviso por correo y Slack pendiente.</p>
      ) : null}

      {lead.status === "pospuesto" && lead.revisitAt ? (
        <p className={revisitOverdue ? "notice-bad" : "notice-ok"} style={{ marginBottom: 16 }}>
          {revisitOverdue ? "Vencida: " : ""}Volver a revisar este lead el {formatDate(lead.revisitAt)}.
        </p>
      ) : null}

      {duplicates.duplicates.length > 0 ? (
        <section className="panel pad" style={{ marginBottom: 16 }} aria-labelledby="duplicados">
          <h2 id="duplicados" style={{ fontSize: "1rem" }}>
            Posibles duplicados
          </h2>
          <p className="sub">Otros leads activos con el mismo correo. Revisa si es la misma persona antes de actuar.</p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {duplicates.duplicates.map((dup) => (
              <li key={dup.id}>
                <Link href={`/leads/${dup.id}`}>{dup.name}</Link> · {LEAD_STATUS_LABEL[dup.status]} · recibido {formatDate(dup.receivedAt)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="panel pad" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "1rem" }}>Acciones del lead</h2>
          <p className="sub" style={{ margin: 0 }}>
            {lead.status === "convertido"
              ? "Ya es una organización: puedes corregir nombre y correo; empresa, mensaje y origen quedan como historial. No se elimina."
              : "Edita sus datos o elimínalo. Eliminar no borra el registro: deja de aparecer en Leads."}
          </p>
        </div>
        <div className="actions" style={{ marginTop: 0, alignItems: "flex-start" }}>
          <Link href={`/leads/${lead.id}/editar`} className="primary" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6 }}>
            {lead.status === "convertido" ? "Editar nombre y correo" : "Editar datos"}
          </Link>
          {lead.status !== "convertido" ? (
            <div style={{ minWidth: 260 }}>
              <DeleteLeadPanel leadId={lead.id} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="layout">
        <div className="panel pad">
          <div className="section" style={{ marginTop: 0 }}>
            <h3>Propuesta del agente de calificación</h3>
            <div className="agent-box">
              <div className="tag">Sugerencia, no decisión</div>
              <p style={{ margin: "6px 0 0" }}>
                <b>Familia sugerida:</b> {suggestion ?? "Sin propuesta todavía"}
              </p>
              {lead.proposedReason ? (
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {lead.proposedReason}
                </p>
              ) : null}
            </div>
            {lead.proposedReason && active ? (
              <div style={{ marginTop: 10 }}>
                <ProposalForm leadId={lead.id} />
              </div>
            ) : null}
          </div>

          <div className="section">
            <h3>Datos</h3>
            <dl className="kv">
              <dt>Interés</dt>
              <dd>{PRIORITY_LABEL[lead.priorityChoice] ?? lead.priorityChoice}</dd>
              <dt>Origen</dt>
              <dd>
                {SOURCE_LABEL[lead.source] ?? lead.source}
                {lead.sourceReference ? ` · ${lead.sourceReference}` : ""}
              </dd>
              <dt>Idioma</dt>
              <dd>{lead.locale.toUpperCase()}</dd>
              <dt>Recibido</dt>
              <dd>{formatDate(lead.receivedAt)}</dd>
            </dl>
          </div>

          <div className="section">
            <h3>Mensaje del formulario</h3>
            <p style={{ margin: 0 }}>{lead.context ? lead.context : <span className="muted">Sin mensaje.</span>}</p>
          </div>

          {lead.decisionNote ? (
            <div className="section">
              <h3>Motivo registrado</h3>
              <p style={{ margin: 0 }}>{lead.decisionNote}</p>
            </div>
          ) : null}

          <div className="section">
            <h3>Reuniones con este lead</h3>
            {history.meetings.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Todavía no hay reuniones.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {history.meetings.map((meeting) => (
                  <li key={meeting.id}>
                    {meeting.topic} · {MEETING_STATUS_LABEL[meeting.status]}
                    {meeting.startsAt ? ` · ${formatDate(meeting.startsAt)}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {active ? (
              <div style={{ marginTop: 10 }}>
                <LeadMeetingForm leadId={lead.id} />
              </div>
            ) : null}
          </div>

          <div className="section">
            <h3>Historial</h3>
            {history.events.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Sin movimientos registrados.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                {history.events.map((event) => (
                  <li key={event.id}>
                    <b>{LEAD_EVENT_LABEL[event.action] ?? event.action}</b> · <span className="sub">{formatDate(event.at)}</span>
                    {typeof event.detail.reason === "string" ? <div className="muted">{event.detail.reason}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="panel detail" aria-label="Tu decisión">
          <div className="section" style={{ marginTop: 0 }}>
            <h3>Tu decisión</h3>
            {decidable ? (
              <DecisionForm leadId={lead.id} disabled={!decidable} />
            ) : (
              <p className="sub">Este lead ya es una organización. Su estado no se recalifica.</p>
            )}
          </div>

          <div className="section">
            <h3>Convertir en organización</h3>
            {lead.status === "convertido" && lead.organizationId ? (
              <p className="notice-ok">Organización creada. Identificador: {lead.organizationId}.</p>
            ) : (
              <ConvertPanel leadId={lead.id} enabled={convertible} />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
