import Link from "next/link";
import { notFound } from "next/navigation";
import type { Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { FAMILY_LABEL, LEAD_STATUS_LABEL, PRIORITY_LABEL, formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { DecisionForm } from "@/components/leads/decision-form";
import { ConvertPanel } from "@/components/leads/convert-panel";

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

  const decidable = lead.status !== "convertido";
  const convertible = lead.status === "calificado";
  const suggestion = lead.proposedFamily && lead.proposedFamily !== "unknown" ? FAMILY_LABEL[lead.proposedFamily] : null;

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
          </div>

          <div className="section">
            <h3>Datos</h3>
            <dl className="kv">
              <dt>Interés</dt>
              <dd>{PRIORITY_LABEL[lead.priorityChoice] ?? lead.priorityChoice}</dd>
              <dt>Origen</dt>
              <dd>{lead.source}</dd>
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
