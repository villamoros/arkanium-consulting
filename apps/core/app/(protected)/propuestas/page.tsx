import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { FAMILY_LABEL, formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { CreateProposalForm } from "@/components/proposals/proposal-forms";
import { PROPOSAL_BADGE, PROPOSAL_STATUS_LABEL, ProposalDetail, type ProposalDetailData } from "@/components/proposals/proposal-detail";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type ProposalRow = {
  id: string;
  title: string;
  kind: "cliente" | "lead";
  targetName: string | null;
  serviceFamily: keyof typeof FAMILY_LABEL;
  templateCode: string;
  status: string;
  currentVersion: number;
  priceStatus: string;
  priceCents: number | null;
  priceNote: string | null;
  updatedAt: string;
};

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; id?: string }> }) {
  const { q = "", estado = "", id = "" } = await searchParams;

  let proposals: ProposalRow[];
  let clients: Array<{ id: string; name: string }>;
  let leads: Array<{ id: string; name: string; status: string }>;
  try {
    const [proposalData, clientData, leadData] = await Promise.all([
      apiFetch<{ proposals: ProposalRow[] }>("/proposals"),
      apiFetch<{ organizations: Array<{ id: string; name: string }> }>("/client-organizations"),
      apiFetch<{ leads: Array<{ id: string; name: string; status: string }> }>("/leads"),
    ]);
    proposals = proposalData.proposals;
    clients = clientData.organizations;
    leads = leadData.leads.filter((lead) => lead.status === "calificado");
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar las propuestas.";
    return (
      <StatePanel title="No pudimos cargar las propuestas">
        <p>{message}</p>
        <p>No se ha enviado nada.</p>
      </StatePanel>
    );
  }

  const term = q.trim().toLowerCase();
  const filtered = proposals.filter(
    (proposal) =>
      (!estado || proposal.status === estado) &&
      (!term || `${proposal.title} ${proposal.targetName ?? ""} ${FAMILY_LABEL[proposal.serviceFamily]}`.toLowerCase().includes(term)),
  );
  const selectedRow = filtered.find((proposal) => proposal.id === id) ?? filtered[0];

  let detail: ProposalDetailData | null = null;
  if (selectedRow) {
    try {
      detail = await apiFetch<ProposalDetailData>(`/proposals/${selectedRow.id}`);
    } catch {
      detail = null;
    }
  }

  const linkFor = (proposalId: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    params.set("id", proposalId);
    return `/propuestas?${params.toString()}`;
  };

  const count = (status: string) => proposals.filter((proposal) => proposal.status === status).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Propuestas</h1>
          <p>Qué ofrecemos a cada lead o cliente, en qué versión está y dónde se encuentra. Ninguna propuesta sale sin tu aprobación.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de propuestas">
        <div className="kpi">
          <b>{count("borrador")}</b>
          <span>borradores</span>
        </div>
        <div className="kpi">
          <b>{count("en_aprobacion")}</b>
          <span>en aprobación</span>
        </div>
        <div className="kpi">
          <b>{count("enviada")}</b>
          <span>enviadas, esperando respuesta</span>
        </div>
        <div className="kpi">
          <b>{count("aceptada")}</b>
          <span>aceptadas</span>
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar propuesta
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q} placeholder="Buscar por cliente, lead o servicio" />
        <label className="sr" htmlFor="f-estado">
          Estado
        </label>
        <select id="f-estado" name="estado" defaultValue={estado}>
          <option value="">Todos los estados</option>
          {Object.keys(PROPOSAL_STATUS_LABEL).map((key) => (
            <option key={key} value={key}>
              {PROPOSAL_STATUS_LABEL[key]}
            </option>
          ))}
        </select>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      <details className="panel pad" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Nueva propuesta</summary>
        <div style={{ marginTop: 10 }}>
          {clients.length === 0 && leads.length === 0 ? (
            <p className="muted">Primero necesitas un cliente o un lead calificado.</p>
          ) : (
            <CreateProposalForm clients={clients} leads={leads} />
          )}
        </div>
      </details>

      <div className="layout">
        <section className="panel" aria-label="Lista de propuestas">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>
              {proposals.length === 0 ? "Todavía no hay propuestas. Crea la primera a partir de un lead calificado o un cliente." : "No hay propuestas con esos filtros."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Propuesta</th>
                  <th scope="col">Para</th>
                  <th scope="col" className="hide-sm">Plantilla</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((proposal) => (
                  <tr key={proposal.id} aria-selected={proposal.id === selectedRow?.id}>
                    <td>
                      <Link href={linkFor(proposal.id)} className="row-link">
                        <div className="lead-name">{proposal.title}</div>
                        <div className="sub">
                          v{proposal.currentVersion} · {FAMILY_LABEL[proposal.serviceFamily]} · {formatDate(proposal.updatedAt)}
                        </div>
                      </Link>
                    </td>
                    <td>
                      {proposal.targetName ?? "Sin nombre"}
                      <div className="sub">{proposal.kind === "lead" ? "Lead" : "Cliente"}</div>
                    </td>
                    <td className="hide-sm">
                      <span className="sub">{proposal.templateCode}</span>
                    </td>
                    <td>
                      <span className={`badge ${PROPOSAL_BADGE[proposal.status] ?? "b-idle"}`}>{PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle de la propuesta">
          {selectedRow && detail ? (
            <ProposalDetail detail={detail} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {selectedRow ? "No pudimos cargar esta propuesta." : "Selecciona una propuesta para verla."}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
