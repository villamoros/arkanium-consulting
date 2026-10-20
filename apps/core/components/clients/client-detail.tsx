import { formatDate } from "@/lib/labels";
import {
  InviteMemberForm,
  MemberRoleForm,
  ReactivateClientForm,
  RemoveMemberForm,
  SuspendClientForm,
} from "@/components/clients/client-forms";
import { BillingEmailForm } from "@/components/clients/billing-email-form";

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Administrador",
  "org:member": "Miembro",
};

const DECISION_LABEL: Record<string, string> = {
  aprobacion_entregable: "Aprobó un entregable",
  correccion: "Pidió una corrección",
  solicitud_reunion: "Pidió una reunión",
  aceptacion_propuesta: "Aceptó una propuesta",
};

export type ClientDetailData = {
  organization: { id: string; name: string; status: "active" | "suspended"; suspendedReason?: string | null; billingEmail?: string | null };
  /** Invitaciones que todavía no se han aceptado. */
  invitations: Array<{ id: string; email: string; role: string; createdAt: string }>;
  invitationsUnavailable?: boolean;
  members: Array<{ userId: string; role: string; email: string | null; name: string | null }>;
  /** true cuando Clerk no reconoce la organización: no hay personas que mostrar ni invitar. */
  membersUnavailable?: boolean;
  decisions: Array<{ id: string; kind: string; text: string; actorId: string; createdAt: string }>;
};

/** Detalle del cliente: estado de acceso, personas, invitación, proyectos y registro de decisiones (solo lectura). */
export function ClientDetail({ detail, projects }: { detail: ClientDetailData; projects: Array<{ id: string; name: string; phase: string }> }) {
  const { organization, members, decisions } = detail;
  const suspended = organization.status === "suspended";
  const admins = members.filter((member) => member.role === "org:admin").length;

  return (
    <>
      <div className="head">
        <div>
          <h2>{organization.name}</h2>
          <div className="sub">Organización cliente</div>
        </div>
        <span className={`badge ${suspended ? "b-descartado" : "b-convertido"}`}>{suspended ? "Suspendida" : "Activa"}</span>
      </div>

      {suspended ? (
        <div className="notice-bad" role="note" style={{ marginTop: 12 }}>
          Acceso suspendido{organization.suspendedReason ? `: ${organization.suspendedReason}` : ""}. El cliente no entra a la app; tú sí. Nada se borró.
        </div>
      ) : null}

      <div className="section">
        <h3>Personas</h3>
        {detail.membersUnavailable ? (
          <p className="notice-bad" role="note" style={{ margin: 0 }}>
            No encontramos esta organización en Clerk, así que no se pueden ver ni invitar personas. Suele pasar con clientes de prueba.
          </p>
        ) : members.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay personas en este cliente.</p>
        ) : (
          <ul className="checks">
            {members.map((member) => {
              const isLastAdmin = member.role === "org:admin" && admins === 1;
              return (
                <li key={member.userId} style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 200px" }}>
                    <b>{member.name ?? member.email ?? member.userId}</b>
                    <span className="sub">{member.email ? ` · ${member.email}` : ""}</span>
                    <span className="idle-tag" style={{ marginLeft: 8 }}>{ROLE_LABEL[member.role] ?? member.role}</span>
                  </span>
                  {isLastAdmin ? (
                    <span className="sub">Único administrador: no se puede cambiar ni retirar.</span>
                  ) : (
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <MemberRoleForm organizationId={organization.id} userId={member.userId} role={member.role === "org:admin" ? "org:admin" : "org:member"} />
                      <RemoveMemberForm organizationId={organization.id} userId={member.userId} name={member.name ?? member.email ?? "Esta persona"} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="section">
        <h3>Invitaciones pendientes</h3>
        {detail.invitationsUnavailable ? (
          <p className="notice-bad" role="note" style={{ margin: 0 }}>No pudimos leer las invitaciones pendientes de este cliente.</p>
        ) : detail.invitations.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>No hay invitaciones pendientes.</p>
        ) : (
          <ul className="checks">
            {detail.invitations.map((invitation) => (
              <li key={invitation.id}>
                <span>
                  {invitation.email} <span className="sub">· {ROLE_LABEL[invitation.role] ?? invitation.role} · enviada {formatDate(invitation.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section decision">
        <h3>Invitar a una persona</h3>
        <InviteMemberForm organizationId={organization.id} />
        <p className="sub" style={{ margin: "8px 0 0" }}>La invitación la envía Arkanium desde aquí. El cliente no puede invitar a nadie por su cuenta.</p>
      </div>

      <div className="section">
        <h3>Proyectos</h3>
        {projects.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay proyectos activos.</p>
        ) : (
          <ul className="checks">
            {projects.map((project) => (
              <li key={project.id}>
                <a href={`/proyectos?id=${project.id}`}>{project.name}</a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h3>Registro de decisiones del cliente</h3>
        {decisions.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>Todavía no hay decisiones registradas.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {decisions.map((decision) => (
              <li key={decision.id}>
                <b>{DECISION_LABEL[decision.kind] ?? decision.kind}</b> · <span className="sub">{formatDate(decision.createdAt)}</span>
                <div style={{ fontSize: 13 }}>«{decision.text}»</div>
              </li>
            ))}
          </ol>
        )}
        <p className="sub" style={{ margin: "8px 0 0" }}>Solo lectura. Las decisiones no se editan.</p>
      </div>

      <div className="section">
        <h3>Facturación</h3>
        <BillingEmailForm organizationId={organization.id} current={organization.billingEmail ?? ""} />
        <p className="sub" style={{ margin: "8px 0 0" }}>Stripe envía cada factura a este correo. Sin él no se puede emitir.</p>
      </div>

      <div className="section decision">
        <h3>Acceso de la organización</h3>
        {suspended ? (
          <>
            <ReactivateClientForm organizationId={organization.id} />
            <p className="sub" style={{ margin: "8px 0 0" }}>Reactivar devuelve el acceso de inmediato.</p>
          </>
        ) : (
          <>
            <SuspendClientForm organizationId={organization.id} />
            <p className="sub" style={{ margin: "8px 0 0" }}>Suspender corta el acceso del cliente a la app sin borrar nada. Queda en la bitácora con el motivo.</p>
          </>
        )}
      </div>
    </>
  );
}
