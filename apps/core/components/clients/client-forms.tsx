"use client";

import { Notice } from "@/components/ui/notice";
import { useActionState, useState, type ReactNode } from "react";
import {
  inviteMemberAction,
  reactivateClientAction,
  removeMemberAction,
  setMemberRoleAction,
  suspendClientAction,
  type ClientActionState,
} from "@/app/(protected)/clientes/actions";

function Disclosure({ label, danger, children }: { label: string; danger?: boolean; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={danger ? "danger" : "secondary"} onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {label}
      </button>
    );
  }
  return <div style={{ marginTop: 8 }}>{children()}</div>;
}

/** Invitar a una persona. Arkanium envía la invitación; el cliente no invita por su cuenta. */
export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(inviteMemberAction, null);
  return (
    <form action={action} className="decision">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="field">
        Correo
        <input type="email" name="email" required maxLength={254} disabled={pending} placeholder="nombre@empresa.com" />
      </label>
      <label className="field">
        Rol
        <select name="role" defaultValue="org:member" disabled={pending}>
          <option value="org:member">Miembro · ve sus proyectos asignados</option>
          <option value="org:admin">Administrador · aprueba entregables y gestiona el equipo</option>
        </select>
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Enviando…" : "Enviar invitación"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** Cambiar el rol de una persona. Antes de hacerlo, se explica qué cambia para esa persona. */
export function MemberRoleForm({ organizationId, userId, role }: { organizationId: string; userId: string; role: "org:admin" | "org:member" }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(setMemberRoleAction, null);
  const next = role === "org:admin" ? "org:member" : "org:admin";
  const explanation =
    role === "org:admin"
      ? "Pasa a miembro: ya no aprueba entregables, no paga facturas y no gestiona el equipo del cliente."
      : "Pasa a administrador: podrá aprobar entregables, pagar facturas y gestionar el equipo del cliente.";
  return (
    <Disclosure label={role === "org:admin" ? "Hacer miembro" : "Hacer administrador"}>
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={next} />
          <p className="sub" style={{ margin: 0 }}>{explanation}</p>
          <div className="actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Cambiando…" : "Confirmar cambio"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Retirar a una persona, con confirmación. Su historial se conserva. */
export function RemoveMemberForm({ organizationId, userId, name }: { organizationId: string; userId: string; name: string }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(removeMemberAction, null);
  return (
    <Disclosure label="Retirar" danger>
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="userId" value={userId} />
          <p className="sub" style={{ margin: 0 }}>
            {name} dejará de tener acceso a los proyectos de este cliente. Su historial queda en la bitácora.
          </p>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Retirando…" : "Retirar a la persona"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Suspender el acceso del cliente. Pide el motivo; nada se borra. */
export function SuspendClientForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(suspendClientAction, null);
  return (
    <Disclosure label="Suspender acceso" danger>
      {() => (
        <form action={action} className="decision">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label className="field">
            Motivo (obligatorio)
            <textarea name="reason" required maxLength={300} disabled={pending} placeholder="Por qué se suspende el acceso" />
          </label>
          <p className="sub" style={{ margin: 0 }}>El cliente deja de entrar a la app. Nada se borra. El motivo queda en la bitácora.</p>
          <div className="actions">
            <button type="submit" className="danger" disabled={pending}>
              {pending ? "Suspendiendo…" : "Suspender"}
            </button>
          </div>
          <Notice state={state} />
        </form>
      )}
    </Disclosure>
  );
}

/** Reactivar el acceso del cliente. Vuelve de inmediato. */
export function ReactivateClientForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState<ClientActionState, FormData>(reactivateClientAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <button type="submit" className="primary" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Reactivando…" : "Reactivar acceso"}
      </button>
      <Notice state={state} />
    </form>
  );
}
