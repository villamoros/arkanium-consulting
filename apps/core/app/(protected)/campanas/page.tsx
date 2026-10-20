import Link from "next/link";
import { connection } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";
import { StatePanel } from "@/components/state-panel";
import { MktButton, MktForm } from "@/components/marketing/mkt-form";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { marketingAction } from "@/app/(protected)/mercadeo/actions";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type Landing = { id: string; title: string; url: string | null; campaignId: string | null };
type Piece = { id: string; network: string; format: string; copy: string; assetUrl: string | null; status: "borrador" | "en_revision" | "aprobada" | "publicada" | "pausada" };
type Campaign = {
  id: string;
  name: string;
  service: string | null;
  status: "borrador" | "activa" | "pausada" | "cerrada";
  buyerPersonaId: string | null;
  objective: "leads" | "reuniones" | "reconocimiento" | null;
  message: string | null;
  cta: string | null;
  constraints: string | null;
  kpis: string | null;
  budgetCents: number | null;
  networks: string[];
  briefStatus: "borrador" | "en_revision" | "aprobado";
  personaIds: string[];
  pieces: Piece[];
  leads: number;
  landings: Landing[];
  channels: Channel[];
};

type ChannelKind = "red_social" | "newsletter" | "landing" | "anuncio_pagado";
type Channel = { id: string; kind: ChannelKind; platform: string; budgetCents: number | null; startsOn: string | null; endsOn: string | null };

const CHANNEL_LABEL: Record<ChannelKind, string> = { red_social: "Red social", newsletter: "Newsletter", landing: "Landing", anuncio_pagado: "Anuncio pagado" };
/** Se agregan aquí; las redes salen del brief y las landings de su propia sección. */
const CHANNEL_KIND_OPTIONS = [
  { value: "newsletter", label: "Newsletter" },
  { value: "anuncio_pagado", label: "Anuncio pagado" },
];

