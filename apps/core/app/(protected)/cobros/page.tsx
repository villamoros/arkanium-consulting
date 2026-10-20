import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import {
  CreateInvoiceForm,
  CreditNoteForm,
  DiscardDraftForm,
  EditDraftForm,
  ReminderForm,
  VoidInvoiceForm,
} from "@/components/cobros/invoice-forms";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type SavedLine = { description: string; quantity: number; unitAmountCents: number };

type Invoice = {
  id: string;
  number: string;
  concept: string;
  amountCents: number;
  status: "borrador" | "enviada" | "pagada" | "anulada";
  issuedAt: string | null;
  paidAt: string | null;
  dueAt: string | null;
  dueDays: number;
  payUrl: string | null;
  clientName: string | null;
  organizationId: string;
  projectId: string | null;
  projectName: string | null;
  recipientEmail: string | null;
  lines: SavedLine[];
  creditedCents: number;
};

type Project = { id: string; name: string; organizationId: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" });

const BADGE: Record<string, string> = { borrador: "b-idle", enviada: "b-nuevo", pagada: "b-convertido", anulada: "b-descartado" };
const LABEL: Record<string, string> = { borrador: "Borrador", enviada: "Enviada", pagada: "Pagada", anulada: "Anulada" };

/** Una factura enviada cuyo vencimiento ya pasó se muestra como vencida, aunque su estado siga siendo «enviada». */
function displayStatus(invoice: Invoice, now: number): string {
  if (invoice.status === "enviada" && invoice.dueAt && new Date(invoice.dueAt).getTime() < now) return "vencida";
  return invoice.status;
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; id?: string }> }) {
  const { q = "", estado = "", id = "" } = await searchParams;

  let invoices: Invoice[];
  let clients: Array<{ id: string; name: string }>;
  let projects: Project[];
  try {
    const [invoiceData, clientData, projectData] = await Promise.all([
      apiFetch<{ invoices: Invoice[] }>("/invoices"),
      apiFetch<{ organizations: Array<{ id: string; name: string }> }>("/client-organizations"),
      apiFetch<{ projects: Project[] }>("/projects"),
    ]);
    invoices = invoiceData.invoices;
    clients = clientData.organizations;
    projects = projectData.projects;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar las facturas.";
    return (
      <StatePanel title="No pudimos cargar las facturas">
        <p>{message}</p>
        <p>Ninguna factura se ha emitido ni anulado.</p>
      </StatePanel>
    );
  }

  const requested = await requestNow();
  const now = requested.getTime();
  const thisMonth = monthKey.format(requested);

  const withStatus = invoices.map((invoice) => ({ invoice, status: displayStatus(invoice, now) }));
  const term = q.trim().toLowerCase();
  const filtered = withStatus.filter(
    ({ invoice, status }) =>
      (!estado || status === estado) &&
      (!term || `${invoice.number} ${invoice.clientName ?? ""} ${invoice.projectName ?? ""}`.toLowerCase().includes(term)),
  );
  const selected = filtered.find(({ invoice }) => invoice.id === id) ?? filtered[0];

  const open = withStatus.filter(({ status }) => status === "enviada" || status === "vencida").reduce((sum, { invoice }) => sum + invoice.amountCents, 0);
  const overdue = withStatus.filter(({ status }) => status === "vencida").reduce((sum, { invoice }) => sum + invoice.amountCents, 0);
  const collectedThisMonth = invoices
    .filter((invoice) => invoice.status === "pagada" && invoice.paidAt && monthKey.format(new Date(invoice.paidAt)) === thisMonth)
    .reduce((sum, invoice) => sum + invoice.amountCents - invoice.creditedCents, 0);
  const drafts = invoices.filter((invoice) => invoice.status === "borrador").length;

  const linkFor = (invoiceId: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    params.set("id", invoiceId);
    return `/cobros?${params.toString()}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cobros y facturas</h1>
          <p>Qué está emitido, pagado o vencido. Cada factura se emite desde Aprobaciones y el pago se confirma en la página segura de Stripe.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de cobros">
        <div className="kpi">
          <b>{money.format(open / 100)}</b>
          <span>por cobrar</span>
        </div>
        <div className="kpi">
          <b>{money.format(overdue / 100)}</b>
          <span>vencido</span>
        </div>
        <div className="kpi">
          <b>{money.format(collectedThisMonth / 100)}</b>
          <span>cobrado este mes</span>
        </div>
        <div className="kpi">
          <b>{drafts}</b>
          <span>borradores por aprobar</span>
        </div>
      </div>

      <details className="panel pad" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Nueva factura</summary>
        <div style={{ marginTop: 10 }}>
          {clients.length === 0 ? <p className="muted">Primero necesitas un cliente.</p> : <CreateInvoiceForm clients={clients} projects={projects} />}
        </div>
      </details>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-busqueda">
          Buscar factura
        </label>
        <input id="f-busqueda" name="q" type="search" defaultValue={q} placeholder="Buscar por número, cliente o proyecto" />
        <label className="sr" htmlFor="f-estado">
          Estado
        </label>
        <select id="f-estado" name="estado" defaultValue={estado}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="vencida">Vencida</option>
          <option value="pagada">Pagada</option>
          <option value="anulada">Anulada</option>
        </select>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      <div className="layout">
        <section className="panel" aria-label="Facturas">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>
              {invoices.length === 0 ? "Todavía no hay facturas. Crea un borrador y apruébalo en Aprobaciones." : "No hay facturas con esos filtros."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Factura</th>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="hide-sm">Vence</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ invoice, status }) => (
                  <tr key={invoice.id} aria-selected={invoice.id === selected?.invoice.id}>
                    <td>
                      <Link href={linkFor(invoice.id)} className="row-link">
                        <div className="lead-name">{invoice.number}</div>
                        <div className="sub">{invoice.concept}</div>
                      </Link>
                    </td>
                    <td>{invoice.clientName ?? "Sin nombre"}</td>
                    <td className="hide-sm">
                      {invoice.dueAt ? <span className={status === "vencida" ? "notice-bad" : "sub"}>{formatDate(invoice.dueAt)}</span> : <span className="sub">—</span>}
                    </td>
                    <td>{money.format(invoice.amountCents / 100)}</td>
                    <td>
                      <span className={`badge ${status === "vencida" ? "b-descartado" : BADGE[status] ?? "b-idle"}`}>{status === "vencida" ? "Vencida" : LABEL[status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle de la factura">
          {selected ? (
            <div key={selected.invoice.id}>
              <div className="head">
                <div>
                  <h2>{selected.invoice.number}</h2>
                  <div className="sub">{selected.invoice.clientName ?? "Sin nombre"}</div>
                </div>
                <span className={`badge ${selected.status === "vencida" ? "b-descartado" : BADGE[selected.status] ?? "b-idle"}`}>
                  {selected.status === "vencida" ? "Vencida" : LABEL[selected.status]}
                </span>
              </div>
              <div className="section">
                <h3>Detalle</h3>
                <dl className="kv">
                  <dt>Concepto</dt>
                  <dd>{selected.invoice.concept}</dd>
                  <dt>Proyecto</dt>
                  <dd>{selected.invoice.projectName ?? <span className="muted">Sin proyecto</span>}</dd>
                  <dt>Enviada a</dt>
                  <dd>{selected.invoice.recipientEmail ?? <span className="muted">Correo de facturación del cliente</span>}</dd>
                  <dt>Total</dt>
                  <dd>{money.format(selected.invoice.amountCents / 100)}</dd>
                  {selected.invoice.creditedCents > 0 ? (
                    <>
                      <dt>Notas de crédito</dt>
                      <dd>{money.format(selected.invoice.creditedCents / 100)}</dd>
                    </>
                  ) : null}
                  <dt>Vence</dt>
                  <dd>{selected.invoice.dueAt ? formatDate(selected.invoice.dueAt) : <span className="muted">Al emitirla · {selected.invoice.dueDays} días</span>}</dd>
                </dl>
                {selected.invoice.lines.length > 0 ? (
                  <table className="mini-table" style={{ marginTop: 10 }}>
                    <thead>
                      <tr>
                        <th scope="col">Descripción</th>
                        <th scope="col">Cant.</th>
                        <th scope="col">Precio</th>
                        <th scope="col">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.invoice.lines.map((line, index) => (
                        <tr key={index}>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{money.format(line.unitAmountCents / 100)}</td>
                          <td>{money.format((line.quantity * line.unitAmountCents) / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {selected.invoice.payUrl ? (
                  <p style={{ margin: "10px 0 0" }}>
                    <a href={selected.invoice.payUrl} target="_blank" rel="noreferrer">Ver la página de pago en Stripe</a>
                  </p>
                ) : null}
              </div>
              <div className="section decision">
                <h3>Acciones</h3>
                {selected.status === "borrador" ? (
                  <>
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Editar borrador</summary>
                      <div style={{ marginTop: 10 }}>
                        <EditDraftForm
                          invoice={{
                            id: selected.invoice.id,
                            concept: selected.invoice.concept,
                            projectId: selected.invoice.projectId,
                            dueDays: selected.invoice.dueDays,
                            lines: selected.invoice.lines,
                            recipientEmail: selected.invoice.recipientEmail,
                          }}
                          projects={projects.filter((project) => project.organizationId === selected.invoice.organizationId)}
                        />
                      </div>
                    </details>
                    <p className="sub" style={{ margin: "10px 0 0" }}>Se emite desde Aprobaciones, con tu decisión.</p>
                    <Link href="/aprobaciones" className="primary" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, marginTop: 8 }}>
                      Ir a Aprobaciones
                    </Link>
                    <DiscardDraftForm invoiceId={selected.invoice.id} />
                  </>
                ) : null}
                {selected.status === "enviada" || selected.status === "vencida" ? (
                  <>
                    <ReminderForm invoiceId={selected.invoice.id} overdue={selected.status === "vencida"} />
                    <VoidInvoiceForm invoiceId={selected.invoice.id} />
                  </>
                ) : null}
                {selected.status === "pagada" ? (
                  selected.invoice.amountCents - selected.invoice.creditedCents > 0 ? (
                    <CreditNoteForm invoiceId={selected.invoice.id} remainingCents={selected.invoice.amountCents - selected.invoice.creditedCents} />
                  ) : (
                    <p className="sub" style={{ margin: 0 }}>Factura pagada y devuelta por completo. Queda como registro.</p>
                  )
                ) : null}
                {selected.status === "anulada" ? <p className="sub" style={{ margin: 0 }}>Factura anulada. Queda como registro.</p> : null}
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Selecciona una factura para verla.</p>
          )}
        </aside>
      </div>
    </>
  );
}
