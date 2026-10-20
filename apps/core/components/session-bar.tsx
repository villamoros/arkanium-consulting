"use client";

import { UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";
import { useNav } from "./nav-context";

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Administrador",
  "org:member": "Miembro",
};

// En el servidor no hay ventana: el botón de cuenta solo se monta en el navegador, después de la hidratación.
const subscribeNothing = () => () => {};
const isBrowser = () => true;
const isServer = () => false;

// Barra superior: en pantallas pequeñas, el botón de menú va a la izquierda, junto al logo y el nombre.
// «Cerrar sesión» está en el botón de cuenta y vuelve al sitio público (afterSignOutUrl en ClerkProvider).
export function SessionBar({ orgName, role, product }: { orgName: string; role?: string | null; product: string }) {
  const { open, toggle } = useNav();
  const mounted = useSyncExternalStore(subscribeNothing, isBrowser, isServer);
  return (
    <header className="session-bar">
      <div className="session-bar-left">
        <button
          type="button"
          className="nav-toggle nav-toggle--bar"
          aria-expanded={open}
          aria-controls="site-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={toggle}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <div>
          <strong>Arkanium · {product}</strong>
          <p>
            {orgName} · {role ? (ROLE_LABEL[role] ?? role) : "Sin rol"}
          </p>
        </div>
      </div>
      {mounted ? <UserButton /> : null}
    </header>
  );
}