const NETWORKS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
];
const FORMATS = [
  { value: "texto", label: "Texto" },
  { value: "imagen", label: "Imagen" },
  { value: "video", label: "Video" },
  { value: "carrusel", label: "Carrusel" },
];
const OBJECTIVES = [
  { value: "leads", label: "Leads" },
  { value: "reuniones", label: "Reuniones" },
  { value: "reconocimiento", label: "Reconocimiento" },
];
const BRIEF_BADGE: Record<Campaign["briefStatus"], string> = { borrador: "b-idle", en_revision: "b-pospuesto", aprobado: "b-convertido" };
const BRIEF_LABEL: Record<Campaign["briefStatus"], string> = { borrador: "Brief en borrador", en_revision: "Brief en revisión", aprobado: "Brief aprobado" };
const PIECE_BADGE: Record<Piece["status"], string> = { borrador: "b-idle", en_revision: "b-pospuesto", aprobada: "b-convertido", publicada: "b-convertido", pausada: "b-descartado" };
const PIECE_LABEL: Record<Piece["status"], string> = { borrador: "Borrador", en_revision: "En revisión", aprobada: "Aprobada", publicada: "Publicada", pausada: "Pausada" };
/** Redes del brief y, para las piezas, el newsletter cuando la campaña tiene ese canal. */
const PIECE_NETWORKS = [...NETWORKS, { value: "newsletter", label: "Newsletter" }];
const networkLabel = (value: string) => PIECE_NETWORKS.find((network) => network.value === value)?.label ?? value;
const moneyUsd = (cents: number | null) => (cents === null ? "Sin presupuesto" : `USD ${(cents / 100).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const datesOf = (channel: Channel) => (channel.startsOn || channel.endsOn ? `${channel.startsOn ?? "…"} → ${channel.endsOn ?? "…"}` : "Sin fechas");

const STATUS_LABEL: Record<Campaign["status"], string> = { borrador: "Borrador", activa: "Activa", pausada: "Pausada", cerrada: "Cerrada" };
const STATUS_BADGE: Record<Campaign["status"], string> = { borrador: "b-idle", activa: "b-convertido", pausada: "b-pospuesto", cerrada: "b-descartado" };
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "" } = await searchParams;

  let campaigns: Campaign[];
  let unassignedLandings: Landing[];
  let personas: Array<{ id: string; name: string }>;
  try {
    const [data, personaData] = await Promise.all([
      apiFetch<{ campaigns: Campaign[]; landings: Landing[] }>("/campaigns"),
      apiFetch<{ personas: Array<{ id: string; name: string }> }>("/buyer-personas"),
    ]);
    campaigns = data.campaigns;
    unassignedLandings = data.landings;
    personas = personaData.personas;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar las campañas.";
    return (
      <StatePanel title="No pudimos cargar las campañas">
        <p>{message}</p>
        <p>Ninguna campaña se ha modificado.</p>
      </StatePanel>
    );
  }

  // Depende de cuándo se atiende la petición: connection() lo marca como dinámico.
  await connection();
  const selected = campaigns.find((campaign) => campaign.id === id) ?? campaigns[0];
  const totalLeads = campaigns.reduce((sum, campaign) => sum + campaign.leads, 0);
  const landingCount = campaigns.reduce((sum, campaign) => sum + campaign.landings.length, 0) + unassignedLandings.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campañas</h1>
          <p>Qué campañas atraen leads y en qué landing page cae cada uno. Los leads llegan a Leads y se califican igual que cualquier otro.</p>
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de campañas">
        <div className="kpi">
          <b>{campaigns.length}</b>
          <span>campañas</span>
        </div>
        <div className="kpi">
          <b>{campaigns.filter((campaign) => campaign.status === "activa").length}</b>
          <span>activas</span>
        </div>
        <div className="kpi">
          <b>{totalLeads}</b>
          <span>leads atribuidos</span>
        </div>
        <div className="kpi">
          <b>{landingCount}</b>
          <span>landing pages</span>
        </div>
      </div>

      <div className="approval" role="note">
        <span aria-hidden="true">◈</span>
        <div>
          <strong>Métricas por red: pendientes.</strong> Aparecerán cuando conectemos las cuentas de publicidad. Por ahora se cuentan los leads que llegan con cada campaña.
        </div>
      </div>

      <div className="filters" style={{ justifyContent: "flex-start", gap: 8 }}>
        <MktForm
          op="campaign-create"
          label="Nueva campaña"
          submit="Crear campaña"
          fields={[
            { name: "name", label: "Nombre", required: true, maxLength: 120, placeholder: "Modernización ERP" },
            { name: "service", label: "Servicio que promueve", required: true, maxLength: 120, placeholder: "Diagnóstico de arquitectura" },
            {
              name: "buyerPersonaId",
              label: "Perfil objetivo (opcional)",
              kind: "select",
              options: [{ value: "", label: "Sin perfil" }, ...personas.map((persona) => ({ value: persona.id, label: persona.name }))],
            },
          ]}
        />
        <MktForm
          op="landing-create"
          label="Nueva landing page"
          submit="Crear landing"
          fields={[
            { name: "title", label: "Título", required: true, maxLength: 120, placeholder: "Diagnóstico de arquitectura" },
            { name: "url", label: "Enlace (opcional)", kind: "url", maxLength: 300 },
            {
              name: "campaignId",
              label: "Campaña (opcional)",
              kind: "select",
              options: [{ value: "", label: "Sin campaña" }, ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))],
            },
          ]}
        />
      </div>

      <div className="layout">
        <section className="panel" aria-label="Campañas">
          {campaigns.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>Todavía no hay campañas. Crea la primera y su landing page.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Campaña</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="hide-sm">Landings</th>
                  <th scope="col">Leads</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} aria-selected={campaign.id === selected?.id}>
                    <td>
                      <Link href={`/campanas?id=${campaign.id}`} className="row-link">
                        <div className="lead-name">{campaign.name}</div>
                        <div className="sub">{campaign.service ?? "Sin servicio"}</div>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[campaign.status]}`}>{STATUS_LABEL[campaign.status]}</span>
                    </td>
                    <td className="hide-sm">{campaign.landings.length}</td>
                    <td>{campaign.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle de la campaña">
          {selected ? (
            <div key={selected.id}>
              <div className="head">
                <div>
                  <h2>{selected.name}</h2>
                  <div className="sub">{selected.service ?? "Sin servicio"}</div>
                </div>
                <span className={`badge ${STATUS_BADGE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>

              <div className="section decision">
                <h3>Estado</h3>
                <MktForm
                  op="campaign-status"
                  id={selected.id}
                  label="Cambiar estado"
                  submit="Guardar estado"
                  fields={[{ name: "status", label: "Estado", kind: "select", options: STATUS_OPTIONS, defaultValue: selected.status }]}
                />
              </div>

              <div className="section">
                <h3>
                  Brief{" "}
                  <span className={`badge ${BRIEF_BADGE[selected.briefStatus]}`} style={{ marginLeft: 6 }}>{BRIEF_LABEL[selected.briefStatus]}</span>
                </h3>
                <p className="sub" style={{ margin: "0 0 8px" }}>
                  Las instrucciones para el agente. Nada se produce ni se publica sin el brief aprobado.
                </p>
                <MktForm
                  op="brief-save"
                  id={selected.id}
                  label="Editar brief"
                  submit="Guardar brief"
                  fields={[
                    { name: "objective", label: "Objetivo", kind: "select", options: OBJECTIVES, defaultValue: selected.objective ?? "leads", required: true },
                    { name: "message", label: "Mensaje principal", kind: "textarea", required: true, maxLength: 500, defaultValue: selected.message ?? "" },
                    { name: "cta", label: "Llamada a la acción", required: true, maxLength: 120, defaultValue: selected.cta ?? "", placeholder: "Agenda 20 minutos" },
                    { name: "networks", label: "Redes", kind: "checkboxes", options: NETWORKS, defaultChecked: selected.networks, required: true },
                    {
                      name: "personaIds",
                      label: "Perfiles objetivo",
                      kind: "checkboxes",
                      options: personas.map((persona) => ({ value: persona.id, label: persona.name })),
                      defaultChecked: selected.personaIds,
                    },
                    { name: "budget", label: "Presupuesto (USD, opcional)", defaultValue: selected.budgetCents ? (selected.budgetCents / 100).toFixed(2) : "", placeholder: "1500.00" },
                    { name: "constraints", label: "Restricciones (tono, promesas que no hacemos)", kind: "textarea", maxLength: 1000, defaultValue: selected.constraints ?? "" },
                    { name: "kpis", label: "Indicadores", maxLength: 300, defaultValue: selected.kpis ?? "" },
                  ]}
                />
                {selected.briefStatus === "borrador" ? (
                  <MktButton op="brief-review" id={selected.id} label="Enviar brief a revisión" tone="primary" />
                ) : null}
              </div>

              <div className="section">
                <h3>Canales</h3>
                <p className="sub" style={{ margin: "0 0 8px" }}>
                  Las redes del brief son canales de red social. Aquí agregas el newsletter y los anuncios pagados. Las landings van en su propia sección.
                </p>
                {selected.channels.length === 0 ? (
                  <p className="muted" style={{ margin: "0 0 8px" }}>Todavía no hay canales adicionales.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
                    {selected.channels.map((channel) => (
                      <li key={channel.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
                        <span>
                          <b>{CHANNEL_LABEL[channel.kind]}</b> · {channel.platform}
                          <div className="sub">
                            {moneyUsd(channel.budgetCents)} · {datesOf(channel)}
                          </div>
                        </span>
                        <ConfirmAction
                          label="Quitar"
                          title="¿Quitar este canal?"
                          body="El canal deja de contar en la campaña. No se puede quitar un newsletter con piezas vivas."
                          confirmLabel="Quitar canal"
                          action={marketingAction}
                          fields={{ op: "channel-delete", id: channel.id }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <MktForm
                  op="channel-create"
                  id={selected.id}
                  label="Agregar canal"
                  submit="Agregar canal"
                  fields={[
                    { name: "kind", label: "Tipo", kind: "select", options: CHANNEL_KIND_OPTIONS, required: true },
                    { name: "platform", label: "Proveedor o plataforma", required: true, maxLength: 60, placeholder: "Resend, Substack, Meta Ads…" },
                    { name: "budget", label: "Presupuesto (USD, opcional)", placeholder: "0.00" },
                    { name: "startsOn", label: "Inicio (opcional)", kind: "date" },
                    { name: "endsOn", label: "Fin (opcional)", kind: "date" },
                  ]}
                />
              </div>

              <div className="section">
                <h3>Piezas por red</h3>
                {selected.briefStatus !== "aprobado" ? (
                  <p className="muted" style={{ margin: "0 0 8px" }}>Aprueba el brief para crear piezas.</p>
                ) : (
                  <MktForm
                    op="piece-create"
                    id={selected.id}
                    label="Nueva pieza"
                    submit="Crear pieza"
                    fields={[
                      {
                        name: "network",
                        label: "Red o canal",
                        kind: "select",
                        options: PIECE_NETWORKS.filter((network) => selected.networks.includes(network.value) || (network.value === "newsletter" && selected.channels.some((channel) => channel.kind === "newsletter"))),
                      },
                      { name: "format", label: "Formato", kind: "select", options: FORMATS, defaultValue: "imagen" },
                      { name: "copy", label: "Texto del anuncio", kind: "textarea", required: true, maxLength: 1500 },
                      { name: "assetUrl", label: "Material (enlace, opcional)", kind: "url", maxLength: 500 },
                    ]}
                  />
                )}
                {selected.pieces.length === 0 ? (
                  <p className="muted">Todavía no hay piezas.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                    {selected.pieces.map((piece) => (
                      <li key={piece.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
                        <b>{networkLabel(piece.network)}</b> · {FORMATS.find((format) => format.value === piece.format)?.label ?? piece.format}{" "}
                        <span className={`badge ${PIECE_BADGE[piece.status]}`}>{PIECE_LABEL[piece.status]}</span>
                        <div style={{ whiteSpace: "pre-wrap" }}>{piece.copy}</div>
                        {piece.assetUrl ? <a href={piece.assetUrl} target="_blank" rel="noreferrer">Material</a> : null}
                        {piece.status === "borrador" ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <MktButton op="piece-review" id={piece.id} label="Enviar a revisión" tone="primary" />
                            <ConfirmAction label="Descartar" title="¿Descartar esta pieza?" body="La pieza deja de verse. Solo se descartan piezas en borrador." confirmLabel="Descartar pieza" action={marketingAction} fields={{ op: "piece-discard", id: piece.id }} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="section">
                <h3>Landing pages</h3>
                {selected.landings.length === 0 ? (
                  <p className="muted">Esta campaña todavía no tiene landing pages.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {selected.landings.map((landing) => (
                      <li key={landing.id}>
                        {landing.url ? <a href={landing.url} target="_blank" rel="noreferrer">{landing.title}</a> : landing.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {unassignedLandings.length > 0 ? (
                <div className="section">
                  <h3>Sin campaña</h3>
                  {unassignedLandings.map((landing) => (
                    <div key={landing.id} style={{ marginBottom: 8 }}>
                      <b>{landing.title}</b>
                      <MktButton op="landing-assign" id={landing.id} label={`Asignar a ${selected.name}`} tone="secondary" extra={{ campaignId: selected.id }} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Crea una campaña para verla aquí.</p>
          )}
        </aside>
      </div>
    </>
  );
}
