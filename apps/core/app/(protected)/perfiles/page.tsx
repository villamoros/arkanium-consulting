import Link from "next/link";
import { connection } from "next/server";
import { leadSourceValues } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { MktButton, MktForm } from "@/components/marketing/mkt-form";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { marketingAction } from "@/app/(protected)/mercadeo/actions";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type Persona = {
  id: string;
  name: string;
  segment: string;
  service: string | null;
  channel: string | null;
  note: string | null;
  status: "activo" | "pausado";
  contactsToday: number;
};
type Contact = { id: string; channel: string; note: string; occurredAt: string; actor: string };

const CHANNELS = leadSourceValues.map((value) => ({ value, label: value }));

export default async function PersonasPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "" } = await searchParams;

  let overview: { cap: number; totalToday: number; personas: Persona[] };
  try {
    overview = await apiFetch<{ cap: number; totalToday: number; personas: Persona[] }>("/buyer-personas");
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar los perfiles.";
    return (
      <StatePanel title="No pudimos cargar los perfiles">
        <p>{message}</p>
        <p>Ningún contacto se ha enviado ni registrado.</p>
      </StatePanel>
    );
  }

  // Depende de cuándo se atiende la petición: connection() lo marca como dinámico.
  await connection();
  const { personas, cap, totalToday } = overview;
  const selected = personas.find((persona) => persona.id === id) ?? personas[0];

  let contacts: Contact[] = [];
  if (selected) {
    try {
      ({ contacts } = await apiFetch<{ contacts: Contact[] }>(`/buyer-personas/${selected.id}/contacts`));
    } catch {
      contacts = [];
    }
  }
  const capReached = totalToday >= cap;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Buyer personas</h1>
          <p>Perfiles que queremos convertir en leads, y el contacto directo que el equipo mantiene con cada uno. Sin envíos masivos.</p>
        </div>
      </div>

      <div className="approval" role="note">
        <span aria-hidden="true">◈</span>
        <div>
          <strong>Política de contacto:</strong> máximo {cap} contactos por día en total. Arkanium no envía mensajes desde aquí: registras cada contacto que hiciste tú, y queda en la bitácora.
        </div>
      </div>

      <div className="kpis" aria-label="Resumen de perfiles">
        <div className="kpi">
          <b>
            {totalToday} / {cap}
          </b>
          <span>contactos hoy{capReached ? " (límite alcanzado)" : ""}</span>
        </div>
        <div className="kpi">
          <b>{personas.filter((persona) => persona.status === "activo").length}</b>
          <span>perfiles activos</span>
        </div>
        <div className="kpi">
          <b>{personas.filter((persona) => persona.status === "pausado").length}</b>
          <span>en pausa</span>
        </div>
        <div className="kpi">
          <b>{personas.length}</b>
          <span>perfiles</span>
        </div>
      </div>

      <div className="filters" style={{ justifyContent: "flex-start" }}>
        <MktForm
          op="persona-create"
          label="Nuevo perfil"
          submit="Crear perfil"
          fields={[
            { name: "name", label: "Nombre del perfil", required: true, maxLength: 120, placeholder: "Director de operaciones, manufactura" },
            { name: "segment", label: "Segmento", kind: "textarea", required: true, maxLength: 300, placeholder: "Empresas de manufactura con un ERP de más de diez años" },
            { name: "service", label: "Servicio que evalúa", required: true, maxLength: 120, placeholder: "Evaluación de arquitectura" },
            { name: "channel", label: "Canal donde está", kind: "select", options: CHANNELS, defaultValue: "linkedin" },
            { name: "note", label: "Nota (opcional)", kind: "textarea", maxLength: 1000 },
          ]}
        />
      </div>

      <div className="layout">
        <section className="panel" aria-label="Perfiles">
          {personas.length === 0 ? (
            <p className="muted" style={{ padding: 18, margin: 0 }}>Todavía no hay perfiles. Define el primero con el servicio que quieres vender y el canal donde está.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Perfil</th>
                  <th scope="col" className="hide-sm">Canal</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Hoy</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id} aria-selected={persona.id === selected?.id}>
                    <td>
                      <Link href={`/perfiles?id=${persona.id}`} className="row-link">
                        <div className="lead-name">{persona.name}</div>
                        <div className="sub">{persona.service ?? "Sin servicio"}</div>
                      </Link>
                    </td>
                    <td className="hide-sm">{persona.channel ?? "—"}</td>
                    <td>
                      <span className={`badge ${persona.status === "pausado" ? "b-pospuesto" : "b-convertido"}`}>{persona.status === "pausado" ? "En pausa" : "Activo"}</span>
                    </td>
                    <td>{persona.contactsToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="panel detail" aria-live="polite" aria-label="Detalle del perfil">
          {selected ? (
            <div key={selected.id}>
              <div className="head">
                <div>
                  <h2>{selected.name}</h2>
                  <div className="sub">{selected.service ?? "Sin servicio"} · {selected.channel ?? "sin canal"}</div>
                </div>
                <span className={`badge ${selected.status === "pausado" ? "b-pospuesto" : "b-convertido"}`}>{selected.status === "pausado" ? "En pausa" : "Activo"}</span>
              </div>
              <p className="sub" style={{ margin: "8px 0" }}>{selected.segment}</p>
              {selected.note ? <p className="sub" style={{ margin: 0 }}>Nota: {selected.note}</p> : null}

              <div className="section decision">
                <h3>Control</h3>
                {selected.status === "activo" ? (
                  <>
                    <p className="sub" style={{ margin: "0 0 4px" }}>Pausar detiene todo contacto con este perfil de inmediato.</p>
                    <MktButton op="persona-status" id={selected.id} label="Pausar perfil" tone="danger" extra={{ status: "pausado" }} />
                  </>
                ) : (
                  <MktButton op="persona-status" id={selected.id} label="Reanudar perfil" tone="secondary" extra={{ status: "activo" }} />
                )}
              </div>

              <div className="section decision">
                <h3>Registrar contacto</h3>
                {selected.status === "pausado" ? (
                  <p className="sub" style={{ margin: 0 }}>El perfil está en pausa. Reanúdalo para registrar contactos.</p>
                ) : capReached ? (
                  <p className="notice-bad" role="note" style={{ margin: 0 }}>Límite diario alcanzado. Los contactos se reanudan mañana.</p>
                ) : (
                  <MktForm
                    op="contact-create"
                    id={selected.id}
                    label="Registrar contacto"
                    submit="Guardar contacto"
                    fields={[
                      { name: "channel", label: "Canal", kind: "select", options: CHANNELS, defaultValue: selected.channel ?? "linkedin" },
                      { name: "note", label: "Qué pasó", kind: "textarea", required: true, maxLength: 500, placeholder: "Respondió al primer mensaje; pidió una llamada" },
                    ]}
                  />
                )}
              </div>

              <div className="section decision">
                <h3>Pasar a Leads</h3>
                {selected.status === "pausado" ? (
                  <p className="sub" style={{ margin: 0 }}>Reanuda el perfil para pasarlo a Leads.</p>
                ) : (
                  <MktForm
                    op="persona-convert"
                    id={selected.id}
                    label="Pasar a Leads"
                    submit="Crear lead"
                    fields={[
                      { name: "name", label: "Nombre de la persona", required: true, maxLength: 120 },
                      { name: "email", label: "Correo", kind: "email", required: true, maxLength: 254 },
                      { name: "company", label: "Empresa (opcional)", maxLength: 160 },
                    ]}
                    intro="El lead queda con el origen de este perfil y aparece en Leads para calificarlo."
                  />
                )}
              </div>

              <div className="section">
                <h3>Contactos ({contacts.length})</h3>
                {contacts.length === 0 ? (
                  <p className="muted">Todavía no hay contactos registrados.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {contacts.map((contact) => (
                      <li key={contact.id} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
                        <b>{contact.channel}</b> <span className="sub">· {formatDate(contact.occurredAt)}</span>
                        <div>{contact.note}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="section decision">
                <h3>Eliminar perfil</h3>
                <p className="sub" style={{ margin: 0 }}>El perfil deja de verse. Sus contactos quedan en la bitácora.</p>
                <ConfirmAction label="Eliminar perfil" title="¿Eliminar este perfil?" body="El perfil deja de verse. Sus contactos quedan guardados en la bitácora." confirmLabel="Eliminar perfil" action={marketingAction} fields={{ op: "persona-delete", id: selected.id }} />
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Crea un perfil para verlo aquí.</p>
          )}
        </aside>
      </div>
    </>
  );
}
