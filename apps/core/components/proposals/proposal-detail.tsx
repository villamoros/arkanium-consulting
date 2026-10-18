import { FAMILY_LABEL, formatDate } from "@/lib/labels";
import {
  AcceptProposalForm,
  MarkSentForm,
  NewVersionForm,
  RejectProposalForm,
  SendToApprovalForm,
} from "@/components/proposals/proposal-forms";

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_aprobacion: "En aprobación",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export const PROPOSAL_BADGE: Record<string, string> = {
  borrador: "b-idle",
  en_aprobacion: "b-pospuesto",
  enviada: "b-nuevo",
  aceptada: "b-convertido",
  rechazada: "b-descartado",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export type ProposalDetailData = {
  id: string;
  title: string;
  kind: "cliente" | "lead";
  targetName: string | null;
  serviceFamily: keyof typeof FAMILY_LABEL;
  templateCode: string;
  status: string;
  currentVersion: number;
  summary: string;
  priceStatus: "por_confirmar" | "confirmado";
  priceCents: number | null;
  priceNote: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  versions: Array<{ version: number; summary: string; priceStatus: string; priceCents: number | null; priceNote: string | null; createdAt: string }>;
};

function priceText(priceStatus: string, priceCents: number | null, priceNote: string | null): string {
  if (priceStatus !== "confirmado") return "Por confirmar";
  if (priceCents !== null) return `${money.format(priceCents / 100)}${priceNote ? ` · ${priceNote}` : ""}`;
  return priceNote ?? "Confirmado";
}

/** Detalle de la propuesta: vista previa, precio, historial y las acciones que corresponden a su estado. */
export function ProposalDetail({ detail }: { detail: ProposalDetailData }) {
  const confirmed = detail.priceStatus === "confirmado";
  return (
    <>
      <div className="head">
        <div>
          <h2>{detail.title}</h2>
          <div className="sub">
            {detail.targetName ?? "Sin nombre"} · {detail.kind === "lead" ? "Lead" : "Cliente"} · {FAMILY_LABEL[detail.serviceFamily]}
          </div>
        </div>
        <span className={`badge ${PROPOSAL_BADGE[detail.status] ?? "b-idle"}`}>{PROPOSAL_STATUS_LABEL[detail.status] ?? detail.status}</span>
      </div>

      <div className="section">
        <h3>Vista previa</h3>
        <div className="sub" style={{ marginBottom: 6 }}>
          Versión {detail.currentVersion} · {detail.templateCode}
        </div>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detail.summary}</p>
      </div>

      <div className="section">
        <h3>Precio</h3>
        <p style={{ margin: 0 }}>{priceText(detail.priceStatus, detail.priceCents, detail.priceNote)}</p>
        {!confirmed ? (
          <p className="sub" style={{ margin: "6px 0 0" }}>Mientras el precio esté por confirmar, la propuesta no se puede enviar a aprobación.</p>
        ) : null}
      </div>

      {detail.decisionNote ? (
        <div className="section">
          <h3>{detail.status === "rechazada" ? "Motivo del rechazo" : "Firma de aceptación"}</h3>
          <p style={{ margin: 0 }}>{detail.decisionNote}</p>
          {detail.decidedAt ? <p className="sub" style={{ margin: "4px 0 0" }}>{formatDate(detail.decidedAt)}</p> : null}
        </div>
      ) : null}

      <div className="section">
        <h3>Historial</h3>
        <ul className="checks">
          {detail.versions.map((version) => (
            <li key={version.version}>
              <span className="ok" aria-hidden="true">✓</span>
              <span>
                v{version.version} · {formatDate(version.createdAt)} · {priceText(version.priceStatus, version.priceCents, version.priceNote)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="section decision">
        <h3>Acciones</h3>
        {detail.status === "borrador" ? (
          <>
            <NewVersionForm
              proposalId={detail.id}
              summary={detail.summary}
              priceStatus={detail.priceStatus}
              priceCents={detail.priceCents}
              priceNote={detail.priceNote}
            />
            <SendToApprovalForm proposalId={detail.id} />
          </>
        ) : null}
        {detail.status === "en_aprobacion" ? (
          <>
            <p className="sub" style={{ margin: 0 }}>Esperando tu decisión: aprobar el envío lo registra; Arkanium no envía correos desde aquí.</p>
            <MarkSentForm proposalId={detail.id} />
          </>
        ) : null}
        {detail.status === "enviada" ? (
          <>
            <AcceptProposalForm proposalId={detail.id} />
            <RejectProposalForm proposalId={detail.id} />
          </>
        ) : null}
        {detail.status === "aceptada" || detail.status === "rechazada" ? (
          <p className="sub" style={{ margin: 0 }}>Propuesta cerrada. Queda como registro.</p>
        ) : null}
      </div>
    </>
  );
}
